// Lazy-loaded components for code splitting
import { lazy } from 'react';

export const LazyAdminPage = lazy(() => import('@/pages/admin'));
export const LazyForumRedirect = lazy(() => import('@/pages/forum-redirect'));