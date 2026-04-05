# Offline-First Architecture

Patterns and implementation guidelines for building mobile applications where the local database is the source of truth and the network is an asynchronous sync channel.

**Why?** Mobile applications deployed in environments with unreliable connectivity -- rural areas, underground transit, developing-market networks, point-of-sale terminals -- must work identically offline. Treating the network as an optional enhancement rather than a requirement produces faster, more resilient user experiences. Without a disciplined offline-first architecture, developers end up with inconsistent caching heuristics, lost writes, and unpredictable UX during connectivity changes.

---

## Core Principle

The local SQLite database (via SQLDelight) is the **single source of truth** for all reads. The UI never reads from the network directly. All writes go to the local database first, then propagate to the server asynchronously through a sync engine.

**Key invariants:**
1. The UI reads only from the local database.
2. All writes go to the local database first, then to the outbox.
3. The sync engine processes the outbox independently of the UI.
4. Reads are always fast (local I/O); perceived latency comes only from sync lag.

---

## Schema Design for Sync

Every synced entity MUST include sync metadata columns. These columns enable the sync engine to track what needs to be pushed, what has been confirmed, and how to resolve conflicts.

### Required Sync Columns

| Column | Type | Purpose |
|---|---|---|
| `id` | TEXT (client UUID/ULID) | Stable identity before server confirmation |
| `server_id` | TEXT | Populated after first successful sync |
| `sync_status` | TEXT | Current sync state of the record |
| `created_at` | INTEGER | Device clock (epoch ms); ordering within device |
| `updated_at` | INTEGER | Last local modification time |
| `synced_at` | INTEGER | Last confirmed sync time (null until synced) |
| `version` | INTEGER | Optimistic lock counter, incremented on each write |
| `is_deleted` | INTEGER | Soft-delete flag (never hard-delete before sync) |

### Example Schema

```sql
CREATE TABLE Transaction (
    id              TEXT NOT NULL PRIMARY KEY,
    receipt_number  TEXT NOT NULL,
    device_id       TEXT NOT NULL,
    total_amount    REAL NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'CVE',
    sync_status     TEXT NOT NULL DEFAULT 'PENDING',
    created_at      INTEGER NOT NULL,
    synced_at       INTEGER,
    server_id       TEXT,
    version         INTEGER NOT NULL DEFAULT 1,
    is_deleted      INTEGER NOT NULL DEFAULT 0
);

-- Queries
getAll:
SELECT * FROM Transaction WHERE is_deleted = 0 ORDER BY created_at DESC;

getPendingSync:
SELECT * FROM Transaction WHERE sync_status = 'PENDING' AND is_deleted = 0;

markSynced:
UPDATE Transaction SET sync_status = 'SYNCED', synced_at = ? , server_id = ? WHERE id = ?;
```

---

## Sync State Machine

Every synced entity has a `sync_status` column that tracks its lifecycle. The valid states and transitions are:

| State | Meaning | Next States |
|---|---|---|
| `PENDING` | Written locally, not yet sent to server | SYNCING, FAILED |
| `SYNCING` | Currently being transmitted to server | SYNCED, FAILED, CONFLICT |
| `SYNCED` | Server has confirmed receipt | PENDING (on local edit) |
| `CONFLICT` | Server rejected due to version mismatch | PENDING (after resolution) |
| `FAILED` | Permanent failure (server rejected with 4xx) | PENDING (after user correction) |

Transitions:
- Local write sets status to `PENDING`.
- Sync worker moves `PENDING` to `SYNCING` before transmission.
- On server `2xx`, status moves to `SYNCED`.
- On server `409` (conflict), status moves to `CONFLICT`.
- On server `4xx` (non-retryable), status moves to `FAILED`.
- On network error or server `5xx`, status reverts to `PENDING` for retry.

---

## Sync Strategies

Choose a sync strategy based on data direction and volume. Most applications use a combination.

