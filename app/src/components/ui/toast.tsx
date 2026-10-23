import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'warning';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}
interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastApi | undefined>(undefined);

const STYLE: Record<ToastKind, string> = { success: 'bg-success', error: 'bg-danger', warning: 'bg-accent-600' };
const ICON = { success: CheckCircle2, error: XCircle, warning: AlertTriangle } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, kind, message }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), kind === 'success' ? 4000 : 8000);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m), warning: (m) => push('warning', m) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-24 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:items-end" aria-live="polite">
        {items.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <div
              key={t.id}
              role={t.kind === 'success' ? 'status' : 'alert'}
              className={cn('pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl', STYLE[t.kind])}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast phải được dùng bên trong <ToastProvider>');
  return ctx;
}
