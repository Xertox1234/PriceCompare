import { useEffect, useCallback } from 'react';
import { useAccessibility } from '@/contexts/accessibility-context';

interface KeyboardNavigationOptions {
  onFocusSearch?: () => void;
  onToggleAccessibility?: () => void;
  onNavigateHome?: () => void;
  onNavigateProducts?: () => void;
  onNavigateForum?: () => void;
  onOpenHelp?: () => void;
}

export function useKeyboardNavigation(options: KeyboardNavigationOptions = {}) {
  const { announce, settings } = useAccessibility();

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    // Only handle keyboard shortcuts if keyboard navigation is enabled
    if (!settings.keyboardNavigation) return;

    const { key, ctrlKey, metaKey, altKey, shiftKey } = event;
    const isModifierPressed = ctrlKey || metaKey;

    // Prevent default behavior for our custom shortcuts
    const shouldPreventDefault = () => {
      if (isModifierPressed) {
        switch (key.toLowerCase()) {
          case 'k': // Ctrl+K or Cmd+K for search
          case 'h': // Ctrl+H for home
          case '/': // Ctrl+/ for search
            return true;
          default:
            return false;
        }
      }
      
      if (altKey) {
        switch (key.toLowerCase()) {
          case 'a': // Alt+A for accessibility panel
          case 'h': // Alt+H for help
            return true;
          default:
            return false;
        }
      }
      
      return false;
    };

    if (shouldPreventDefault()) {
      event.preventDefault();
    }

    // Handle keyboard shortcuts
    if (isModifierPressed) {
      switch (key.toLowerCase()) {
        case 'k':
        case '/':
          // Focus search - Ctrl+K or Ctrl+/
          if (options.onFocusSearch) {
            options.onFocusSearch();
            announce('Search focused', 'polite');
          } else {
            // Fallback to focusing any search input
            const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
            if (searchInput) {
              searchInput.focus();
              announce('Search focused', 'polite');
            }
          }
          break;
          
        case 'h':
          // Navigate to home - Ctrl+H
          if (options.onNavigateHome) {
            options.onNavigateHome();
          } else {
            window.location.href = '/';
          }
          announce('Navigating to home', 'polite');
          break;
          
        case 'p':
          // Navigate to products - Ctrl+P
          if (options.onNavigateProducts) {
            options.onNavigateProducts();
          } else {
            window.location.href = '/products';
          }
          announce('Navigating to products', 'polite');
          break;
          
        case 'f':
          // Navigate to forum - Ctrl+F (if not browser find)
          if (options.onNavigateForum) {
            options.onNavigateForum();
          } else {
            window.location.href = '/forum';
          }
          announce('Navigating to forum', 'polite');
          break;
      }
    }
    
    // Alt key combinations
    if (altKey) {
      switch (key.toLowerCase()) {
        case 'a':
          // Toggle accessibility panel - Alt+A
          if (options.onToggleAccessibility) {
            options.onToggleAccessibility();
            announce('Accessibility panel toggled', 'polite');
          }
          break;
          
        case 'h':
          // Open help - Alt+H
          if (options.onOpenHelp) {
            options.onOpenHelp();
            announce('Help opened', 'polite');
          }
          break;
      }
    }
    
    // Escape key handling
    if (key === 'Escape') {
      // Close any open modals or dropdowns
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement.blur) {
        activeElement.blur();
      }
      
      // Close any open dialogs
      const dialogs = document.querySelectorAll('[role="dialog"]');
      dialogs.forEach(dialog => {
        const closeButton = dialog.querySelector('[aria-label*="close"], [aria-label*="Close"]') as HTMLElement;
        if (closeButton) {
          closeButton.click();
        }
      });
      
      announce('Closed dialog or cleared focus', 'polite');
    }
  }, [settings.keyboardNavigation, options, announce]);

  // Focus management for better keyboard navigation
  const focusNext = useCallback(() => {
    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const currentIndex = Array.from(focusableElements).indexOf(document.activeElement as Element);
    const nextElement = focusableElements[currentIndex + 1] as HTMLElement;
    
    if (nextElement) {
      nextElement.focus();
      announce(`Focused ${nextElement.tagName.toLowerCase()}`, 'polite');
    }
  }, [announce]);

  const focusPrevious = useCallback(() => {
    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const currentIndex = Array.from(focusableElements).indexOf(document.activeElement as Element);
    const previousElement = focusableElements[currentIndex - 1] as HTMLElement;
    
    if (previousElement) {
      previousElement.focus();
      announce(`Focused ${previousElement.tagName.toLowerCase()}`, 'polite');
    }
  }, [announce]);

  // Register keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  return {
    focusNext,
    focusPrevious,
  };
}

// Hook for managing focus within a component
export function useFocusManagement() {
  const { announce } = useAccessibility();

  const trapFocus = useCallback((element: HTMLElement) => {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        if (event.shiftKey) {
          // Shift+Tab - go to previous element
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab - go to next element
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    element.addEventListener('keydown', handleKeyDown);
    
    // Focus the first element
    if (firstElement) {
      firstElement.focus();
    }

    return () => {
      element.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const restoreFocus = useCallback((previousElement?: HTMLElement) => {
    if (previousElement) {
      previousElement.focus();
      announce('Focus restored', 'polite');
    }
  }, [announce]);

  return {
    trapFocus,
    restoreFocus,
  };
}