import { Moon, Sun, Monitor, Contrast } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from './theme-provider';
import { useUser } from '@/hooks/use-user';
import { apiRequest } from '@/lib/queryClient';
import { createLogger } from '@/utils/logger';

const log = createLogger('ThemeToggle');

export function ThemeToggle() {
  const { user } = useUser();
  const {
    theme,
    contrastMode,
    setTheme,
    setContrastMode,
    resolvedTheme: _resolvedTheme,
  } = useTheme();

  // Sync theme changes to server for logged-in users
  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    // Update local state immediately (optimistic update)
    setTheme(newTheme);

    // Sync to server for logged-in users
    if (user) {
      try {
        await apiRequest('/api/user/preferences', {
          method: 'PUT',
          body: JSON.stringify({ theme: newTheme }),
        });
      } catch (error) {
        log.error('Failed to sync theme preference to server:', { error });
        // Don't block UX - theme is already set locally
      }
    }
  };

  // Sync contrast mode changes to server for logged-in users
  const handleContrastModeChange = async (newMode: 'normal' | 'high') => {
    // Update local state immediately (optimistic update)
    setContrastMode(newMode);

    // Sync to server for logged-in users
    if (user) {
      try {
        await apiRequest('/api/user/preferences', {
          method: 'PUT',
          body: JSON.stringify({ highContrast: newMode === 'high' }),
        });
      } catch (error) {
        log.error('Failed to sync contrast preference to server:', { error });
        // Don't block UX - contrast mode is already set locally
      }
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative gap-1" data-testid="theme-toggle-button">
          <Sun className="h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          {contrastMode === 'high' && <Contrast className="text-primary h-3 w-3" />}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => void handleThemeChange('light')}
          className={theme === 'light' ? 'bg-accent' : ''}
        >
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => void handleThemeChange('dark')}
          className={theme === 'dark' ? 'bg-accent' : ''}
        >
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => void handleThemeChange('system')}
          className={theme === 'system' ? 'bg-accent' : ''}
        >
          <Monitor className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Accessibility</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => void handleContrastModeChange(contrastMode === 'high' ? 'normal' : 'high')}
          className={contrastMode === 'high' ? 'bg-accent' : ''}
        >
          <Contrast className="mr-2 h-4 w-4" />
          High Contrast {contrastMode === 'high' ? '(On)' : '(Off)'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Simple toggle for quick theme switching (used in compact headers)
export function ThemeToggleSimple() {
  const { user } = useUser();
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = async () => {
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light';

    // Update local state immediately (optimistic update)
    setTheme(newTheme);

    // Sync to server for logged-in users
    if (user) {
      try {
        await apiRequest('/api/user/preferences', {
          method: 'PUT',
          body: JSON.stringify({ theme: newTheme }),
        });
      } catch (error) {
        log.error('Failed to sync theme preference to server:', { error });
        // Don't block UX - theme is already set locally
      }
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={() => void toggleTheme()} className="relative">
      <Sun className="h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
