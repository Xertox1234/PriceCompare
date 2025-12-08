import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Search, Filter, Settings, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdvancedSearch } from '@/components/advanced-search';
import { EnhancedSearchResults } from '@/components/enhanced-search-results';
import { useAdvancedSearch } from '@/hooks/use-advanced-search';
import type { ProductWithOffers } from '@shared/schema';

interface AdvancedSearchResult {
  product: ProductWithOffers;
  relevanceScore: number;
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'synonym';
}

export function AdvancedSearchPage() {
  const [_selectedProduct, setSelectedProduct] = useState<ProductWithOffers | null>(null);
  const [searchResults, setSearchResults] = useState<AdvancedSearchResult[]>([]);

  const {
    query,
    setQuery,
    filters: _filters,
    setFilters: _setFilters,
    search: _search,
    suggestions: _suggestions,
    analysis: _analysis,
    results,
    metadata,
    isSearching,
    searchHistory,
    clearSearch,
  } = useAdvancedSearch({
    mode: 'smart',
    autoSearch: false,
  });

  // Handle search results from AdvancedSearch component
  const handleSearchResults = (results: AdvancedSearchResult[]) => {
    setSearchResults(results);
  };

  // Handle product selection
  const handleProductClick = (product: ProductWithOffers) => {
    setSelectedProduct(product);
  };

  return (
    <>
      <Helmet>
        <title>Advanced Search - AI-Powered Product Discovery</title>
        <meta
          name="description"
          content="Search millions of products with our AI-powered search engine. Features semantic search, fuzzy matching, and intelligent intent detection for the best results."
        />
      </Helmet>

      <div className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-foreground mb-4 text-4xl font-bold">Advanced Product Search</h1>
            <p className="text-muted-foreground mx-auto max-w-3xl text-xl">
              Discover products with our AI-powered search engine featuring semantic understanding,
              fuzzy matching, and intelligent intent detection.
            </p>
          </div>

          {/* Search Interface */}
          <div className="mx-auto mb-8 max-w-4xl">
            <AdvancedSearch
              onResults={handleSearchResults}
              initialQuery={query}
              showFilters={true}
            />
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="space-y-6">
                {/* Search History */}
                {searchHistory.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <TrendingUp className="h-5 w-5" />
                        Recent Searches
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {searchHistory.slice(0, 5).map((historyQuery, index) => (
                          <Button
                            key={index}
                            variant="ghost"
                            size="sm"
                            onClick={() => setQuery(historyQuery)}
                            className="w-full justify-start truncate text-left"
                          >
                            {historyQuery}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Search Features */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Settings className="h-5 w-5" />
                      Search Features
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="bg-success h-2 w-2 rounded-full"></div>
                        <span className="text-sm">Exact matching</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-primary h-2 w-2 rounded-full"></div>
                        <span className="text-sm">Fuzzy search</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-secondary h-2 w-2 rounded-full"></div>
                        <span className="text-sm">Semantic understanding</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-warning h-2 w-2 rounded-full"></div>
                        <span className="text-sm">Synonym detection</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-warning h-2 w-2 rounded-full"></div>
                        <span className="text-sm">Intent analysis</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-destructive h-2 w-2 rounded-full"></div>
                        <span className="text-sm">Auto-correction</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" size="sm" onClick={clearSearch} className="w-full">
                      Clear Search
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuery('trending smartphones')}
                      className="w-full"
                    >
                      Trending Phones
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuery('best laptop deals')}
                      className="w-full"
                    >
                      Laptop Deals
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-3">
              <Tabs defaultValue="results" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="results" className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Search Results
                  </TabsTrigger>
                  <TabsTrigger value="demo" className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Demo Searches
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="results" className="space-y-6">
                  {/* Search Results */}
                  <EnhancedSearchResults
                    results={searchResults.length > 0 ? searchResults : results || []}
                    metadata={metadata}
                    isLoading={isSearching}
                    onProductClick={handleProductClick}
                  />

                  {/* No Search Yet */}
                  {!query && searchResults.length === 0 && !results && (
                    <Card className="py-12 text-center">
                      <CardContent>
                        <Search className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
                        <h3 className="mb-2 text-xl font-semibold">Start Your Advanced Search</h3>
                        <p className="text-muted-foreground mx-auto mb-6 max-w-md">
                          Use our AI-powered search to find exactly what you're looking for. Try
                          semantic queries, brand names, or product categories.
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setQuery('waterproof bluetooth headphones')}
                          >
                            Waterproof Headphones
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setQuery('affordable gaming laptop')}
                          >
                            Gaming Laptops
                          </Button>
                          <Button variant="outline" onClick={() => setQuery('smart home devices')}>
                            Smart Home
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="demo" className="space-y-6">
                  {/* Demo Searches */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Try These Advanced Search Examples</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {[
                          {
                            title: 'Semantic Search',
                            description: 'Find products by meaning, not just keywords',
                            example: 'device for watching movies at home',
                            searchType: 'semantic',
                          },
                          {
                            title: 'Fuzzy Matching',
                            description: 'Automatically correct typos and variations',
                            example: 'iphon 15 pro',
                            searchType: 'fuzzy',
                          },
                          {
                            title: 'Synonym Detection',
                            description: 'Understand different ways to say the same thing',
                            example: 'tv',
                            searchType: 'synonym',
                          },
                          {
                            title: 'Intent Recognition',
                            description: 'Detect what type of search you want to perform',
                            example: 'cheap gaming laptop under $800',
                            searchType: 'intent',
                          },
                          {
                            title: 'Brand Recognition',
                            description: 'Smart brand detection and product matching',
                            example: 'apple smartphones',
                            searchType: 'brand',
                          },
                          {
                            title: 'Category Browse',
                            description: 'Explore products within specific categories',
                            example: 'wireless audio devices',
                            searchType: 'category',
                          },
                        ].map((demo, index) => (
                          <Card key={index} className="transition-shadow hover:shadow-md">
                            <CardContent className="p-4">
                              <h4 className="mb-2 font-semibold">{demo.title}</h4>
                              <p className="text-muted-foreground mb-3 text-sm">
                                {demo.description}
                              </p>
                              <div className="flex items-center justify-between">
                                <code className="bg-muted rounded px-2 py-1 text-sm">
                                  {demo.example}
                                </code>
                                <Button size="sm" onClick={() => setQuery(demo.example)}>
                                  Try It
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Search Tips */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Search Tips</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h4 className="mb-2 font-medium">For Best Results:</h4>
                          <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                            <li>Use natural language descriptions</li>
                            <li>Include specific features you want</li>
                            <li>Mention your budget or price range</li>
                            <li>Try both brand names and generic terms</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="mb-2 font-medium">Search Modes:</h4>
                          <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                            <li>
                              <strong>Smart:</strong> AI-powered with all features enabled
                            </li>
                            <li>
                              <strong>Intent:</strong> Optimized based on detected search intent
                            </li>
                            <li>
                              <strong>Basic:</strong> Traditional keyword matching
                            </li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
