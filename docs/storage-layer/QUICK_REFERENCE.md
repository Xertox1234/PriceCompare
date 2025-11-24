# Storage Layer Quick Reference

**For Phases 4-11 of the storage refactoring project**

## Step-by-Step Implementation Guide

### 1. Create the Interface
```typescript
// server/storage/domain-storage.ts
export interface IDomainStorage {
  // List all methods with explicit types
  getAll(): Promise<Entity[]>;
  getById(id: number): Promise<Entity | null>;
  create(data: InsertEntity): Promise<Entity>;
  update(id: number, data: Partial<InsertEntity>): Promise<Entity | null>;
  delete(id: number): Promise<boolean>;
}
```

### 2. Create Constants
```typescript
const DOMAIN_CONSTANTS = {
  QUERY: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
  VALIDATION: {
    MIN_ID: 1,
  },
} as const;
```

### 3. Implement Class
```typescript
export class DomainStorage extends BaseStorage implements IDomainStorage {
  // Implementation
}
```

### 4. Method Template
```typescript
/**
 * Get entity by ID
 *
 * @param id - Entity ID (must be positive)
 * @returns Entity or null if not found
 */
async getById(id: number): Promise<Entity | null> {
  return this.handleError('getById', async () => {
    // Validation
    if (!id || id <= 0) {
      throw new Error('ID must be a positive number');
    }

    // Query - use select().from() pattern
    const [entity] = await this.db
      .select()
      .from(entities)
      .where(eq(entities.id, id))
      .limit(1);

    return entity || null;
  });
}
```

## Pre-Implementation Checklist

- [ ] Count methods in domain (target: 10-20, max: 35)
- [ ] Identify PostgreSQL extensions needed
- [ ] List all related tables
- [ ] Identify transaction requirements
- [ ] Plan performance optimizations

## Implementation Checklist

### Structure
- [ ] Interface defined (`IDomainStorage`)
- [ ] Constants extracted (`DOMAIN_CONSTANTS`)
- [ ] Class extends `BaseStorage`
- [ ] All methods from `storage.ts` extracted

### Quality
- [ ] No `any` types (search: `any`)
- [ ] All methods have JSDoc
- [ ] Input validation on all methods
- [ ] Error handling via `handleError()`

### Performance
- [ ] No N+1 queries (no queries in loops)
- [ ] Database aggregation where applicable
- [ ] Pagination on list methods
- [ ] Transactions for multi-step operations

### Testing
- [ ] Run existing tests: `npm test server/tests/storage.test.ts`
- [ ] TypeScript check: `npm run check`
- [ ] No breaking changes

## Common Patterns Copy-Paste

### Get All with Pagination
```typescript
async getAll(limit = DOMAIN_CONSTANTS.QUERY.DEFAULT_LIMIT, offset = 0): Promise<Entity[]> {
  return this.handleError('getAll', async () => {
    if (limit <= 0) throw new Error('Limit must be positive');
    if (offset < 0) throw new Error('Offset cannot be negative');

    return await this.db
      .select()
      .from(entities)
      .limit(Math.min(limit, DOMAIN_CONSTANTS.QUERY.MAX_LIMIT))
      .offset(offset);
  });
}
```

### Create with Validation
```typescript
async create(data: InsertEntity): Promise<Entity> {
  return this.handleError('create', async () => {
    // Validation
    if (!data.name?.trim()) {
      throw new Error('Name is required');
    }

    const [created] = await this.db
      .insert(entities)
      .values(data)
      .returning();

    return created;
  });
}
```

### Update with Existence Check
```typescript
async update(id: number, updates: Partial<InsertEntity>): Promise<Entity | null> {
  return this.handleError('update', async () => {
    if (!id || id <= 0) {
      throw new Error('ID must be positive');
    }

    if (!updates || Object.keys(updates).length === 0) {
      this.logDebug('update', { id, reason: 'No updates provided' });
      return null;
    }

    // Check existence
    const existing = await this.getById(id);
    if (!existing) return null;

    const [updated] = await this.db
      .update(entities)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(entities.id, id))
      .returning();

    return updated;
  });
}
```

