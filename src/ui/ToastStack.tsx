import { AlertTriangle, Bell, CheckCircle2 } from 'lucide-react';

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
  if (items.length === 0) return null;

  return (
    <div className="px-toast-stack">
      {items.map(item => {
        const Icon = TOAST_ICON[item.tone];
        return (
          <div key={item.id} className={`px-toast px-toast--${item.tone}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon size={15} />
              <span>{item.message}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
