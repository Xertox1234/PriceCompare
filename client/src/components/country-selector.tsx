/**
 * Country Selector Component (TODO 251)
 *
 * Dropdown for selecting user's preferred country/region.
 * Integrates with CountryContext for persistence.
 */

import { Globe } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCountry } from '@/context/country-context';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { COUNTRY_INFO, type CountryCode } from '@shared/country-constants';

interface CountrySelectorProps {
  /** Additional CSS classes */
  className?: string;
  /** Show full country name or just code + flag */
  variant?: 'full' | 'compact';
  /** Whether to show the currency info */
  showCurrency?: boolean;
}

// Get flag from shared constants, with fallback for unsupported codes
function getCountryFlag(code: string): string {
  const info = COUNTRY_INFO[code as CountryCode];
  return info?.flag ?? '🌍';
}

export function CountrySelector({
  className,
  variant = 'compact',
  showCurrency = false,
}: CountrySelectorProps) {
  const { country, countries, setCountry, currency, isLoading } = useCountry();

  if (isLoading) {
    return <Skeleton className={cn('h-10 w-24', className)} />;
  }

  const currentCountry = countries.find((c) => c.code === country);
  const flag = getCountryFlag(country);

  return (
    <Select value={country} onValueChange={setCountry}>
      <SelectTrigger
        className={cn(
          'w-auto gap-2',
          variant === 'compact' && 'w-[130px]',
          variant === 'full' && 'w-[200px]',
          className
        )}
        aria-label="Select country"
      >
        <Globe className="h-4 w-4 text-muted-foreground" />
        <SelectValue>
          {variant === 'compact' ? (
            <span className="flex items-center gap-1">
              <span>{flag}</span>
              <span>{country}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span>{flag}</span>
              <span>{currentCountry?.name || country}</span>
              {showCurrency && <span className="text-muted-foreground">({currency})</span>}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {countries.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            <span className="flex items-center gap-2">
              <span>{getCountryFlag(c.code)}</span>
              <span>{c.name}</span>
              {showCurrency && <span className="text-muted-foreground">({c.currency})</span>}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
