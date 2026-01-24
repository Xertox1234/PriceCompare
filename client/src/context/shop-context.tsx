import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { createLogger } from '@/utils/logger';

const log = createLogger('ShopContext');

// =============================================================================
// TYPES
// =============================================================================

// NOTE: Cart functionality removed - not applicable for price comparison platform
// PriceCompare shows prices across retailers; users click through to buy at the retailer
// See TODO 269 resolution (2026-01-24)

export interface ShopState {
  wishlist: number[]; // Product IDs
  compare: number[]; // Product IDs (max 4)
  recentlyViewed: number[]; // Product IDs (max 10)
}

type ShopAction =
  | { type: 'TOGGLE_WISHLIST'; payload: number }
  | { type: 'TOGGLE_COMPARE'; payload: number }
  | { type: 'CLEAR_COMPARE' }
  | { type: 'ADD_RECENTLY_VIEWED'; payload: number }
  | { type: 'LOAD_STATE'; payload: ShopState };

interface ShopContextType extends ShopState {
  // Wishlist actions
  toggleWishlist: (productId: number) => void;
  isInWishlist: (productId: number) => boolean;

  // Compare actions
  toggleCompare: (productId: number) => void;
  isInCompare: (productId: number) => boolean;
  clearCompare: () => void;

  // Recently viewed
  addRecentlyViewed: (productId: number) => void;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialState: ShopState = {
  wishlist: [],
  compare: [],
  recentlyViewed: [],
};

// =============================================================================
// REDUCER
// =============================================================================

function shopReducer(state: ShopState, action: ShopAction): ShopState {
  switch (action.type) {
    case 'TOGGLE_WISHLIST': {
      const productId = action.payload;
      const isInWishlist = state.wishlist.includes(productId);
      return {
        ...state,
        wishlist: isInWishlist
          ? state.wishlist.filter((id) => id !== productId)
          : [...state.wishlist, productId],
      };
    }

    case 'TOGGLE_COMPARE': {
      const productId = action.payload;
      const isInCompare = state.compare.includes(productId);

      if (isInCompare) {
        return {
          ...state,
          compare: state.compare.filter((id) => id !== productId),
        };
      }

      // Max 4 items in compare
      if (state.compare.length >= 4) {
        return state;
      }

      return {
        ...state,
        compare: [...state.compare, productId],
      };
    }

    case 'CLEAR_COMPARE':
      return { ...state, compare: [] };

    case 'ADD_RECENTLY_VIEWED': {
      const productId = action.payload;
      const filtered = state.recentlyViewed.filter((id) => id !== productId);
      // Keep max 10 items, newest first
      return {
        ...state,
        recentlyViewed: [productId, ...filtered].slice(0, 10),
      };
    }

    case 'LOAD_STATE':
      return action.payload;

    default:
      return state;
  }
}

// =============================================================================
// CONTEXT
// =============================================================================

const ShopContext = createContext<ShopContextType | undefined>(undefined);

const STORAGE_KEY = 'pricecompare-shop-state';

export function ShopProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(shopReducer, initialState);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        // Validate parsed data has expected shape before dispatching
        if (typeof parsed === 'object' && parsed !== null && 'wishlist' in parsed) {
          // Extract only the fields we care about (ignore legacy cart data)
          // Type assertion: localStorage data validated by shape check above
          const data = parsed as Record<string, unknown>;

          // Type-safe array extraction with runtime validation
          const toNumberArray = (value: unknown): number[] => {
            if (!Array.isArray(value)) return [];
            return value.filter((item): item is number => typeof item === 'number');
          };

          dispatch({
            type: 'LOAD_STATE',
            payload: {
              wishlist: toNumberArray(data.wishlist),
              compare: toNumberArray(data.compare),
              recentlyViewed: toNumberArray(data.recentlyViewed),
            },
          });
        }
      }
    } catch (error) {
      log.error('Failed to load shop state', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  // Save state to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      log.error('Failed to save shop state', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [state]);

  // Wishlist actions
  const toggleWishlist = (productId: number) => {
    dispatch({ type: 'TOGGLE_WISHLIST', payload: productId });
  };

  const isInWishlist = (productId: number) => {
    return state.wishlist.includes(productId);
  };

  // Compare actions
  const toggleCompare = (productId: number) => {
    dispatch({ type: 'TOGGLE_COMPARE', payload: productId });
  };

  const isInCompare = (productId: number) => {
    return state.compare.includes(productId);
  };

  const clearCompare = () => {
    dispatch({ type: 'CLEAR_COMPARE' });
  };

  // Recently viewed
  const addRecentlyViewed = (productId: number) => {
    dispatch({ type: 'ADD_RECENTLY_VIEWED', payload: productId });
  };

  const value: ShopContextType = {
    ...state,
    toggleWishlist,
    isInWishlist,
    toggleCompare,
    isInCompare,
    clearCompare,
    addRecentlyViewed,
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const context = useContext(ShopContext);
  if (context === undefined) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
}
