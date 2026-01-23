/**
 * Country/Currency Constants - Single Source of Truth
 *
 * All country-related constants should be imported from this file.
 *
 * IMPORTANT: Database CHECK constraints (migrations/0030_add_retailer_country_support.sql)
 * cannot import TypeScript. When adding new countries, you must ALSO update:
 * - chk_retailers_country_code
 * - chk_retailers_currency
 * - chk_retailers_country_currency_match
 */

export const COUNTRIES = [
  {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    currencySymbol: '$',
    flag: '🇺🇸',
    locale: 'en-US',
  },
  {
    code: 'CA',
    name: 'Canada',
    currency: 'CAD',
    currencySymbol: 'C$',
    flag: '🇨🇦',
    locale: 'en-CA',
  },
] as const;

// Type-safe country and currency codes derived from COUNTRIES array
export type CountryCode = (typeof COUNTRIES)[number]['code'];
export type CurrencyCode = (typeof COUNTRIES)[number]['currency'];

// Derived constants for validation and lookups
export const VALID_COUNTRY_CODES = COUNTRIES.map((c) => c.code);
export const VALID_CURRENCIES = COUNTRIES.map((c) => c.currency);

// Country code to currency mapping
export const COUNTRY_CURRENCIES: Record<CountryCode, CurrencyCode> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c.currency])
) as Record<CountryCode, CurrencyCode>;

// Country code to full country info mapping
export const COUNTRY_INFO: Record<CountryCode, (typeof COUNTRIES)[number]> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c])
) as Record<CountryCode, (typeof COUNTRIES)[number]>;

// Helper to get country by code
export function getCountryByCode(code: string): (typeof COUNTRIES)[number] | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

// Helper to validate country code
export function isValidCountryCode(code: string): code is CountryCode {
  return VALID_COUNTRY_CODES.includes(code as CountryCode);
}

// Helper to validate currency
export function isValidCurrency(currency: string): currency is CurrencyCode {
  return VALID_CURRENCIES.includes(currency as CurrencyCode);
}

// Helper to validate country/currency match
export function isValidCountryCurrencyPair(countryCode: string, currency: string): boolean {
  if (!isValidCountryCode(countryCode)) return false;
  return COUNTRY_CURRENCIES[countryCode] === currency;
}
