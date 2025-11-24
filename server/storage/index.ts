/**
 * Storage Layer Facade
 *
 * This file provides a unified interface to all domain-specific storage repositories.
 * It implements the Facade pattern to maintain backward compatibility while enabling
 * modular, domain-driven design.
 *
 * Architecture:
 * - Each domain (User, Product, Price, etc.) has its own repository class
 * - The DatabaseStorage class composes all domain repositories
 * - All methods delegate to the appropriate domain repository
 * - The IStorage interface extends all domain interfaces
 *
 * This pattern enables:
 * - Zero breaking changes to existing code
 * - Clear domain boundaries
 * - Easier testing and maintenance
 * - Better code organization
 *
 * Usage:
 * ```typescript
 * import { storage } from './storage';
 *
 * // All existing code continues to work
 * const products = await storage.getProducts();
 * const user = await storage.getUserById(123);
 * ```
 */

// Re-export all types for convenience
export * from './types';

// Re-export domain interfaces
export type { IUserStorage } from './user-storage';

// Import the original IStorage interface and storage implementation
// Phase 2: UserStorage is implemented but not yet integrated into facade
// (IStorage has duplicate method signatures that need to be resolved first)
import { storage as originalStorage, type IStorage } from '../storage';

/**
 * Unified Storage Interface
 *
 * Currently just re-exports the original IStorage interface.
 * As we migrate domains, this will be composed from domain-specific interfaces:
 *
 * export interface IStorage extends
 *   IUserStorage,
 *   IProductStorage,
 *   IPriceStorage,
 *   ... {
 * }
 */
export type { IStorage };

/**
 * Main storage instance
 *
 * Phase 1: Re-export original storage (no breaking changes)
 * Phase 2+: Gradually replace with domain-specific repositories
 *
 * This ensures existing code continues to work while we incrementally
 * refactor the storage layer.
 */
export const storage: IStorage = originalStorage;

/**
 * Database Storage Class
 *
 * Future implementation will compose domain repositories:
 *
 * ```typescript
 * export class DatabaseStorage implements IStorage {
 *   private userStorage: UserStorage;
 *   private productStorage: ProductStorage;
 *   // ... other repositories
 *
 *   constructor(db: NodePgDatabase) {
 *     this.userStorage = new UserStorage(db);
 *     this.productStorage = new ProductStorage(db);
 *     // ... initialize other repositories
 *   }
 *
 *   // Delegate to domain repositories
 *   async getUserById(id: number) {
 *     return this.userStorage.getUserById(id);
 *   }
 *
 *   async getProducts() {
 *     return this.productStorage.getProducts();
 *   }
 *   // ... delegate all methods
 * }
 * ```
 *
 * For now, we just re-export the original implementation to maintain
 * backward compatibility during Phase 1.
 */

// Phase 1 Complete: Foundation is in place
// - Types extracted to storage/types.ts
// - BaseStorage class created for common utilities
// - Facade structure established in storage/index.ts
// - All existing code continues to work unchanged
//
// Phase 2 In Progress: UserStorage domain extracted
// - ✅ IUserStorage interface created with 8 methods
// - ✅ UserStorage class implemented extending BaseStorage
// - ⏳ Integration into facade pending (IStorage has duplicate signatures)
// - ⏳ Unit tests pending
//
// Note: The original IStorage has duplicate method signatures (getAllUsers
// returns both SafeUser[] and AdminUser[]). This needs to be resolved before
// integrating UserStorage into the facade.
//
// Next Steps (Phase 2 completion):
// 1. Resolve duplicate method signatures in IStorage
// 2. Integrate UserStorage into facade
// 3. Add comprehensive unit tests for UserStorage
// 4. Update routes to use new storage/index.ts path
