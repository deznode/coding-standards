---
paths: apps/api/**
standard_type: aspirational
---

# Database Patterns

> **Standard note:** This rule describes the _target_ coding standard. The project may
> currently use different patterns. When editing existing code, follow the patterns
> established in the codebase. When writing new code, prefer these patterns.

> Full reference: `docs/backend/04-database-patterns.md`

## Flyway Migration Structure

```
src/main/resources/db/
  migration/    # Schema DDL only (V__ versioned) -- all environments
  seed/         # Reference/seed data (R__ repeatable) -- all environments
  devdata/      # Dev-only sample data -- local profile only
```

### Naming

- **Versioned**: `V{N}__{snake_case_description}.sql` -- single global sequence across ALL directories
- **Repeatable**: `R__{snake_case_description}.sql` -- must be idempotent (upsert patterns)
- **Always check both** `db/migration/` and `db/seed/` before assigning a version number

### Upsert Patterns

```sql
-- Evolving reference data (overwrite on deploy)
INSERT INTO categories (...) VALUES (...)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

-- Config seed data (preserve runtime state)
INSERT INTO feature_config (domain, enabled) VALUES ('notifications', false)
ON CONFLICT (domain) DO NOTHING;
```

## Entity Base Classes

Two-level hierarchy with JPA Auditing:

```kotlin
// Immutable records -- creation audit only
abstract class CreatableEntity {
    @CreatedDate var createdAt: Instant = Instant.now()
    @CreatedBy var createdBy: UUID? = null
}

// Mutable records -- full audit trail
abstract class AuditableEntity : CreatableEntity() {
    @LastModifiedDate var updatedAt: Instant = Instant.now()
    @LastModifiedBy var updatedBy: UUID? = null
}
```

All timestamps use `Instant` (TIMESTAMPTZ in DB). `AuditorAware<UUID>` resolves from `SecurityContextHolder`.

## UUID Primary Keys

```kotlin
@Id
@GeneratedValue(strategy = GenerationType.UUID)
var id: UUID? = null
```

## JSONB Columns

```kotlin
@Column(name = "metadata", columnDefinition = "jsonb")
@JdbcTypeCode(SqlTypes.JSON)
var metadata: String? = null          // Raw JSON

@Column(name = "preferences", columnDefinition = "jsonb")
@JdbcTypeCode(SqlTypes.JSON)
var preferences: UserPreferences = UserPreferences()  // Typed
```

## PostgreSQL Enum Mapping

```kotlin
// String enum (VARCHAR)
@Enumerated(EnumType.STRING)
var status: OrderStatus = OrderStatus.PENDING

// Native PostgreSQL enum (CREATE TYPE)
@Enumerated(EnumType.STRING)
@JdbcTypeCode(SqlTypes.NAMED_ENUM)
var status: OrderStatus = OrderStatus.PENDING
```

## Index Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Index | `idx_{table}_{column}` | `idx_products_slug` |
| Unique | `idx_{table}_{column}_unique` | `idx_users_email_unique` |
| Foreign key | `fk_{table}_{referenced}` | `fk_order_items_orders` |
| GIN index | `idx_{table}_{column}_gin` | `idx_products_search` |

Always index: FK columns, WHERE clause columns, ORDER BY columns, FTS vectors (GIN).

## Best Practices

- Use `IF NOT EXISTS` for idempotent DDL
- UUID primary keys, `TIMESTAMP WITH TIME ZONE` for dates
- Include rollback instructions in comments for complex migrations
- Profile config: production uses `migration + seed`, local adds `devdata`
