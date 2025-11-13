import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../../test/test-utils'
import { ProductCard } from '../product-card'
import type { ProductWithOffers } from '@shared/schema'

const mockProduct: ProductWithOffers = {
  id: 1,
  name: 'Test Product',
  description: 'Test product description',
  category: 'Electronics',
  brand: 'TestBrand',
  model: 'Test Model',
  image: 'https://example.com/image.jpg',
  createdAt: new Date(),
  embedding: null,
  embeddingUpdatedAt: null,
  offers: [
    {
      id: 1,
      productId: 1,
      retailerId: 1,
      price: '99.99',
      originalPrice: '129.99',
      availability: 'in_stock',
      rating: null,
      reviewCount: null,
      shippingInfo: null,
      dealType: null,
      productUrl: 'https://example.com/product',
      affiliateUrl: null,
      linkHealthStatus: null,
      lastLinkCheck: null,
      clickCount: null,
      lastUpdated: null,
      retailer: {
        id: 1,
        name: 'Test Retailer',
        logo: 'https://example.com/logo.jpg',
        website: 'https://example.com',
        isActive: true,
        affiliateId: null,
        affiliateProgram: null,
        baseAffiliateUrl: null,
        commissionRate: null,
        affiliateStatus: null,
        affiliateConfig: null
      }
    }
  ],
  bestPrice: 99.99,
  savings: 30,
  savingsPercentage: 23
}

describe('ProductCard', () => {
  const mockOnAddToComparison = vi.fn()

  beforeEach(() => {
    mockOnAddToComparison.mockClear()
  })

  it('renders product information correctly', () => {
    render(
      <ProductCard 
        product={mockProduct} 
        onAddToComparison={mockOnAddToComparison} 
      />
    )

    expect(screen.getByText('Test Product')).toBeInTheDocument()
    expect(screen.getByText('Test Retailer')).toBeInTheDocument()
    expect(screen.getByText('$99.99')).toBeInTheDocument()
  })

  it('shows savings when available', () => {
    render(
      <ProductCard
        product={mockProduct}
        onAddToComparison={mockOnAddToComparison}
      />
    )

    // Component shows percentage badge and original price with line-through
    expect(screen.getByText(/-23%/)).toBeInTheDocument()
    expect(screen.getByText('$129.99')).toBeInTheDocument() // original price
  })

  it('calls onAddToComparison when compare button is clicked', () => {
    render(
      <ProductCard
        product={mockProduct}
        onAddToComparison={mockOnAddToComparison}
      />
    )

    const compareButton = screen.getByRole('button', { name: /compare/i })
    fireEvent.click(compareButton)

    expect(mockOnAddToComparison).toHaveBeenCalledTimes(1)
  })

  it('displays availability status correctly', () => {
    render(
      <ProductCard 
        product={mockProduct} 
        onAddToComparison={mockOnAddToComparison} 
      />
    )

    expect(screen.getByText('In Stock')).toBeInTheDocument()
  })

  it('handles out of stock products', () => {
    const outOfStockProduct = {
      ...mockProduct,
      offers: [{
        ...mockProduct.offers[0],
        availability: 'out_of_stock'
      }]
    }

    render(
      <ProductCard 
        product={outOfStockProduct} 
        onAddToComparison={mockOnAddToComparison} 
      />
    )

    expect(screen.getByText('Out of Stock')).toBeInTheDocument()
  })
})