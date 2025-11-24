import { storage } from '../storage';
import type { ProductCategoryCount, ProductSuggestion } from '../storage';
import type { Product, ProductOffer, Retailer } from '@shared/schema';

/** Product with offers from query result */
interface ProductWithOffers extends Product {
  offers?: Array<ProductOffer & { retailer?: Retailer | null }>;
}

/**
 * Fallback product discovery service for when external APIs are unavailable
 * Uses database and search patterns to find relevant products
 *
 * Phase 6 Storage Migration: All database queries replaced with storage layer abstraction
 */
export class ProductDiscoveryFallback {
  
  /**
   * Search existing products in database with intelligent matching
   */
  async searchExistingProducts(query: string, maxResults = 10) {
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);

    // Use storage layer for product search
    const searchResults = await storage.searchProductsByTerms(searchTerms, maxResults);

    return searchResults.map((product) => {
      const typedProduct = product as ProductWithOffers;
      return {
        id: typedProduct.id,
        name: typedProduct.name,
        description: typedProduct.description,
        category: typedProduct.category,
        brand: typedProduct.brand,
        image: typedProduct.image,
        offers: (typedProduct.offers || []).map((offer) => ({
          id: offer.id,
          price: offer.price,
          availability: offer.availability,
          retailer: offer.retailer?.name || 'Unknown',
          productUrl: offer.productUrl
        }))
      };
    });
  }

  /**
   * Generate product URLs for manual verification
   */
  generateProductUrls(query: string): string[] {
    const encodedQuery = encodeURIComponent(query);
    return [
      `https://www.amazon.com/s?k=${encodedQuery}`,
      `https://www.walmart.com/search?q=${encodedQuery}`,
      `https://www.target.com/s?searchTerm=${encodedQuery}`,
      `https://www.bestbuy.com/site/searchpage.jsp?st=${encodedQuery}`,
      `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}`
    ];
  }

  /**
   * Get trending categories from database activity
   */
  async getTrendingCategories(limit = 5) {
    // Use storage layer for trending categories
    const categories = await storage.getTrendingProductCategories(limit);

    // Map to match existing return format
    return categories.map(cat => ({
      name: cat.category,
      productCount: cat.count,
      searchUrl: `/products?category=${encodeURIComponent(cat.category)}`
    }));
  }

  /**
   * Generate search suggestions based on database content
   */
  async getSearchSuggestions(query: string, limit = 5): Promise<string[]> {
    const searchTerm = query.toLowerCase();

    // Use storage layer for product suggestions
    const similarProducts = await storage.getProductSearchSuggestions(searchTerm, limit * 2);

    // Extract meaningful suggestions
    const suggestions = new Set<string>();

    similarProducts.forEach(product => {
      // Add product name variations
      const words = product.name.toLowerCase().split(' ');
      words.forEach(word => {
        if (word.length > 3 && word.includes(searchTerm)) {
          suggestions.add(word);
        }
      });

      // Add brand if relevant
      if (product.brand && product.brand.toLowerCase().includes(searchTerm)) {
        suggestions.add(product.brand);
      }
    });

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * Status check for fallback service
   */
  getStatus() {
    return {
      service: 'Database Fallback',
      status: 'operational',
      description: 'Using existing product database for search functionality',
      capabilities: [
        'Product search in existing database',
        'Trending category analysis',
        'Search suggestions',
        'Manual URL generation for verification'
      ]
    };
  }
}

export const productDiscoveryFallback = new ProductDiscoveryFallback();