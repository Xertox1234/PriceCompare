import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../test/test-utils'
import { SearchHeader } from '../search-header'

describe('SearchHeader', () => {
  const mockOnSearch = vi.fn()

  beforeEach(() => {
    mockOnSearch.mockClear()
  })

  it('renders search input and button', () => {
    render(
      <SearchHeader 
        onSearch={mockOnSearch} 
        searchQuery="" 
      />
    )

    expect(screen.getByPlaceholderText(/search for products/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
  })

  it('displays current search query', () => {
    render(
      <SearchHeader 
        onSearch={mockOnSearch} 
        searchQuery="test query" 
      />
    )

    const input = screen.getByDisplayValue('test query')
    expect(input).toBeInTheDocument()
  })

  it('calls onSearch when form is submitted', () => {
    render(
      <SearchHeader 
        onSearch={mockOnSearch} 
        searchQuery="" 
      />
    )

    const input = screen.getByPlaceholderText(/search for products/i)
    const button = screen.getByRole('button', { name: /search/i })

    fireEvent.change(input, { target: { value: 'laptop' } })
    fireEvent.click(button)

    expect(mockOnSearch).toHaveBeenCalledWith('laptop')
  })

  it('calls onSearch when Enter key is pressed', () => {
    render(
      <SearchHeader 
        onSearch={mockOnSearch} 
        searchQuery="" 
      />
    )

    const input = screen.getByPlaceholderText(/search for products/i)

    fireEvent.change(input, { target: { value: 'smartphone' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(mockOnSearch).toHaveBeenCalledWith('smartphone')
  })

  it('handles empty search gracefully', () => {
    render(
      <SearchHeader 
        onSearch={mockOnSearch} 
        searchQuery="" 
      />
    )

    const button = screen.getByRole('button', { name: /search/i })
    fireEvent.click(button)

    expect(mockOnSearch).toHaveBeenCalledWith('')
  })
})