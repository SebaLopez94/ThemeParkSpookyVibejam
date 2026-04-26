import { AlertTriangle, Bell, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ToastItem {
  id: number;
  tone: 'info' | 'success' | 'warning';
  message: string;
}

interface ToastStackProps {
  items: ToastItem[];
}

const TOAST_ICON = {
  info: Bell,
  success: CheckCircle2,
  warning: AlertTriangle
};

export function ToastStack({ items }: ToastStackProps) {
  return (
    <div className="px-toast-stack">
      <AnimatePresence>
        {items.map(item => {
          const Icon = TOAST_ICON[item.tone];
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={`px-toast px-toast--${item.tone}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon size={15} />
                <span>{item.message}</span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