| Strategy | Direction | When To Use | Trade-off |
|---|---|---|---|
| Push-only (Outbox) | Client to Server | Mutations created on device (transactions, forms) | Simple; low conflict risk |
| Pull-only (Polling) | Server to Client | Read-only data (catalogs, price lists, config) | No conflicts; requires TTL management |
| Delta sync (Cursors) | Server to Client | Large datasets with incremental changes | Low bandwidth; requires cursor endpoint |
| Priority-based | Client to Server | Mixed-urgency mutations (fiscal docs vs analytics) | Ensures critical data syncs first |

### Push-Only: Outbox Pattern

The standard pattern for client-to-server sync. Business writes and sync intent are committed atomically in a single database transaction.

```kotlin
class OutboxSyncWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val pending = db.outboxQueries.getPending().executeAsList()
        if (pending.isEmpty()) return Result.success()

        return try {
            val chunks = pending.chunked(BATCH_SIZE)
            for (chunk in chunks) {
                val response = api.pushChanges(chunk.toSyncPayload())
                db.transaction {
                    response.accepted.forEach { db.outboxQueries.markProcessed(it.localId) }
                    response.conflicts.forEach { db.outboxQueries.markConflict(it.localId, it.reason) }
                }
            }
            Result.success()
        } catch (e: IOException) {
            if (runAttemptCount < MAX_RETRIES) Result.retry() else Result.failure()
        }
    }

    companion object {
        const val BATCH_SIZE = 50
        const val MAX_RETRIES = 5
    }
}
```

### Pull-Only: Delta Sync with Cursors

The server returns only records changed since the last cursor. The client stores the cursor for the next request.

```kotlin
class CatalogSyncWorker(...) : CoroutineWorker(...) {
    override suspend fun doWork(): Result {
        val lastSync = prefs.getLastCatalogSync()
        val delta = api.getCatalogDelta(since = lastSync)
        db.transaction {
            delta.products.forEach { db.productQueries.upsert(it) }
            delta.deletedIds.forEach { db.productQueries.softDelete(it) }
        }
        prefs.setLastCatalogSync(delta.serverTimestamp)
        return Result.success()
    }
}
```

---

## Outbox Pattern

### Transactional Write

The outbox guarantees that a business write and its sync intent are committed atomically. Without the outbox, a crash between "write entity" and "queue sync" would leave data unsynced silently.

```kotlin
suspend fun saveTransaction(tx: POSTransaction) {
    db.transaction {
        db.transactionQueries.insert(tx.toEntity())
        db.outboxQueries.enqueue(
            OutboxEntry(
                id = ULID.generate(),
                entityId = tx.id,
                entityType = "TRANSACTION",
                operation = "CREATE",
                payload = json.encodeToString(tx),
                idempotencyKey = tx.id,
                priority = SyncPriority.CRITICAL.value,
                createdAt = System.currentTimeMillis()
            )
        )
    }
}
```

### Outbox Schema

```sql
CREATE TABLE Outbox (
    id              TEXT PRIMARY KEY,
    entity_id       TEXT NOT NULL,
    entity_type     TEXT NOT NULL,
    operation       TEXT NOT NULL,
    priority        INTEGER NOT NULL DEFAULT 2,
    payload         TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    attempts        INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL,
    process_after   INTEGER,
    processed_at    INTEGER
);

getPending:
SELECT * FROM Outbox
WHERE processed_at IS NULL
  AND (process_after IS NULL OR process_after <= :now)
ORDER BY priority ASC, created_at ASC
LIMIT :batchSize;
```

### Priority Levels

```kotlin
enum class SyncPriority(val value: Int) {
    CRITICAL(0),   // Cash transactions, fiscal documents
    HIGH(1),       // Inventory adjustments
    NORMAL(2),     // Catalog pulls, config updates
    LOW(3)         // Analytics, audit logs
}
```

---

## Conflict Resolution

Choose a resolution strategy based on the data type and business requirements.

| Strategy | Best For | Trade-off |
|---|---|---|
| Last-Write-Wins (LWW) | Profile data, settings | Simple; silent data loss possible |
| Hybrid Logical Clocks (HLC) | Distributed ordering | Monotonic; requires HLC library |
| CRDTs | Counters, sets with concurrent edits | Automatic merge; high design complexity |
| Server-authoritative | Prices, tax rates, inventory | Client changes rejected cleanly |
| Domain-specific rules | POS transactions (immutable) | Most correct for business; requires domain analysis |

