// Lazy-loaded components for code splitting
import { lazy } from 'react';

export const LazyAdminPage = lazy(() => import('@/pages/admin'));
export const LazyForumPage = lazy(() => import('@/pages/forum-new'));
export const LazyAdvancedSearchPage = lazy(() =>
  import('@/pages/advanced-search').then(module => ({ default: module.AdvancedSearchPage }))
);
export const LazyPriceHistoryPage = lazy(() => import('@/pages/price-history'));
export const LazyAnalyticsPage = lazy(() => import('@/pages/analytics'));
export const LazyWatchListManager = lazy(() =>
  import('@/components/community/watch-list-manager').then(m => ({ default: m.WatchListManager }))
);