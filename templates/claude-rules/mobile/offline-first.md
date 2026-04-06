---
paths:
  - shared/**/data/**
  - "**/sync/**"
standard_type: aspirational
---

# Offline-First Architecture

> **Standard note:** This rule describes the _target_ coding standard. The project may
> currently use different patterns. When editing existing code, follow the patterns
> established in the codebase. When writing new code, prefer these patterns.

> Full reference: `docs/mobile/05-offline-first.md`

## Source of Truth

SQLDelight is the single source of truth. The UI always reads from the local database, never directly from the network:

```
Network API  -->  Repository  -->  SQLDelight (source of truth)  -->  UI
                      |                    ^
                      |                    |
                      +--- sync engine ----+
```

Display cached data immediately, then sync in the background. The user should never see a blank screen because of network latency.

## Sync States

Every syncable entity tracks its sync status:

```kotlin
enum class SyncStatus {
    PENDING,    // Created/modified locally, not yet synced
    SYNCING,    // Sync in progress
    SYNCED,     // Successfully synced with server
    CONFLICT,   // Server and local versions diverge
    FAILED,     // Sync attempted and failed
}
```

Expose sync status in the UI so users know what has been persisted server-side.

## Outbox Pattern

Write local changes and sync records in a single transaction:

```kotlin
suspend fun createOrder(order: Order) {
    database.transaction {
        orderQueries.insert(order.copy(syncStatus = SyncStatus.PENDING))
        outboxQueries.insert(
            OutboxEntry(
                id = uuid4().toString(),
                entityType = "order",
                entityId = order.id,
                operation = "CREATE",
                payload = json.encodeToString(order),
                createdAt = Clock.System.now(),
            )
        )
    }
}
```

The sync engine processes outbox entries in FIFO order, retrying failures with exponential backoff.

## Background Sync

Use WorkManager (Android) for reliable background sync:

```kotlin
class SyncWorker(
    context: Context,
    params: WorkerParameters,
    private val syncEngine: SyncEngine,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return when (syncEngine.syncAll()) {
            is SyncResult.Success -> Result.success()
            is SyncResult.Retry -> Result.retry()
            is SyncResult.Failure -> Result.failure()
        }
    }
}

// Schedule periodic sync
val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(
    repeatInterval = 15, repeatIntervalTimeUnit = TimeUnit.MINUTES,
).setConstraints(
    Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()
).build()
```

On iOS, use `BGTaskScheduler` with equivalent constraints.

## Conflict Resolution

Choose a strategy per entity type:

- **Last-Write-Wins (LWW)**: Compare timestamps; latest write wins. Simple but can lose data.
- **Hybrid Logical Clocks (HLC)**: Combine physical time + logical counter for causal ordering.
- **CRDTs**: For collaborative data (counters, sets) where all concurrent operations merge without conflict.

Default to LWW for most entities. Use HLC or CRDTs only when concurrent edits are expected.

```kotlin
fun resolveConflict(local: Entity, remote: Entity): Entity {
    return when (conflictStrategy) {
        LWW -> if (remote.updatedAt > local.updatedAt) remote else local
        SERVER_WINS -> remote
        CLIENT_WINS -> local
        MANUAL -> local.copy(syncStatus = SyncStatus.CONFLICT)
    }
}
```

## Idempotency

Every write operation must include a client-generated UUID:

```kotlin
data class CreateOrderRequest(
    val clientId: String = uuid4().toString(),  // Idempotency key
    val items: List<OrderItem>,
)
```

The server uses `clientId` to deduplicate retried requests. If a sync retry sends the same `clientId`, the server returns the existing result instead of creating a duplicate.

## Key Rules

| Rule | Detail |
|------|--------|
| Source of truth | SQLDelight local database, never network directly |
| Display strategy | Cached data first, background sync after |
| Transactional writes | Outbox pattern -- entity + outbox entry in one transaction |
| Sync scheduling | WorkManager (Android) / BGTaskScheduler (iOS) |
| Conflict default | Last-Write-Wins unless concurrent edits expected |
| Idempotency | Client UUID on every write request |
| Sync status | Every syncable entity tracks `SyncStatus` |