### LWW Implementation

```kotlin
fun resolveWithLWW(local: SyncRecord, remote: SyncRecord): ConflictResolution {
    return if (local.updatedAt >= remote.updatedAt) {
        ConflictResolution(winner = local, loser = remote, strategy = "LWW_LOCAL")
    } else {
        ConflictResolution(winner = remote, loser = local, strategy = "LWW_REMOTE")
    }
}
```

### Hybrid Logical Clocks

HLCs combine physical time with a logical counter. They guarantee causal ordering across devices and solve the "same millisecond" problem that makes pure LWW unsafe.

```kotlin
data class HLC(val wallTime: Long, val logical: Int) : Comparable<HLC> {
    override fun compareTo(other: HLC): Int {
        val timeCmp = wallTime.compareTo(other.wallTime)
        return if (timeCmp != 0) timeCmp else logical.compareTo(other.logical)
    }

    fun tick(receivedHLC: HLC? = null): HLC {
        val now = System.currentTimeMillis()
        return when {
            receivedHLC == null -> {
                if (now > wallTime) HLC(now, 0)
                else HLC(wallTime, logical + 1)
            }
            now > wallTime && now > receivedHLC.wallTime -> HLC(now, 0)
            receivedHLC.wallTime > wallTime ->
                HLC(receivedHLC.wallTime, receivedHLC.logical + 1)
            else ->
                HLC(wallTime, maxOf(logical, receivedHLC.logical) + 1)
        }
    }
}
```

---

## Background Sync

MUST use WorkManager for all background sync operations. Do NOT use `AlarmManager`, `JobScheduler`, or custom `Service` subclasses for deferred sync work. WorkManager survives app restarts, respects battery optimization, and integrates with Doze mode.

### Periodic Sync

```kotlin
fun scheduleSyncWork(context: Context) {
    val constraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .setRequiresBatteryNotLow(false)
        .build()

    val periodicSync = PeriodicWorkRequestBuilder<OutboxSyncWorker>(
        repeatInterval = 15, repeatIntervalTimeUnit = TimeUnit.MINUTES
    )
        .setConstraints(constraints)
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
        .addTag("outbox-sync")
        .build()

    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        "outbox-sync",
        ExistingPeriodicWorkPolicy.KEEP,
        periodicSync
    )
}
```

### Connectivity-Triggered Immediate Sync

```kotlin
fun triggerImmediateSync(context: Context) {
    val immediateSync = OneTimeWorkRequestBuilder<OutboxSyncWorker>()
        .setConstraints(
            Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
        )
        .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
        .build()

    WorkManager.getInstance(context).enqueueUniqueWork(
        "outbox-sync-immediate",
        ExistingWorkPolicy.REPLACE,
        immediateSync
    )
}
```

### Exponential Backoff

WorkManager handles backoff automatically. For custom retry logic inside the worker, distinguish retryable from permanent failures:

- `429`, `503` (rate-limited / overloaded): `Result.retry()`
- `400`, `422` (unrecoverable): mark entry as permanently failed, `Result.failure()`
- `IOException` (network): `Result.retry()`

Backoff schedule with `BackoffPolicy.EXPONENTIAL` and 30s initial: 30s, 1m, 2m, 4m, 8m.

---

## Idempotency

Every outbox entry MUST carry an idempotency key. The server uses this key to deduplicate re-submitted requests caused by retry after ambiguous network timeouts.

### Client-Generated IDs

| ID Type | Sortable | Collision-Safe | Use Case |
|---|---|---|---|
| UUID v4 | No | Yes | General purpose |
| ULID | Yes (time-prefixed) | Yes | Recommended for synced entities |
| Device-scoped sequence | Yes | Yes (per device) | Receipt numbers |

For entity creation, use the entity's client-generated ID as the idempotency key. For updates, use `${entityId}-${version}` to distinguish successive updates to the same entity.

### Device-Based Sequence Numbers

For human-readable sequential identifiers (e.g., receipt numbers), use the pattern `${deviceId}-${sequence}`:

