/**
 * PriceUpdateIndicator Component
 *
 * Animated indicator that appears when a price updates in real-time.
 * Uses Framer Motion for smooth animations.
 *
 * Usage:
 * ```tsx
 * const [showUpdate, setShowUpdate] = useState(false);
 *
 * // When price changes via WebSocket:
 * setShowUpdate(true);
 * setTimeout(() => setShowUpdate(false), 3000);
 *
 * <div className="relative">
 *   <span>${price}</span>
 *   <PriceUpdateIndicator visible={showUpdate} />
 * </div>
 * ```
 */

import { motion, AnimatePresence } from 'framer-motion';

interface PriceUpdateIndicatorProps {
  visible: boolean;
  type?: 'increase' | 'decrease';
}

export function PriceUpdateIndicator({ visible, type = 'decrease' }: PriceUpdateIndicatorProps) {
  const isDecrease = type === 'decrease';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -10 }}
          transition={{ duration: 0.3 }}
          className={`absolute -top-2 -right-2 rounded-full px-2 py-1 text-xs font-bold shadow-lg ${
            isDecrease ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'
          }`}
        >
          {isDecrease ? '📉 Lower!' : '📈 Updated!'}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
