export interface ComparisonItem {
  id: number;
  name: string;
  bestPrice: number;
  image?: string;
  retailer: string;
}

export interface SearchSuggestion {
  id: string;
  text: string;
  category?: string;
}

export interface PriceAlert {
  id: number;
  productId: number;
  targetPrice: number;
  isActive: boolean;
  createdAt: Date;
}
