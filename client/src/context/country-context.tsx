/**
 * Country Context Provider (TODO 251)
 *
 * Provides country/currency selection for multi-country affiliate support.
 * Persists user's country preference in localStorage.
 *
 * Usage:
 * ```tsx
 * const { country, currency, setCountry, countries } = useCountry();
 * ```
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

// Country type matching API response
export interface Country {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
}

// Context value type
interface CountryContextValue {
  /** Current selected country code (e.g., 'US', 'CA') */
  country: string;
  /** Current currency code (e.g., 'USD', 'CAD') */
  currency: string;
  /** Current currency symbol (e.g., '$', 'C$') */
  currencySymbol: string;
  /** Full country object */
  countryData: Country | undefined;
  /** List of supported countries */
  countries: Country[];
  /** Set the user's preferred country */
  setCountry: (countryCode: string) => void;
  /** Whether countries are loading */
  isLoading: boolean;
  /** Format a price with the current currency symbol */
  formatPrice: (price: number | string) => string;
}

const STORAGE_KEY = 'price-compare-country';
const DEFAULT_COUNTRY = 'US';

const CountryContext = createContext<CountryContextValue | undefined>(undefined);

interface CountryProviderProps {
  children: ReactNode;
  /** Default country if none stored (defaults to 'US') */
  defaultCountry?: string;
}

export function CountryProvider({
  children,
  defaultCountry = DEFAULT_COUNTRY,
}: CountryProviderProps) {
  // Fetch supported countries from API
  const { data: countries = [], isLoading } = useQuery<Country[]>({
    queryKey: ['countries'],
    queryFn: async (): Promise<Country[]> => {
      const response = await fetch('/api/countries');
      if (!response.ok) {
        throw new Error('Failed to fetch countries');
      }
      const json = (await response.json()) as { data: Country[] };
      return json.data;
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - countries rarely change
    gcTime: 24 * 60 * 60 * 1000,
  });

  // Initialize country from localStorage or default
  const [country, setCountryState] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored || defaultCountry;
    } catch {
      return defaultCountry;
    }
  });

  // Get current country data
  const countryData = countries.find((c) => c.code === country);

  // Derived values with fallbacks
  const currency = countryData?.currency || 'USD';
  const currencySymbol = countryData?.currencySymbol || '$';

  // Set country with validation and persistence
  const setCountry = useCallback(
    (countryCode: string) => {
      // Validate against supported countries (if loaded)
      if (countries.length > 0) {
        const isValid = countries.some((c) => c.code === countryCode);
        if (!isValid) {
          // Invalid country code - silently ignore
          return;
        }
      }

      setCountryState(countryCode);
      try {
        localStorage.setItem(STORAGE_KEY, countryCode);
      } catch {
        // Ignore localStorage errors (e.g., private browsing)
      }
    },
    [countries]
  );

  // Validate stored country when countries load
  useEffect(() => {
    if (countries.length > 0) {
      const isValid = countries.some((c) => c.code === country);
      if (!isValid) {
        // Reset to default if stored country is no longer valid
        setCountry(defaultCountry);
      }
    }
  }, [countries, country, defaultCountry, setCountry]);

  // Format price with currency symbol
  const formatPrice = useCallback(
    (price: number | string): string => {
      const numPrice = typeof price === 'string' ? parseFloat(price) : price;
      if (isNaN(numPrice)) return `${currencySymbol}0.00`;

      // Format with 2 decimal places and thousands separators
      const formatted = numPrice.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      return `${currencySymbol}${formatted}`;
    },
    [currencySymbol]
  );

  // Memoize context value to prevent unnecessary re-renders (TODO 260)
  const value = useMemo<CountryContextValue>(() => ({
    country,
    currency,
    currencySymbol,
    countryData,
    countries,
    setCountry,
    isLoading,
    formatPrice,
  }), [country, currency, currencySymbol, countryData, countries, setCountry, isLoading, formatPrice]);

  return <CountryContext.Provider value={value}>{children}</CountryContext.Provider>;
}

/**
 * Hook to access country context
 *
 * @example
 * ```tsx
 * const { country, formatPrice, setCountry } = useCountry();
 *
 * // Display formatted price
 * <span>{formatPrice(product.price)}</span>
 *
 * // Country selector
 * <select value={country} onChange={(e) => setCountry(e.target.value)}>
 *   {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
 * </select>
 * ```
 */
export function useCountry(): CountryContextValue {
  const context = useContext(CountryContext);
  if (context === undefined) {
    throw new Error('useCountry must be used within a CountryProvider');
  }
  return context;
}
