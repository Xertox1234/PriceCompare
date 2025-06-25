import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../test/test-utils'
import { ProductGrid } from '../product-grid'
import type { ProductWithOffers } from '@shared/schema'

const mockProducts: ProductWithOffers[] = [
  {
    id: 1,
    name: 'Test Product 1',
    description: 'Test product description 1',
    category: 'Electronics',
    brand: 'TestBrand',
    model: 'Test Model 1',
    imageUrl: 'https://example.com/image1.jpg',
    createdAt: new Date(),
    updatedAt: new Date(),
    offers: [
      {
        id: 1,
        productId: 1,
        retailerId: 1,
        price: '99.99',
        availability: 'in_stock',
        productUrl: 'https://example.com/product1',
        lastUpdated: new Date(),
        retailer: {
          id: 1,
          name: 'Test Retailer',
          logo: 'https://example.com/logo.jpg',
          website: 'https://example.com',
          isActive: true
        }
      }
    ],
    bestPrice: 99.99
  },
  {
    id: 2,
    name: 'Test Product 2',
    description: 'Test product description 2',
    category: 'Home',
    brand: 'TestBrand2',
    model: 'Test Model 2',
    imageUrl: 'https://example.com/image2.jpg',
    createdAt: new Date(),
    updatedAt: new Date(),
    offers: [
      {
        id: 2,
        productId: 2,
        retailerId: 1,
        price: '149.99',
        availability: 'in_stock',
        productUrl: 'https://example.com/product2',
        lastUpdated: new Date(),
        retailer: {
          id: 1,
          name: 'Test Retailer',
          logo: 'https://example.com/logo.jpg',
          website: 'https://example.com',
          isActive: true
        }
      }
    ],
    bestPrice: 149.99
  }
]

describe('ProductGrid', () => {
  const mockOnAddToComparison = vi.fn()

  beforeEach(() => {
    mockOnAddToComparison.mockClear()
  })

  it('renders loading state correctly', () => {
    render(
      <ProductGrid 
        products={[]}
        isLoading={true}
        error={null}
        onAddToComparison={mockOnAddToComparison}
      />
    )

    expect(screen.getByLabelText('Loading products')).toBeInTheDocument()
    expect(screen.getAllByTestId('skeleton')).toBeTruthy()
  })

  it('renders error state correctly', () => {
    const error = new Error('Failed to load products')
    render(
      <ProductGrid 
        products={[]}
        isLoading={false}
        error={error}
        onAddToComparison={mockOnAddToComparison}
      />
    )

    expect(screen.getByText('Error loading products')).toBeInTheDocument()
    expect(screen.getByText('Failed to load products')).toBeInTheDocument()
  })

  it('renders empty state when no products', () => {
    render(
      <ProductGrid 
        products={[]}
        isLoading={false}
        error={null}
        onAddToComparison={mockOnAddToComparison}
      />
    )

    expect(screen.getByText('No products found')).toBeInTheDocument()
    expect(screen.getByText(/try adjusting your search/i)).toBeInTheDocument()
  })

  it('renders products grid correctly', () => {
    render(
      <ProductGrid 
        products={mockProducts}
        isLoading={false}
        error={null}
        onAddToComparison={mockOnAddToComparison}
      />
    )

    expect(screen.getByText('Test Product 1')).toBeInTheDocument()
    expect(screen.getByText('Test Product 2')).toBeInTheDocument()
  })

  it('shows load more button when products >= 6', () => {
    const manyProducts = Array(7).fill(null).map((_, index) => ({
      ...mockProducts[0],
      id: index + 1,
      name: `Product ${index + 1}`
    }))

    render(
      <ProductGrid 
        products={manyProducts}
        isLoading={false}
        error={null}
        onAddToComparison={mockOnAddToComparison}
      />
    )

    expect(screen.getByText('Load More Results')).toBeInTheDocument()
    expect(screen.getByText('Showing 7 results')).toBeInTheDocument()
  })
})