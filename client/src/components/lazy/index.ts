// Lazy-loaded components for code splitting
import { lazy } from 'react';

export const LazyAdminPage = lazy(() => import('@/pages/admin'));
export const LazyForumPage = lazy(() => import('@/pages/forum-new'));
export const LazyAdvancedSearchPage = lazy(() => 
  import('@/pages/advanced-search').then(module => ({ default: module.AdvancedSearchPage }))
);