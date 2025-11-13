import { db } from '../db';
import { products, productOffers, retailers } from '@shared/schema';
import { eq, like, or, and, desc, isNotNull, sql, count } from 'drizzle-orm';

/**
 * Fallback product discovery service for when external APIs are unavailable
 * Uses database and search patterns to find relevant products
 */
export class ProductDiscoveryFallback {
  
  /**
   * Search existing products in database with intelligent matching
   */
  async searchExistingProducts(query: string, maxResults = 10) {
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    
    const searchResults = await db.query.products.findMany({
      where: or(
        ...searchTerms.map(term =>
          or(
            like(products.name, `%${term}%`),
            like(products.description, `%${term}%`),
            like(products.category, `%${term}%`),
            like(products.brand, `%${term}%`)
          )
        )
      ),
      with: {
        offers: {
          with: {
            retailer: true
          }
        }
      },
      limit: maxResults
    });

    return searchResults.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      brand: product.brand,
      image: product.image,
      offers: (product.offers || []).map((offer: any) => ({
        id: offer.id,
        price: offer.price,
        availability: offer.availability,
        retailer: offer.retailer?.name || 'Unknown',
        productUrl: offer.productUrl
      }))
    }));
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
    const categories = await db
      .select({
        category: products.category,
        count: count()
      })
      .from(products)
      .where(isNotNull(products.category))
      .groupBy(products.category)
      .orderBy(desc(count()))
      .limit(limit);

    return categories.map(cat => ({
      name: cat.category as string,
      productCount: Number(cat.count),
      searchUrl: `/products?category=${encodeURIComponent(cat.category as string)}`
    }));
  }

  /**
   * Generate search suggestions based on database content
   */
  async getSearchSuggestions(query: string, limit = 5): Promise<string[]> {
    const searchTerm = query.toLowerCase();
    
    // Get similar product names from database
    const similarProducts = await db.query.products.findMany({
      where: or(
        like(products.name, `%${searchTerm}%`),
        like(products.brand, `%${searchTerm}%`)
      ),
      columns: {
        name: true,
        brand: true
      },
      limit: limit * 2
    });

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