# Database Patterns

PostgreSQL database patterns with Flyway migrations, JPA entities, and advanced column types.

---

## Flyway Migration Structure

**Why three directories?** Separating schema DDL from seed data and dev-only data prevents accidental deployment of test data to production, keeps schema migrations clean and reviewable, and allows `devdata/` to be loaded only in local profiles without affecting CI or production environments.

Three-directory convention separating schema DDL from seed/reference data:

```
src/main/resources/db/
├── migration/    # Schema DDL only (V__ versioned) -- all environments
├── seed/         # Reference/seed data (R__ repeatable) -- all environments
└── devdata/      # Dev-only sample data -- local profile only
```

### Directory Rules

| Directory | Purpose | Migration Types | Environments |
|-----------|---------|----------------|--------------|
| `db/migration/` | Schema DDL (CREATE, ALTER, DROP, indexes, constraints) | `V__` only | All |
| `db/seed/` | Reference data and one-time data imports | `R__` (evolving) + `V__` (one-time) | All |
| `db/devdata/` | Dev-only sample data for local testing | `R__` or `V__` | Local only |

### Naming Conventions

**Versioned migrations** (`V__`): `V{N}__{snake_case_description}.sql`
- Single global version sequence across ALL directories
- **Always check both `db/migration/` and `db/seed/` before assigning a version number**
- DDL goes in `db/migration/`, one-time data imports go in `db/seed/`

**Repeatable migrations** (`R__`): `R__{snake_case_description}.sql`
- No version number; ordered alphabetically by description
- Run after all `V__` migrations; re-run when file checksum changes
- Use for reference data that evolves (configuration, lookup tables)
- Must be idempotent (use upsert patterns)

### Profile Configuration

Flyway locations are configured per Spring profile:
- **Production** (`application.yml`): `classpath:db/migration,classpath:db/seed`
- **Local dev** (`application-local.yml`): `classpath:db/migration,classpath:db/seed,classpath:db/devdata`
- **Test** (`application-test.yml`): `classpath:db/migration,classpath:db/seed`

### Upsert Patterns

**Evolving reference data** (edits should propagate on deploy):

```sql
INSERT INTO categories (...) VALUES (...)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;
```

**Config/content seed data** (preserve runtime state):

```sql
INSERT INTO feature_config (domain, enabled)
VALUES ('notifications', false)
ON CONFLICT (domain) DO NOTHING;
```

### Best Practices

- Use `IF NOT EXISTS` for idempotent migrations
- Add indexes for frequently queried columns and foreign key columns
- Include rollback instructions in comments for complex changes
- Test migrations on database copy before production
- UUID primary keys, `TIMESTAMP WITH TIME ZONE` for dates

---

## Entity Base Classes

Two-level hierarchy with Spring Data JPA Auditing (`@EnableJpaAuditing`):

### CreatableEntity (Immutable, Creation-Only Audit)

```kotlin
@MappedSuperclass
@EntityListeners(AuditingEntityListener::class)
abstract class CreatableEntity {
    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant = Instant.now()

    @CreatedBy
    @Column(name = "created_by", updatable = false)
    var createdBy: UUID? = null
}
```

### AuditableEntity (Mutable, Full Audit Trail)

```kotlin
@MappedSuperclass
abstract class AuditableEntity : CreatableEntity() {
    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()

    @LastModifiedBy
    @Column(name = "updated_by")
    var updatedBy: UUID? = null
}
```

All timestamps use `Instant` (TIMESTAMPTZ in DB). `AuditorAware<UUID>` resolves from `SecurityContextHolder`.

---

## UUID Primary Keys

```kotlin
@Id
@GeneratedValue(strategy = GenerationType.UUID)
var id: UUID? = null
```

---

## Single Table Inheritance

```kotlin
@Entity
@Table(name = "products")
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "product_type", discriminatorType = DiscriminatorType.STRING)
abstract class Product : AuditableEntity() {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null

    @Column(nullable = false)
    var name: String = ""

    @Column(nullable = false)
    var price: BigDecimal = BigDecimal.ZERO
}

@Entity
@DiscriminatorValue("PHYSICAL")
class PhysicalProduct : Product() {
    var weight: Double? = null
    var dimensions: String? = null
}

@Entity
@DiscriminatorValue("DIGITAL")
class DigitalProduct : Product() {
    var downloadUrl: String? = null
    var fileSize: Long? = null
}
```

---

## JSONB Columns

### String JSONB (Raw JSON)

```kotlin
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes

@Column(name = "metadata", columnDefinition = "jsonb")
@JdbcTypeCode(SqlTypes.JSON)
var metadata: String? = null
```

### Typed JSONB (Data Class)

```kotlin
@Column(name = "preferences", columnDefinition = "jsonb")
@JdbcTypeCode(SqlTypes.JSON)
var preferences: UserPreferences = UserPreferences()
```

### JSONB Translations Pattern

For entities with multilingual content, store translations as a JSONB map:

```kotlin
@Column(name = "translations", columnDefinition = "jsonb")
@JdbcTypeCode(SqlTypes.JSON)
var translations: Map<String, TranslationDto> = emptyMap()

fun getTranslationOrDefault(language: String): TranslationDto {
    return translations[language]
        ?: translations["en"]           // Fallback to default
        ?: translations.values.first()  // Fallback to first available
}

data class TranslationDto(
    val title: String,
    val description: String?,
)
```

---

## PostgreSQL Arrays

```kotlin
@Column(name = "tags", columnDefinition = "TEXT[]")
@JdbcTypeCode(SqlTypes.ARRAY)
var tags: Array<String>? = null
```

---

## Enum Mapping

### String Enum (VARCHAR Column)

```kotlin
@Enumerated(EnumType.STRING)
@Column(nullable = false)
var status: OrderStatus = OrderStatus.PENDING
```

### PostgreSQL Native Enum (CREATE TYPE)

```kotlin
@Enumerated(EnumType.STRING)
@Column(name = "status", nullable = false)
@JdbcTypeCode(SqlTypes.NAMED_ENUM)
var status: OrderStatus = OrderStatus.PENDING
```

Matching migration:

```sql
CREATE TYPE order_status AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');
```

---

## Full-Text Search

PostgreSQL `search_vector` with `plainto_tsquery`:

```kotlin
@Query(
    value = """
    SELECT * FROM products
    WHERE search_vector @@ plainto_tsquery('english', :query)
    AND status = 'ACTIVE'
    ORDER BY ts_rank(search_vector, plainto_tsquery('english', :query)) DESC
    """,
    countQuery = """
    SELECT COUNT(*) FROM products
    WHERE search_vector @@ plainto_tsquery('english', :query)
    AND status = 'ACTIVE'
    """,
    nativeQuery = true,
)
fun searchByQuery(
    @Param("query") query: String,
    pageable: Pageable,
): Page<Product>
```

Migration to create the search vector:

```sql
ALTER TABLE products ADD COLUMN search_vector tsvector;
CREATE INDEX idx_products_search ON products USING GIN(search_vector);

-- Trigger to auto-update search vector
CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_search_vector_trigger
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION products_search_vector_update();
```

---

## Index and Foreign Key Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Index | `idx_{table}_{column}` | `idx_products_slug` |
| Unique index | `idx_{table}_{column}_unique` | `idx_users_email_unique` |
| Foreign key | `fk_{table}_{referenced}` | `fk_order_items_orders` |
| GIN index | `idx_{table}_{column}_gin` | `idx_products_search` |

Always add indexes for:
- Foreign key columns
- Columns used in WHERE clauses
- Columns used in ORDER BY
- Full-text search vectors (GIN)
