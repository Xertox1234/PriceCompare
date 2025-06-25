import { describe, it, expect, vi } from 'vitest'
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
  imageUrl: 'https://example.com/image.jpg',
  createdAt: new Date(),
  updatedAt: new Date(),
  offers: [
    {
      id: 1,
      productId: 1,
      retailerId: 1,
      price: '99.99',
      originalPrice: '129.99',
      availability: 'in_stock',
      productUrl: 'https://example.com/product',
      lastUpdated: new Date(),
      retailer: {
        id: 1,
        name: 'Test Retailer',
        logo: 'https://example.com/logo.jpg',
        website: 'https://example.com',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
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
    expect(screen.getByText('TestBrand Test Model')).toBeInTheDocument()
    expect(screen.getByText('$99.99')).toBeInTheDocument()
  })

  it('shows savings when available', () => {
    render(
      <ProductCard 
        product={mockProduct} 
        onAddToComparison={mockOnAddToComparison} 
      />
    )

    expect(screen.getByText('Save $30.00')).toBeInTheDocument()
    expect(screen.getByText('(23% off)')).toBeInTheDocument()
  })

  it('calls onAddToComparison when compare button is clicked', () => {
    render(
      <ProductCard 
        product={mockProduct} 
        onAddToComparison={mockOnAddToComparison} 
      />
    )

    const compareButton = screen.getByLabelText(`Add ${mockProduct.name} to comparison`)
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