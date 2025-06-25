import { memo, useCallback } from 'react';
import { SearchHeader } from '@/components/search-header';
import { debounce } from '@/utils/performance';

interface OptimizedSearchHeaderProps {
  onSearch: (query: string) => void;
  searchQuery: string;
}

export const OptimizedSearchHeader = memo(({ onSearch, searchQuery }: OptimizedSearchHeaderProps) => {
  // Debounce search to improve performance
  const debouncedSearch = useCallback(
    debounce(onSearch, 300),
    [onSearch]
  );

  return (
    <SearchHeader 
      onSearch={debouncedSearch}
      searchQuery={searchQuery}
    />
  );
});

OptimizedSearchHeader.displayName = 'OptimizedSearchHeader';