/**
 * Storage Layer Facade
 *
 * This module provides a unified interface to all domain-specific storage repositories.
 * During Phase 1 (Foundation), this facade simply re-exports from the parent storage.ts
 * to establish the structure. Future phases will gradually extract domain modules and
 * integrate them through this facade, maintaining backward compatibility.
 *
 * Phase 1: Foundation - Facade structure established
 * Phase 2+: Domain repositories will be added and integrated here
 *
 * IMPORTANT: This facade maintains ZERO breaking changes - all existing imports continue to work.
 */

// Re-export the IStorage interface (will be assembled from domain interfaces in later phases)
export type { IStorage } from "../storage";

// Re-export all type definitions from the new centralized types module
export * from "./types";

// Re-export the base storage class for domain repositories (Phase 2+)
export { BaseStorage } from "./base-storage";

// For now, re-export the storage implementation from parent
// In future phases, this will be replaced with:
// export const storage = new DatabaseStorage(db);
// where DatabaseStorage composes domain repositories
export { storage } from "../storage";

/**
 * Future Phase 2+ Structure (Planned):
 *
 * import { db } from "../db";
 * import { UserStorage } from "./domains/user-storage";
 * import { ProductStorage } from "./domains/product-storage";
 * import { PriceStorage } from "./domains/price-storage";
 * // ... other domain imports
 *
 * export class DatabaseStorage implements IStorage {
 *   private userStorage: UserStorage;
 *   private productStorage: ProductStorage;
 *   private priceStorage: PriceStorage;
 *   // ... other domain repositories
 *
 *   constructor(database: Database) {
 *     this.userStorage = new UserStorage(database);
 *     this.productStorage = new ProductStorage(database);
 *     this.priceStorage = new PriceStorage(database);
 *     // ... initialize other repositories
 *   }
 *
 *   // Delegate methods to appropriate domain repositories:
 *   async getUserById(id: number) {
 *     return this.userStorage.getUserById(id);
 *   }
 *
 *   async getProductById(id: number) {
 *     return this.productStorage.getProductById(id);
 *   }
 *   // ... other delegated methods
 * }
 *
 * export const storage = new DatabaseStorage(db);
 */
