# Phase 3: Product Storage Domain Analysis

**Date:** 2025-11-24
**Status:** 🔄 In Progress
**Previous Phase:** [Phase 2 Final Improvements](./phase-2-final-improvements.md)

## Overview

Phase 3 extracts the **Product Storage domain** from the monolithic `server/storage.ts` file. This is the largest and most complex domain, encompassing product CRUD, product offers, specifications, search functionality, and embeddings.

## Product Domain Scope

### Core Product Operations (7 methods)
1. `getProducts()` - Get all products
2. `createProduct()` - Create new product
3. `updateProduct()` - Update product fields
4. `deleteProduct()` - Delete product
5. `getProductById()` - Get product with offers
6. `getProductByIdRaw()` - Get raw product (no offers)
7. `getProductByUrl()` - Find product by URL

### Product Offers (6 methods)
8. `getProductOffers()` - Get offers for product (with retailer)
9. `createProductOffer()` - Create new offer
10. `getProductOfferById()` - Get single offer
11. `updateProductOfferAffiliateLink()` - Update affiliate link data
12. `getProductOffersByRetailerId()` - Get offers by retailer
13. `getProductOfferWithProduct()` - Get offer with product details

### Product Specifications (7 methods)
14. `getProductSpecifications()` - Get specs for product
15. `getProductSpecificationsGrouped()` - Get grouped specifications
16. `createProductSpecification()` - Create single spec
17. `createProductSpecificationsBatch()` - Batch create specs
18. `updateProductSpecification()` - Update spec
19. `deleteProductSpecification()` - Delete single spec
20. `deleteProductSpecifications()` - Delete all product specs
21. `getProductFull()` - Get product with specs and offers

### Advanced Search (8 methods)
22. `searchProducts()` - Basic search with filters
23. `searchProductsByTerms()` - Multi-term search
24. `getProductSearchSuggestions()` - Autocomplete suggestions
25. `searchProductsExact()` - Exact match search
26. `searchProductsFuzzy()` - Fuzzy matching search
27. `searchProductsBySynonyms()` - Synonym-based search
28. `searchProductsSemantic()` - Vector embedding search
29. `getProductAutocompleteSuggestions()` - Enhanced autocomplete

### Product Embeddings (2 methods)
30. `getProductForEmbedding()` - Get product data for embedding generation
31. `updateProductEmbedding()` - Store product embedding vector

### Snapshot & Analytics (2 methods)
32. `getProductOffersForSnapshot()` - Batch fetch for price snapshots
33. `getProductOffersCount()` - Count total offers

### Related Operations (2 methods)
34. `getProductWatchCountByProduct()` - Count watches on product
35. `getProductOfferDetailsForAlert()` - Get offer for alert notification

**Total Methods: 35** (largest domain by far)

## Complexity Analysis

### High Complexity Methods
- `searchProducts()` - Multiple filters, JOINs, aggregation
- `searchProductsSemantic()` - Vector similarity search
- `getProductFull()` - Multiple JOINs (specs + offers)
- `createProductSpecificationsBatch()` - Batch operations
- `getProductByUrl()` - URL normalization logic

### Medium Complexity Methods
- `getProductById()` - JOIN with offers
- `getProductOffers()` - JOIN with retailers
- `searchProductsByTerms()` - Multi-term text search
- `searchProductsFuzzy()` - Similarity threshold matching
- `getProductSpecificationsGrouped()` - Grouping logic

### Low Complexity Methods
- `getProducts()` - Simple SELECT
- `createProduct()` - Simple INSERT
- `updateProduct()` - Simple UPDATE
- `deleteProduct()` - Simple DELETE
- `getProductByIdRaw()` - Simple SELECT by ID

## Domain Dependencies

### Direct Dependencies
- **Retailers** - Product offers reference retailers
- **ProductWatch** - Watch counts reference products
- **Price Alerts** - Alert details reference product offers
- **Price Snapshots** - Snapshot jobs query product offers

