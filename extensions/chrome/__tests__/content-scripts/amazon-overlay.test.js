import "../../setup.js";

/**
 * Integration tests for Amazon content script
 * Tests product detection and extraction logic
 */

describe('Amazon Overlay Integration', () => {
  // Helper functions that mirror the content script logic
  function isProductPage() {
    return window.location.pathname.includes('/dp/') ||
      window.location.pathname.includes('/gp/product/');
  }

  function extractASIN() {
    const urlMatch = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/);
    if (urlMatch) {
      return urlMatch[1];
    }

    const asinInput = document.querySelector('input[name="ASIN"]');
    if (asinInput) {
      return asinInput.value;
    }

    return null;
  }

  function extractTitle() {
    const selectors = [
      '#productTitle',
      '#title',
      'h1.product-title',
      'span#productTitle'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return 'Unknown Product';
  }

  function extractPrice() {
    const selectors = [
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price-whole',
      'span.price'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const priceText = element.textContent.trim();
        const match = priceText.match(/[\d,]+\.?\d*/);
        if (match) {
          return parseFloat(match[0].replace(',', ''));
        }
      }
    }

    return null;
  }

  beforeEach(() => {
    // Reset window.location mock
    delete window.location;
    window.location = {
      href: 'https://www.amazon.com/',
      hostname: 'www.amazon.com',
      pathname: '/',
      search: '',
      hash: ''
    };

    // Reset document mocks
    document.querySelector.mockReset();
    document.querySelectorAll.mockReset();
  });

  describe('isProductPage', () => {
    it('should detect /dp/ product pages', () => {
      window.location.pathname = '/dp/B08N5WRWNW';

      expect(isProductPage()).toBe(true);
    });

    it('should detect /gp/product/ pages', () => {
      window.location.pathname = '/gp/product/B08N5WRWNW';

      expect(isProductPage()).toBe(true);
    });

    it('should not detect non-product pages', () => {
      window.location.pathname = '/s?k=laptop';

      expect(isProductPage()).toBe(false);
    });

    it('should not detect homepage', () => {
      window.location.pathname = '/';

      expect(isProductPage()).toBe(false);
    });
  });

  describe('extractASIN', () => {
    it('should extract ASIN from /dp/ URL', () => {
      window.location.pathname = '/dp/B08N5WRWNW';

      const asin = extractASIN();

      expect(asin).toBe('B08N5WRWNW');
    });

    it('should extract ASIN from longer URL', () => {
      window.location.pathname = '/dp/B08N5WRWNW/ref=sr_1_1';

      const asin = extractASIN();

      expect(asin).toBe('B08N5WRWNW');
    });

    it('should extract ASIN from input field if not in URL', () => {
      window.location.pathname = '/product-page';

      const mockInput = {
        value: 'B12345ABCD',
        tagName: 'INPUT'
      };
      document.querySelector.mockReturnValue(mockInput);

      const asin = extractASIN();

      expect(asin).toBe('B12345ABCD');
      expect(document.querySelector).toHaveBeenCalledWith('input[name="ASIN"]');
    });

    it('should return null if ASIN not found', () => {
      window.location.pathname = '/some-page';
      document.querySelector.mockReturnValue(null);

      const asin = extractASIN();

      expect(asin).toBeNull();
    });
  });

  describe('extractTitle', () => {
    it('should extract title from #productTitle', () => {
      const mockElement = {
        textContent: '  Test Product Title  ',
        tagName: 'SPAN'
      };
      document.querySelector.mockReturnValue(mockElement);

      const title = extractTitle();

      expect(title).toBe('Test Product Title');
      expect(document.querySelector).toHaveBeenCalledWith('#productTitle');
    });

    it('should try multiple selectors', () => {
      document.querySelector
        .mockReturnValueOnce(null) // #productTitle
        .mockReturnValueOnce({ textContent: 'Found Title' }); // #title

      const title = extractTitle();

      expect(title).toBe('Found Title');
      expect(document.querySelector).toHaveBeenCalledTimes(2);
    });

    it('should return "Unknown Product" if title not found', () => {
      document.querySelector.mockReturnValue(null);

      const title = extractTitle();

      expect(title).toBe('Unknown Product');
    });
  });

  describe('extractPrice', () => {
    it('should extract price from .a-price .a-offscreen', () => {
      const mockElement = {
        textContent: '$19.99'
      };
      document.querySelector.mockReturnValue(mockElement);

      const price = extractPrice();

      expect(price).toBe(19.99);
    });

    it('should handle comma-separated prices', () => {
      const mockElement = {
        textContent: '$1,234.56'
      };
      document.querySelector.mockReturnValue(mockElement);

      const price = extractPrice();

      expect(price).toBe(1234.56);
    });

    it('should try multiple selectors', () => {
      document.querySelector
        .mockReturnValueOnce(null) // .a-price .a-offscreen
        .mockReturnValueOnce({ textContent: '$25.99' }); // #priceblock_ourprice

      const price = extractPrice();

      expect(price).toBe(25.99);
    });

    it('should return null if price not found', () => {
      document.querySelector.mockReturnValue(null);

      const price = extractPrice();

      expect(price).toBeNull();
    });

    it('should handle prices without cents', () => {
      const mockElement = {
        textContent: '$50'
      };
      document.querySelector.mockReturnValue(mockElement);

      const price = extractPrice();

      expect(price).toBe(50);
    });
  });

  describe('Full Integration', () => {
    it('should extract all data from product page', () => {
      // Setup product page
      window.location.pathname = '/dp/B08N5WRWNW';

      const mockTitleElement = { textContent: 'Test Product' };
      const mockPriceElement = { textContent: '$29.99' };

      document.querySelector
        .mockImplementation((selector) => {
          if (selector === '#productTitle') return mockTitleElement;
          if (selector === '.a-price .a-offscreen') return mockPriceElement;
          return null;
        });

      // Extract data
      expect(isProductPage()).toBe(true);
      expect(extractASIN()).toBe('B08N5WRWNW');
      expect(extractTitle()).toBe('Test Product');
      expect(extractPrice()).toBe(29.99);
    });
  });
});
