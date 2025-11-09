/**
 * Unit Tests for AI Prompt Outputs
 *
 * Tests validate that AI prompts produce expected output formats
 * and handle edge cases correctly.
 */

import { validateOutput, parseAndValidateJSON, sanitizeOutput } from '../output-validation';

describe('AI Prompt Output Validation', () => {

  describe('Search Query Generation', () => {
    it('should validate correct search query array', () => {
      const queries = [
        'Sony WH-1000XM5',
        'Sony wireless noise cancelling headphones',
        'WH1000XM5 bluetooth headphones',
        'Sony premium over ear headphones',
        'noise cancelling headphones wireless'
      ];

      const result = validateOutput('search-queries', queries);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject array with too few items', () => {
      const queries = ['Sony WH-1000XM5', 'Sony headphones'];

      const result = validateOutput('search-queries', queries);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('at least 3'))).toBe(true);
    });

    it('should reject array with too many items', () => {
      const queries = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'];

      const result = validateOutput('search-queries', queries);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('at most 5'))).toBe(true);
    });

    it('should reject queries with invalid characters', () => {
      const queries = [
        'Sony WH-1000XM5',
        'Sony @ special #chars',
        'normal query'
      ];

      const result = validateOutput('search-queries', queries);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === '[1]')).toBe(true);
    });
  });

  describe('Trend Analysis Output', () => {
    it('should validate correct trend analysis', () => {
      const trends = [
        {
          originalQuery: 'iPhone 15 Pro',
          normalizedName: 'Apple iPhone 15 Pro',
          category: 'Electronics',
          confidence: 95,
          isProduct: true,
          reason: 'Specific smartphone model sold by all major retailers'
        },
        {
          originalQuery: 'Apple',
          normalizedName: '',
          category: 'Electronics',
          confidence: 20,
          isProduct: false,
          reason: 'Brand name only, no specific product identified'
        }
      ];

      const result = validateOutput('trend-analysis', trends);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing required fields', () => {
      const trends = [
        {
          originalQuery: 'iPhone 15 Pro',
          normalizedName: 'Apple iPhone 15 Pro',
          // Missing category, confidence, isProduct, reason
        }
      ];

      const result = validateOutput('trend-analysis', trends);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('category'))).toBe(true);
      expect(result.errors.some(e => e.message.includes('confidence'))).toBe(true);
    });

    it('should reject invalid category', () => {
      const trends = [
        {
          originalQuery: 'Test Product',
          normalizedName: 'Test Product',
          category: 'InvalidCategory',
          confidence: 80,
          isProduct: true,
          reason: 'Test reason'
        }
      ];

      const result = validateOutput('trend-analysis', trends);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes('category'))).toBe(true);
    });

    it('should reject confidence outside 0-100 range', () => {
      const trends = [
        {
          originalQuery: 'Test',
          normalizedName: 'Test',
          category: 'Electronics',
          confidence: 150,
          isProduct: true,
          reason: 'Test'
        }
      ];

      const result = validateOutput('trend-analysis', trends);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes('confidence'))).toBe(true);
    });

    it('should accept all valid categories', () => {
      const validCategories = [
        'Electronics',
        'Home & Kitchen',
        'Fashion & Apparel',
        'Sports & Outdoors',
        'Health & Beauty',
        'Toys & Games',
        'Books & Media',
        'Automotive',
        'Office & School',
        'Pet Supplies',
        'Other'
      ];

      validCategories.forEach(category => {
        const trends = [{
          originalQuery: 'Test',
          normalizedName: 'Test',
          category,
          confidence: 80,
          isProduct: true,
          reason: 'Test'
        }];

        const result = validateOutput('trend-analysis', trends);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('Search Suggestions Output', () => {
    it('should validate correct suggestions', () => {
      const suggestions = [
        'MacBook Air M2',
        'Dell XPS 13',
        'HP Spectre x360'
      ];

      const result = validateOutput('search-suggestions', suggestions);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require exactly 3 suggestions', () => {
      const tooFew = ['MacBook Air M2', 'Dell XPS 13'];
      const tooMany = ['a', 'b', 'c', 'd'];

      expect(validateOutput('search-suggestions', tooFew).valid).toBe(false);
      expect(validateOutput('search-suggestions', tooMany).valid).toBe(false);
    });

    it('should reject too-short suggestions', () => {
      const suggestions = ['ab', 'Dell XPS 13', 'HP Spectre x360'];

      const result = validateOutput('search-suggestions', suggestions);
      expect(result.valid).toBe(false);
    });
  });

  describe('JSON Parsing and Sanitization', () => {
    it('should extract JSON from markdown code blocks', () => {
      const markdown = '```json\n["query1", "query2", "query3"]\n```';

      const result = parseAndValidateJSON(markdown, 'search-queries');
      expect(result.valid).toBe(true);
    });

    it('should handle JSON without code blocks', () => {
      const json = '["query1", "query2", "query3"]';

      const result = parseAndValidateJSON(json, 'search-queries');
      expect(result.valid).toBe(true);
    });

    it('should sanitize markdown from strings', () => {
      const input = {
        field: 'Some `code` here and ```more code```',
        nested: ['array with `code`']
      };

      const sanitized = sanitizeOutput(input);
      expect(sanitized.field).not.toContain('`');
      expect(sanitized.nested[0]).not.toContain('`');
    });

    it('should handle invalid JSON gracefully', () => {
      const invalid = '{invalid json}';

      const result = parseAndValidateJSON(invalid, 'search-queries');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('parse'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arrays', () => {
      const result = validateOutput('search-queries', []);
      expect(result.valid).toBe(false);
    });

    it('should handle null values', () => {
      const result = validateOutput('search-queries', null);
      expect(result.valid).toBe(false);
    });

    it('should handle undefined values', () => {
      const result = validateOutput('search-queries', undefined);
      expect(result.valid).toBe(false);
    });

    it('should handle non-array values for array schema', () => {
      const result = validateOutput('search-queries', 'not an array');
      expect(result.valid).toBe(false);
    });
  });
});

describe('Example Test Cases from Production', () => {
  /**
   * These tests use real examples that should work in production
   */

  it('Example 1: Sony Headphones Search Queries', () => {
    const queries = [
      'Sony WH-1000XM5',
      'Sony wireless noise cancelling headphones',
      'WH1000XM5 bluetooth',
      'Sony premium headphones'
    ];

    const result = validateOutput('search-queries', queries);
    expect(result.valid).toBe(true);
  });

  it('Example 2: iPhone Trend Analysis', () => {
    const trends = [{
      originalQuery: 'iPhone 15 Pro trending now',
      normalizedName: 'Apple iPhone 15 Pro',
      category: 'Electronics',
      confidence: 95,
      isProduct: true,
      reason: 'Specific smartphone model sold by all major retailers'
    }];

    const result = validateOutput('trend-analysis', trends);
    expect(result.valid).toBe(true);
  });

  it('Example 3: Laptop Search Suggestions', () => {
    const suggestions = [
      'MacBook Air M2',
      'Dell XPS 13',
      'HP Spectre x360'
    ];

    const result = validateOutput('search-suggestions', suggestions);
    expect(result.valid).toBe(true);
  });

  it('Example 4: Non-Product Trend (Should be rejected)', () => {
    const trends = [{
      originalQuery: 'Black Friday deals',
      normalizedName: '',
      category: 'Other',
      confidence: 15,
      isProduct: false,
      reason: 'Event, not a specific product'
    }];

    const result = validateOutput('trend-analysis', trends);
    expect(result.valid).toBe(true); // Valid structure, even though isProduct=false
    expect(trends[0].isProduct).toBe(false);
    expect(trends[0].confidence).toBeLessThan(30);
  });
});
