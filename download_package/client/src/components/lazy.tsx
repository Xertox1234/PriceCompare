import { lazy } from 'react';

// Lazy load admin page
export const LazyAdminPage = lazy(() => 
  import('@/pages/admin').then(module => ({ default: module.AdminPage }))
);

// Lazy load forum page
export const LazyForumPage = lazy(() => 
  import('@/pages/forum').then(module => ({ default: module.ForumPage }))
);

// Lazy load advanced search page
export const LazyAdvancedSearchPage = lazy(() => 
  import('@/pages/advanced-search').then(module => ({ default: module.AdvancedSearchPage }))
);