### Delete with Cascade
```typescript
async delete(id: number): Promise<boolean> {
  return this.handleError('delete', async () => {
    if (!id || id <= 0) {
      throw new Error('ID must be positive');
    }

    const result = await this.db
      .delete(entities)
      .where(eq(entities.id, id));

    return result.rowCount > 0;
  });
}
```

### Batch Operation with Transaction
```typescript
async createBatch(items: InsertEntity[]): Promise<Entity[]> {
  return this.handleError('createBatch', async () => {
    if (!items || items.length === 0) {
      return [];
    }

    return await this.executeTransaction(async (tx) => {
      const results = [];
      for (const item of items) {
        const [created] = await tx
          .insert(entities)
          .values(item)
          .returning();
        results.push(created);
      }
      return results;
    });
  });
}
```

### Search with Filters
```typescript
async search(filters: SearchFilters): Promise<SearchResult> {
  return this.handleError('search', async () => {
    const conditions = [];

    if (filters.query) {
      conditions.push(
        or(
          like(entities.name, `%${filters.query}%`),
          like(entities.description, `%${filters.query}%`)
        )
      );
    }

    if (filters.category) {
      conditions.push(eq(entities.category, filters.category));
    }

    const query = this.db
      .select()
      .from(entities)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(filters.limit || DOMAIN_CONSTANTS.QUERY.DEFAULT_LIMIT)
      .offset(filters.offset || 0);

    const [results, countResult] = await Promise.all([
      query,
      this.db.select({ count: sql<number>`count(*)` })
        .from(entities)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
    ]);

    return {
      items: results,
      total: countResult[0]?.count || 0
    };
  });
}
```

## Phase-Specific Notes

### Phase 4: Retailer Storage (~10 methods)
- Simple domain, good for establishing patterns
- No complex queries expected
- Focus on affiliate link management

### Phase 5: Alert Storage (~15 methods)
- Involves user relationships
- Transaction for alert + notification
- Consider batch operations for checking

### Phase 6: Search/Monitoring Storage (~12 methods)
- Complex queries with aggregation
- Performance critical
- May need caching layer

### Phase 7: Forum Storage (~20 methods)
- Large domain, consider splitting
- Complex relationships (topics/posts/replies)
- Transaction heavy (post + stats update)

### Phase 8: Watchlist Storage (~8 methods)
- Simple CRUD mostly
- Batch operations for import/export
- User relationship management

### Phase 9: Price History Storage (~15 methods)
- Time-series data patterns
- Aggregation heavy
- Consider partitioning strategies

### Phase 10: Notification Storage (~10 methods)
- Queue-like operations
- Soft deletes potentially
- Batch marking as read

### Phase 11: Community Storage (~12 methods)
- Social features
- Reputation calculations
- Complex joins potentially

## Gotchas to Avoid

1. **Don't mix query patterns** - Pick `select().from()` and stick with it
2. **Don't forget validation** - Every input needs checking
3. **Don't return undefined** - Use `null` for not found
4. **Don't query in loops** - Use `inArray()` or JOINs
5. **Don't expose passwordHash** - Even in seemingly unrelated domains

## Testing Commands

After implementation:
```bash
# Type check (should pass)
npm run check

# Run storage tests
npm test server/tests/storage.test.ts

# Check for any types
grep -r "any" server/storage/domain-storage.ts

# Check for N+1 patterns
grep -r "for.*await.*db\." server/storage/domain-storage.ts
```

## Review Process

1. Self-review with `/docs/STORAGE_LAYER_PATTERNS.md`
2. Run through quality checklist
3. Get code review from storage-layer-reviewer agent
4. Address feedback
5. Commit with clear message

## Commit Message Template

```
Phase X: Extract [Domain] Storage (~Y methods)

- Created I[Domain]Storage interface with Y methods
- Implemented [Domain]Storage extending BaseStorage
- Extracted [DOMAIN]_CONSTANTS for magic numbers
- Added comprehensive JSDoc documentation
- Maintained type safety (no any types)
- All Z storage tests passing

Part of #121
```

## Questions?

Refer to:
- `/docs/STORAGE_LAYER_PATTERNS.md` - Comprehensive patterns
- `/server/storage/user-storage.ts` - Quality template (9.5/10)
- `/server/storage/product-storage.ts` - Complex example (35 methods)
- `/.claude/agents/storage-layer-reviewer.md` - Review criteria