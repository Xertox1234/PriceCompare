import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { createLogger } from '@/utils/logger';

const log = createLogger('ShopContext');
import type { TemplateProduct } from '@/data/template-data';

// =============================================================================
// TYPES
// =============================================================================

export interface CartItem {
  product: TemplateProduct;
  quantity: number;
}

// Simplified cart item for cart sidebar
export interface SimpleCartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
}

export interface ShopState {
  cart: CartItem[];
  simpleCart: SimpleCartItem[]; // For cart sidebar
  wishlist: number[]; // Product IDs
  compare: number[]; // Product IDs (max 4)
  recentlyViewed: number[]; // Product IDs (max 10)
  isCartOpen: boolean;
}

type ShopAction =
  | { type: 'ADD_TO_CART'; payload: { product: TemplateProduct; quantity?: number } }
  | { type: 'ADD_SIMPLE_TO_CART'; payload: SimpleCartItem }
  | { type: 'REMOVE_FROM_CART'; payload: number }
  | { type: 'UPDATE_CART_QUANTITY'; payload: { productId: number; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'TOGGLE_WISHLIST'; payload: number }
  | { type: 'TOGGLE_COMPARE'; payload: number }
  | { type: 'CLEAR_COMPARE' }
  | { type: 'ADD_RECENTLY_VIEWED'; payload: number }
  | { type: 'OPEN_CART' }
  | { type: 'CLOSE_CART' }
  | { type: 'LOAD_STATE'; payload: ShopState };

interface ShopContextType extends ShopState {
  // Cart actions
  addToCart: (product: TemplateProduct, quantity?: number) => void;
  addSimpleToCart: (item: SimpleCartItem) => void;
  removeFromCart: (productId: number) => void;
  updateCartQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartItemCount: () => number;
  isInCart: (productId: number) => boolean;

  // Cart sidebar
  openCart: () => void;
  closeCart: () => void;

  // For cart sidebar component
  cartItems: SimpleCartItem[];
  cartTotal: number;
  updateQuantity: (id: number, quantity: number) => void;

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
  cart: [],
  simpleCart: [],
  wishlist: [],
  compare: [],
  recentlyViewed: [],
  isCartOpen: false,
};

// =============================================================================
// REDUCER
// =============================================================================

function shopReducer(state: ShopState, action: ShopAction): ShopState {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const { product, quantity = 1 } = action.payload;
      const existingIndex = state.cart.findIndex((item) => item.product.id === product.id);

      if (existingIndex >= 0) {
        const newCart = [...state.cart];
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          quantity: newCart[existingIndex].quantity + quantity,
        };
        return { ...state, cart: newCart };
      }

      return {
        ...state,
        cart: [...state.cart, { product, quantity }],
      };
    }

    case 'ADD_SIMPLE_TO_CART': {
      const item = action.payload;
      const existingIndex = state.simpleCart.findIndex((i) => i.id === item.id);

      if (existingIndex >= 0) {
        const newCart = [...state.simpleCart];
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          quantity: newCart[existingIndex].quantity + item.quantity,
        };
        return { ...state, simpleCart: newCart };
      }

      return {
        ...state,
        simpleCart: [...state.simpleCart, item],
      };
    }

    case 'REMOVE_FROM_CART':
      return {
        ...state,
        cart: state.cart.filter((item) => item.product.id !== action.payload),
        simpleCart: state.simpleCart.filter((item) => item.id !== action.payload),
      };

    case 'UPDATE_CART_QUANTITY': {
      const { productId, quantity } = action.payload;
      if (quantity <= 0) {
        return {
          ...state,
          cart: state.cart.filter((item) => item.product.id !== productId),
          simpleCart: state.simpleCart.filter((item) => item.id !== productId),
        };
      }
      return {
        ...state,
        cart: state.cart.map((item) =>
          item.product.id === productId ? { ...item, quantity } : item
        ),
        simpleCart: state.simpleCart.map((item) =>
          item.id === productId ? { ...item, quantity } : item
        ),
      };
    }

    case 'CLEAR_CART':
      return { ...state, cart: [], simpleCart: [] };

    case 'OPEN_CART':
      return { ...state, isCartOpen: true };

    case 'CLOSE_CART':
      return { ...state, isCartOpen: false };

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
        if (typeof parsed === 'object' && parsed !== null && 'cart' in parsed) {
          dispatch({ type: 'LOAD_STATE', payload: parsed as ShopState });
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

  // Cart actions
  const addToCart = (product: TemplateProduct, quantity = 1) => {
    dispatch({ type: 'ADD_TO_CART', payload: { product, quantity } });
  };

  const addSimpleToCart = (item: SimpleCartItem) => {
    dispatch({ type: 'ADD_SIMPLE_TO_CART', payload: item });
  };

  const removeFromCart = (productId: number) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: productId });
  };

  const updateCartQuantity = (productId: number, quantity: number) => {
    dispatch({ type: 'UPDATE_CART_QUANTITY', payload: { productId, quantity } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const getCartTotal = () => {
    return state.cart.reduce((total, item) => total + item.product.price * item.quantity, 0);
  };

  const getCartItemCount = () => {
    const cartCount = state.cart.reduce((count, item) => count + item.quantity, 0);
    const simpleCount = state.simpleCart.reduce((count, item) => count + item.quantity, 0);
    return cartCount + simpleCount;
  };

  const isInCart = (productId: number) => {
    return (
      state.cart.some((item) => item.product.id === productId) ||
      state.simpleCart.some((item) => item.id === productId)
    );
  };

  // Cart sidebar
  const openCart = () => {
    dispatch({ type: 'OPEN_CART' });
  };

  const closeCart = () => {
    dispatch({ type: 'CLOSE_CART' });
  };

  // Computed values for cart sidebar
  const cartItems = state.simpleCart;
  const cartTotal = state.simpleCart.reduce((total, item) => total + item.price * item.quantity, 0);
  const updateQuantity = (id: number, quantity: number) => {
    updateCartQuantity(id, quantity);
  };

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
    addToCart,
    addSimpleToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    getCartTotal,
    getCartItemCount,
    isInCart,
    openCart,
    closeCart,
    cartItems,
    cartTotal,
    updateQuantity,
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
