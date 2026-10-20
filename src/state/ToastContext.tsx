import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';

type Tone = 'success' | 'error' | 'info';
interface ToastAction {
  label: string;
  onClick: () => void;
}
interface Toast {
  id: number;
  message: string;
  tone: Tone;
  action?: ToastAction;
}

interface ToastContextValue {
  notify: (message: string, tone?: Tone, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<Tone, string> = {
  success: 'border-ivey-200 bg-white text-neutral-900 [&_svg]:text-ivey-700',
  error: 'border-red-200 bg-red-50 text-red-900 [&_svg]:text-red-700',
  info: 'border-neutral-200 bg-white text-neutral-900 [&_svg]:text-neutral-600',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: Tone = 'success', action?: ToastAction) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, tone, action }]);
      window.setTimeout(() => dismiss(id), tone === 'error' || action ? 7000 : 4000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-6 bottom-6 z-[60] flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${toneStyles[toast.tone]}`}
          >
            <Icon name={toast.tone === 'error' ? 'alert' : toast.tone === 'success' ? 'check' : 'info'} className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1">{toast.message}</p>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action!.onClick();
                  dismiss(toast.id);
                }}
                className="rounded font-semibold text-ivey-700 underline-offset-2 hover:underline"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded text-neutral-500 hover:text-neutral-900"
              aria-label="Dismiss message"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
