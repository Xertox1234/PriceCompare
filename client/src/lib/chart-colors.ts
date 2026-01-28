/**
 * Chart Colors - Centralized color palette for data visualization
 *
 * These colors are synced with tailwind.config.ts (theme.extend.colors.chart)
 * Use these constants instead of hardcoding hex values in chart components.
 *
 * @example
 * import { CHART_COLORS, PRODUCT_COLORS, AGGREGATES_COLORS } from '@/lib/chart-colors';
 *
 * <Line stroke={AGGREGATES_COLORS.average} />
 * <Line stroke={PRODUCT_COLORS[productIndex % PRODUCT_COLORS.length]} />
 */

/** Primary chart colors for multi-series data */
export const CHART_COLORS = {
  blue: '#3b82f6',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
  teal: '#14b8a6',
  orange: '#f97316',
  gray: '#64748b',
} as const;

/** Ordered array of product comparison colors (max 4 products) */
export const PRODUCT_COLORS = [
  CHART_COLORS.blue, // Blue
  CHART_COLORS.green, // Green
  CHART_COLORS.amber, // Amber
  CHART_COLORS.red, // Red
] as const;

/** Colors for price aggregates chart (avg, min, max, median) */
export const AGGREGATES_COLORS = {
  average: '#8884d8',
  minimum: '#82ca9d',
  maximum: '#ff7c7c',
  median: '#ffc658',
} as const;

/** Color presets for user-selectable UI elements (watch lists, tags) */
export const COLOR_PRESETS = [
  CHART_COLORS.red, // red
  CHART_COLORS.orange, // orange
  CHART_COLORS.amber, // yellow/amber
  CHART_COLORS.green, // green
  CHART_COLORS.blue, // blue
  CHART_COLORS.purple, // purple
  CHART_COLORS.pink, // pink
  CHART_COLORS.gray, // gray
] as const;

/** Ordered array of retailer colors for price history charts (8 colors for unique retailers) */
export const RETAILER_COLORS = [
  CHART_COLORS.blue, // Blue
  CHART_COLORS.green, // Green
  CHART_COLORS.amber, // Amber
  CHART_COLORS.red, // Red
  CHART_COLORS.purple, // Purple
  CHART_COLORS.pink, // Pink
  '#06b6d4', // Cyan (tailwind cyan-500)
  CHART_COLORS.orange, // Orange
] as const;

/** Get a color for a product by index (cycles through PRODUCT_COLORS) */
export function getProductColor(index: number): string {
  return PRODUCT_COLORS[index % PRODUCT_COLORS.length];
}

/** Get a color for a retailer by index (cycles through RETAILER_COLORS) */
export function getRetailerColor(index: number): string {
  return RETAILER_COLORS[index % RETAILER_COLORS.length];
}
