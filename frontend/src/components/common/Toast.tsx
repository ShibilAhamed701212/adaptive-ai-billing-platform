import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { LOAD_FAILED_EVENT } from '../../api/client';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let counter = 0;

const PALETTE: Record<ToastType, { color: string; bg: string }> = {
  success: { color: 'var(--color-success)', bg: '#f0fdf4' },
  error: { color: 'var(--color-danger)', bg: '#fff1f2' },
  info: { color: 'var(--accent-primary)', bg: '#eef2ff' },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++counter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  // Surface failed page loads globally; parallel requests failing together show one toast.
  const lastLoadError = useRef({ message: '', at: 0 });
  useEffect(() => {
    const onLoadFailed = (e: Event) => {
      const message = (e as CustomEvent<string>).detail;
      const now = Date.now();
      if (lastLoadError.current.message === message && now - lastLoadError.current.at < 5000) return;
      lastLoadError.current = { message, at: now };
      show(message, 'error');
    };
    window.addEventListener(LOAD_FAILED_EVENT, onLoadFailed);
    return () => window.removeEventListener(LOAD_FAILED_EVENT, onLoadFailed);
  }, [show]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        className="no-print"
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 4000,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
          maxWidth: '380px',
        }}
      >
        {toasts.map((t) => {
          const { color, bg } = PALETTE[t.type];
          const Icon = t.type === 'success' ? CheckCircle2 : t.type === 'error' ? AlertTriangle : Info;
          return (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                background: bg,
                border: `1px solid ${color}40`,
                borderLeft: `4px solid ${color}`,
                borderRadius: 'var(--radius-md)',
                padding: '0.8rem 1rem',
                boxShadow: '0 6px 20px rgba(15, 23, 42, 0.12)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              <Icon size={17} color={color} style={{ flexShrink: 0, marginTop: '0.05rem' }} />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};
