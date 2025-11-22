import { createContext, useContext, useEffect, useState } from 'react';
import { createLogger } from '@/utils/logger';

const log = createLogger('ThemeProvider');

type Theme = 'dark' | 'light' | 'system';
type ContrastMode = 'normal' | 'high';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultContrast?: ContrastMode;
  storageKey?: string;
  contrastStorageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  contrastMode: ContrastMode;
  setTheme: (theme: Theme) => void;
  setContrastMode: (mode: ContrastMode) => void;
  resolvedTheme: 'dark' | 'light'; // Actual theme after system preference resolution
};

const initialState: ThemeProviderState = {
  theme: 'system',
  contrastMode: 'normal',
  setTheme: () => null,
  setContrastMode: () => null,
  resolvedTheme: 'light',
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  defaultContrast = 'normal',
  storageKey = 'ui-theme',
  contrastStorageKey = 'ui-contrast',
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  const [contrastMode, setContrastModeState] = useState<ContrastMode>(() => {
    try {
      return (localStorage.getItem(contrastStorageKey) as ContrastMode) || defaultContrast;
    } catch {
      return defaultContrast;
    }
  });

  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('light');

  useEffect(() => {
    const root = window.document.documentElement;

    // Remove all theme classes
    root.classList.remove('light', 'dark', 'high-contrast');

    // Determine actual theme
    let actualTheme: 'dark' | 'light';
    if (theme === 'system') {
      actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } else {
      actualTheme = theme;
    }

    // Apply theme class
    root.classList.add(actualTheme);
    setResolvedTheme(actualTheme);

    // Apply high contrast if enabled
    if (contrastMode === 'high') {
      root.classList.add('high-contrast');
    }
  }, [theme, contrastMode]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(e.matches ? 'dark' : 'light');
      setResolvedTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem(storageKey, newTheme);
    } catch (error) {
      log.warn('Failed to save theme preference:', { error });
    }
    setThemeState(newTheme);
  };

  const setContrastMode = (mode: ContrastMode) => {
    try {
      localStorage.setItem(contrastStorageKey, mode);
    } catch (error) {
      log.warn('Failed to save contrast preference:', { error });
    }
    setContrastModeState(mode);
  };

  const value = {
    theme,
    contrastMode,
    setTheme,
    setContrastMode,
    resolvedTheme,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};