```kotlin
class ReceiptNumberGenerator(
    private val deviceId: String,
    private val db: AppDatabase
) {
    suspend fun next(date: LocalDate): String {
        return db.transaction(noEnclosing = false) {
            val device4 = deviceId.takeLast(4).uppercase()
            val dateStr = date.format(DateTimeFormatter.BASIC_ISO_DATE)
            val lastSeq = db.sequenceQueries.getLastSequence(device4, dateStr)
                .executeAsOneOrNull() ?: 0
            val nextSeq = lastSeq + 1
            db.sequenceQueries.upsertSequence(device4, dateStr, nextSeq)
            "M-$device4-$dateStr-${nextSeq.toString().padStart(3, '0')}"
        }
    }
}
```

---

## Connectivity Detection

MUST use `ConnectivityManager.NetworkCallback` for real-time network state detection. Do NOT poll for connectivity.

```kotlin
fun observeNetworkState(context: Context): Flow<NetworkState> = callbackFlow {
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            trySend(NetworkState.CONNECTED)
        }
        override fun onLost(network: Network) {
            trySend(NetworkState.DISCONNECTED)
        }
        override fun onCapabilitiesChanged(n: Network, caps: NetworkCapabilities) {
            val state = when {
                caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> NetworkState.WIFI
                caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> NetworkState.CELLULAR
                else -> NetworkState.CONNECTED
            }
            trySend(state)
        }
    }

    val request = NetworkRequest.Builder()
        .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        .build()
    cm.registerNetworkCallback(request, callback)
    awaitClose { cm.unregisterNetworkCallback(callback) }
}

enum class NetworkState { WIFI, CELLULAR, DISCONNECTED, CONNECTED }
```

---

## Offline UX Patterns

### Sync Status Indicator

Display sync state and pending operation count in the UI. Hide the indicator when all data is synced.

```kotlin
@Composable
fun SyncStatusBar(syncState: SyncState, pendingCount: Int) {
    when {
        syncState == SyncState.SYNCING ->
            SyncBanner(
                text = "Syncing... $pendingCount pending",
                color = MaterialTheme.colorScheme.tertiary
            )
        pendingCount > 0 && syncState == SyncState.OFFLINE ->
            SyncBanner(
                text = "Offline -- $pendingCount pending",
                color = MaterialTheme.colorScheme.error
            )
        pendingCount == 0 -> Unit
    }
}
```

### Graceful Degradation

| Scenario | Behaviour |
|---|---|
| Network unavailable | Hide sync-dependent features, show cached data |
| Partial sync failure | Show error badge on specific items, allow manual retry |
| Stale catalog detected | Prompt: "Prices may be outdated. Sync now?" |
| Auth token expired | Queue changes locally, trigger re-auth, resume sync |

### Cache TTL Guidelines

| Data Type | TTL | Rationale |
|---|---|---|
| Stable data (catalog, config) | 5-15 minutes | Infrequent changes |
| Volatile data (inventory, pricing) | 1-5 minutes | Changes frequently |
| User profile / settings | 15-30 minutes | Rarely changes mid-session |

---

## Summary

| Rule | Severity | Description |
|---|---|---|
| Local DB is source of truth | MUST | UI reads only from SQLDelight; never from network directly |
| Sync metadata on every entity | MUST | `sync_status`, `version`, `synced_at`, `is_deleted` columns |
| Outbox for transactional writes | MUST | Business write + outbox enqueue in a single DB transaction |
| Idempotency keys on all outbox entries | MUST | Client-generated UUID/ULID or `entityId-version` |
| WorkManager for background sync | MUST | Not AlarmManager, not JobScheduler, not custom Services |
| NetworkCallback for connectivity | MUST | Real-time state via `callbackFlow`, not polling |
| Exponential backoff on failures | MUST | WorkManager `BackoffPolicy.EXPONENTIAL` with 30s initial |
| Soft-delete before sync | MUST | Never hard-delete records that have not been confirmed by server |
| Sync status indicator in UI | SHOULD | Show pending count and current sync state |
| Priority-based outbox ordering | SHOULD | Critical operations sync before analytics |
| Cache TTL per data type | SHOULD | 5-15 min stable, 1-5 min volatile |
| Conflict resolution strategy per entity | SHOULD | LWW for profiles, server-authoritative for prices |
