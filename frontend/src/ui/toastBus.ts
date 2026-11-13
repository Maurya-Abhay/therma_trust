export type ToastSeverity = "success" | "error" | "info" | "warning";
export interface ToastMessage {
  id: number;
  severity: ToastSeverity;
  message: string;
}

type Listener = (toast: ToastMessage) => void;

// A tiny event bus so code outside React (the query client's mutation cache)
// can raise a toast without holding a reference to a component.
const listeners = new Set<Listener>();
let nextId = 1;

export function subscribeToasts(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitToast(severity: ToastSeverity, message: string) {
  const toast = { id: nextId++, severity, message };
  listeners.forEach((listener) => listener(toast));
}
