import { createContext, useContext } from 'react';

export const TOAST_DURATION_MS = 4000;

export interface ToastOptions {
  message: string;
  tone?: 'success' | 'error';
  /** Acción opcional, por ejemplo "Deshacer". Al usarla se cierra el toast. */
  action?: { label: string; onAction: () => void };
}

export interface ToastContextValue {
  show: (options: ToastOptions) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast necesita un ToastProvider');
  return context;
}