### Security Considerations
- No sensitive data like passwordHash
- URL validation for product URLs
- Affiliate link integrity checks
- Embedding data privacy (ML models)

## Transaction Requirements

### Methods Requiring Transactions
1. `createProductSpecificationsBatch()` - Atomic batch insert
2. Potentially `deleteProduct()` - If offers/specs cascade is manual

### Methods NOT Requiring Transactions
- All read-only methods (safe)
- Single INSERT/UPDATE operations (atomic by default)

## Quality Checklist (from UserStorage)

Applying the Phase 2 quality template:

- [ ] Extends BaseStorage for error handling
- [ ] Uses explicit field selection (where applicable)
- [ ] Validates input bounds before operations
- [ ] Checks entity existence before updates
- [ ] Uses transactions for multi-step operations
- [ ] Creates CONSTANTS for magic numbers
- [ ] No `any` types - proper typing throughout
- [ ] Adds audit logging for sensitive operations
- [ ] Comprehensive JSDoc with security notes
- [ ] All tests passing after implementation

## Type Definitions Required

From `storage/types.ts`:
- ✅ `Product` - Already exists
- ✅ `InsertProduct` - Already exists
- ✅ `ProductOffer` - Already exists
- ✅ `InsertProductOffer` - Already exists
- ✅ `ProductSpecification` - Already exists
- ✅ `InsertProductSpecification` - Already exists
- ✅ `ProductWithOffers` - Already exists
- ✅ `ProductFull` - Already exists
- ✅ `SearchFilters` - Already exists
- ✅ `ProductSuggestion` - Already exists
- ✅ `ProductForEmbedding` - Already exists
- ✅ `ProductOfferWithProduct` - Already exists
- ✅ `SpecificationGroup` - Already exists

All types already extracted in Phase 1!

## Implementation Strategy

### Step 1: Core CRUD Operations
Start with basic product CRUD to establish pattern:
- getProducts, createProduct, updateProduct, deleteProduct
- getProductById, getProductByIdRaw

### Step 2: Product Offers
Add offer management:
- getProductOffers, createProductOffer
- getProductOfferById, updateProductOfferAffiliateLink
- getProductOffersByRetailerId

### Step 3: Specifications
Add specification management:
- getProductSpecifications, createProductSpecification
- createProductSpecificationsBatch, updateProductSpecification
- deleteProductSpecification, deleteProductSpecifications
- getProductSpecificationsGrouped, getProductFull

### Step 4: Search & Discovery
Add search functionality:
- searchProducts (basic)
- searchProductsByTerms, getProductSearchSuggestions
- searchProductsExact, searchProductsFuzzy
- searchProductsBySynonyms, searchProductsSemantic
- getProductAutocompleteSuggestions

### Step 5: Embeddings & Utilities
Add remaining methods:
- getProductForEmbedding, updateProductEmbedding
- getProductOffersForSnapshot, getProductOffersCount
- getProductWatchCountByProduct, getProductOfferDetailsForAlert
- getProductByUrl

## Estimated Effort

**Phase 2 (UserStorage):** 8 methods, ~6 hours total
**Phase 3 (ProductStorage):** 35 methods, estimated ~12-15 hours

**Complexity multiplier:** 2x (advanced search, embeddings, multiple relationships)

## File Size Estimate

**UserStorage:** 332 lines
**ProductStorage:** Estimated ~800-1000 lines (largest domain file)

## Next Actions

1. Create `IProductStorage` interface with all 35 methods
2. Implement `ProductStorage` class step-by-step
3. Apply quality checklist from Phase 2
4. Add existence checks where appropriate
5. Add PRODUCT_CONSTANTS for magic numbers
6. Document complex search logic
7. Run tests to verify no regressions
8. Update facade to export ProductStorage

## Success Criteria

- ✅ All 35 methods extracted and working
- ✅ All 29 storage tests still passing
- ✅ Code quality score ≥ 9/10
- ✅ Comprehensive documentation
- ✅ Zero breaking changes to existing code
- ✅ Follows UserStorage quality template

---

**Next Step:** Begin implementation with core CRUD operations
