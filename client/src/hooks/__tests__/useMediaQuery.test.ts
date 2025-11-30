/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- Test mocks require flexible typing */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useIsTouchDevice,
  useBreakpoint,
} from '../useMediaQuery';

// Mock window.matchMedia
const createMatchMediaMock = (matches: boolean) => {
  return vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(), // Deprecated but still used for fallback
    removeListener: vi.fn(), // Deprecated but still used for fallback
    dispatchEvent: vi.fn(),
  }));
};

describe('useMediaQuery', () => {
  let matchMediaMock: ReturnType<typeof createMatchMediaMock>;

  beforeEach(() => {
    matchMediaMock = createMatchMediaMock(false);
    window.matchMedia = matchMediaMock as typeof window.matchMedia;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return false when media query does not match', () => {
    matchMediaMock = createMatchMediaMock(false);
    window.matchMedia = matchMediaMock as typeof window.matchMedia;

    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));
    expect(result.current).toBe(false);
  });

  it('should return true when media query matches', () => {
    matchMediaMock = createMatchMediaMock(true);
    window.matchMedia = matchMediaMock as typeof window.matchMedia;

    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));
    expect(result.current).toBe(true);
  });

  it('should call matchMedia with correct query', () => {
    const query = '(min-width: 1024px)';
    renderHook(() => useMediaQuery(query));

    expect(matchMediaMock).toHaveBeenCalledWith(query);
  });

  it('should add event listener for changes', () => {
    const addEventListenerSpy = vi.fn();
    const mockMedia = {
      matches: false,
      media: '',
      onchange: null,
      addEventListener: addEventListenerSpy,
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };

    window.matchMedia = vi.fn().mockReturnValue(mockMedia) as typeof window.matchMedia;

    renderHook(() => useMediaQuery('(max-width: 767px)'));

    expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should cleanup event listener on unmount', () => {
    const removeEventListenerSpy = vi.fn();
    const mockMedia = {
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: removeEventListenerSpy,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };

    window.matchMedia = vi.fn().mockReturnValue(mockMedia) as typeof window.matchMedia;

    const { unmount } = renderHook(() => useMediaQuery('(max-width: 767px)'));
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalled();
  });
});

describe('useIsMobile', () => {
  it('should return true for mobile viewport', () => {
    window.matchMedia = createMatchMediaMock(true) as typeof window.matchMedia;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('should return false for non-mobile viewport', () => {
    window.matchMedia = createMatchMediaMock(false) as typeof window.matchMedia;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('should use correct max-width query', () => {
    const matchMediaSpy = createMatchMediaMock(false);
    window.matchMedia = matchMediaSpy as typeof window.matchMedia;

    renderHook(() => useIsMobile());

    expect(matchMediaSpy).toHaveBeenCalledWith('(max-width: 767px)');
  });
});

describe('useIsTablet', () => {
  it('should return true for tablet viewport', () => {
    window.matchMedia = createMatchMediaMock(true) as typeof window.matchMedia;
    const { result } = renderHook(() => useIsTablet());
    expect(result.current).toBe(true);
  });

  it('should return false for non-tablet viewport', () => {
    window.matchMedia = createMatchMediaMock(false) as typeof window.matchMedia;
    const { result } = renderHook(() => useIsTablet());
    expect(result.current).toBe(false);
  });

  it('should use correct range query', () => {
    const matchMediaSpy = createMatchMediaMock(false);
    window.matchMedia = matchMediaSpy as typeof window.matchMedia;

    renderHook(() => useIsTablet());

    expect(matchMediaSpy).toHaveBeenCalledWith('(min-width: 768px) and (max-width: 1023px)');
  });
});

describe('useIsDesktop', () => {
  it('should return true for desktop viewport', () => {
    window.matchMedia = createMatchMediaMock(true) as typeof window.matchMedia;
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);
  });

  it('should return false for non-desktop viewport', () => {
    window.matchMedia = createMatchMediaMock(false) as typeof window.matchMedia;
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(false);
  });

  it('should use correct min-width query', () => {
    const matchMediaSpy = createMatchMediaMock(false);
    window.matchMedia = matchMediaSpy as typeof window.matchMedia;

    renderHook(() => useIsDesktop());

    expect(matchMediaSpy).toHaveBeenCalledWith('(min-width: 1024px)');
  });
});

describe('useIsTouchDevice', () => {
  it('should return true when touch is supported via ontouchstart', () => {
    Object.defineProperty(window, 'ontouchstart', {
      value: {},
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useIsTouchDevice());
    expect(result.current).toBe(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- window.ontouchstart doesn't exist in standard types
    delete (window as any).ontouchstart;
  });

  it('should return true when maxTouchPoints > 0', () => {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 1,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useIsTouchDevice());
    expect(result.current).toBe(true);
  });

  it('should return false when touch is not supported', () => {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 0,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useIsTouchDevice());
    expect(result.current).toBe(false);
  });
});

describe('useBreakpoint', () => {
  it('should return "mobile" for mobile viewport', () => {
    // Mobile check will match
    window.matchMedia = vi.fn().mockImplementation((query: string) => {
      const matches = query === '(max-width: 767px)';
      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    }) as typeof window.matchMedia;

    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('mobile');
  });

  it('should return "tablet" for tablet viewport', () => {
    // Mobile check false, tablet check true
    window.matchMedia = vi.fn().mockImplementation((query: string) => {
      const matches = query === '(min-width: 768px) and (max-width: 1023px)';
      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    }) as typeof window.matchMedia;

    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('tablet');
  });

  it('should return "desktop" for desktop viewport', () => {
    // Both mobile and tablet checks return false
    window.matchMedia = createMatchMediaMock(false) as typeof window.matchMedia;

    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('desktop');
  });
});

describe('Edge Cases', () => {
  it('should handle matchMedia not supporting addEventListener', () => {
    const addListenerSpy = vi.fn();
    const removeListenerSpy = vi.fn();
    const mockMedia = {
      matches: false,
      media: '',
      onchange: null,
      addEventListener: undefined, // Not available
      removeEventListener: undefined,
      addListener: addListenerSpy,
      removeListener: removeListenerSpy,
      dispatchEvent: vi.fn(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Legacy MediaQueryList without addEventListener
    window.matchMedia = vi.fn().mockReturnValue(mockMedia) as any;

    const { unmount } = renderHook(() => useMediaQuery('(max-width: 767px)'));

    expect(addListenerSpy).toHaveBeenCalledWith(expect.any(Function));

    unmount();

    expect(removeListenerSpy).toHaveBeenCalled();
  });

  it('should handle multiple breakpoint hooks', () => {
    window.matchMedia = createMatchMediaMock(false) as typeof window.matchMedia;

    const { result: mobileResult } = renderHook(() => useIsMobile());
    const { result: tabletResult } = renderHook(() => useIsTablet());
    const { result: desktopResult } = renderHook(() => useIsDesktop());

    // All should work independently
    expect(typeof mobileResult.current).toBe('boolean');
    expect(typeof tabletResult.current).toBe('boolean');
    expect(typeof desktopResult.current).toBe('boolean');
  });
});
