
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from "react";

import {
  View,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ToastItem } from "./ToastItem";

type ToastType = "success" | "error" | "warning" | "info";

type ToastMessage = {
  id: number;
  message: string;
  type: ToastType;
};

interface ToastContextType {
  show: (
    message: string,
    type?: ToastType,
    duration?: number
  ) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const insets = useSafeAreaInsets();

  const show = useCallback(
    (
      message: string,
      type: ToastType = "info",
      duration = 3500
    ) => {
      const id = Date.now() + Math.random();

      setToasts((prev) => [
        ...prev.slice(-1),
        { id, message, type },
      ]);

      const timer = setTimeout(() => {
        setToasts((prev) =>
          prev.filter((toast) => toast.id !== id)
        );

        timers.current = timers.current.filter(
          (item) => item !== timer
        );
      }, duration);

      timers.current.push(timer);
    },
    []
  );

  React.useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}

      <View
        pointerEvents="box-none"
        style={[styles.container, { top: Math.max(insets.top + 24, 64) }]}
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            message={toast.message}
            type={toast.type}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error(
      "useToast must be used within a ToastProvider"
    );
  }

  return context;
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 20,
    alignItems: "center",
  },
});
