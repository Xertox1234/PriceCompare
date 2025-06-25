// Lazy-loaded components for code splitting
import { lazy } from 'react';

export const LazyAdminPage = lazy(() => import('@/pages/admin'));
export const LazyForumPage = lazy(() => import('@/pages/forum'));
export const LazyComparisonModal = lazy(() => import('@/components/comparison-modal'));
export const LazyEmbeddedForum = lazy(() => import('@/components/forum/embedded-forum'));