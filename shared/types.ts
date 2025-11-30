// Comprehensive type definitions for the application
import type { Request } from 'express';
import type { SafeUser } from './schema';

// Express Request with authenticated user
// SECURITY: NEVER expose passwordHash - uses SafeUser type which excludes it
export interface AuthenticatedRequest extends Request {
  user: SafeUser;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthResponse {
  success: boolean;
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
  };
}

// Analytics data types
export interface AnalyticsOverview {
  totalUsers: string;
  totalProducts: string;
  totalRetailers: string;
  totalAlerts: string;
}

export interface UserGrowthData {
  date: string;
  count: number;
}

export interface ProductActivityData {
  date: string;
  count: number;
}

export interface TopCategoryData {
  categoryName: string;
  productCount: number;
}

// Form data types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  username: string;
  email: string;
  password: string;
}

export interface CategoryFormData {
  name: string;
  description: string;
  color: string;
  icon: string;
}

// Component prop types
export interface QueryResult<T> {
  data: T;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// Mutation types
export interface MutationOptions<TData, _TVariables> {
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
}

// Event handler types
export type FormSubmitHandler = (event: React.FormEvent<HTMLFormElement>) => void;
export type ButtonClickHandler = (event: React.MouseEvent<HTMLButtonElement>) => void;
export type InputChangeHandler = (event: React.ChangeEvent<HTMLInputElement>) => void;
export type TextareaChangeHandler = (event: React.ChangeEvent<HTMLTextAreaElement>) => void;

// Route handler types
import type { Response, NextFunction } from 'express';
export type RouteHandler = (req: Request, res: Response, next: NextFunction) => void;
export type AuthenticatedRouteHandler = (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;