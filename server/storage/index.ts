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

// Import the original IStorage interface and storage implementation
// During Phase 1, we're just creating the structure - actual migration happens in later phases
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
// Next Steps (Phase 2+):
// 1. Create first domain repository (e.g., UserStorage)
// 2. Update facade to delegate user methods to UserStorage
// 3. Repeat for remaining domains
// 4. Gradually replace all references to ../storage.ts with ./storage/
