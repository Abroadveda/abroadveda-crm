import { useState, useCallback, useEffect, useRef } from "react";

// Form state management hook
export function useForm(initialState) {
  const [form, setForm] = useState(initialState);

  const set = useCallback((key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setForm(initialState);
  }, [initialState]);

  const update = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  return [form, setForm, set, reset, update];
}

// Async operation management hook
export function useAsync(asyncFunction, immediate = true) {
  const [state, setState] = useState({
    status: immediate ? "pending" : "idle",
    data: null,
    error: null,
  });

  const execute = useCallback(
    async (...args) => {
      setState({ status: "pending", data: null, error: null });
      try {
        const response = await asyncFunction(...args);
        setState({ status: "success", data: response, error: null });
        return response;
      } catch (error) {
        setState({ status: "error", data: null, error });
        throw error;
      }
    },
    [asyncFunction]
  );

  useEffect(() => {
    if (!immediate) return;
    execute();
  }, [execute, immediate]);

  return { ...state, execute };
}

// Mobile/tablet/desktop detection hook
export function useMobileContext() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isTablet, setIsTablet] = useState(
    window.innerWidth >= 768 && window.innerWidth < 1024
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return { isMobile, isTablet, isDesktop: !isMobile && !isTablet };
}

// Local storage hook
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.warn(`Error writing to localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue];
}

// Debounce hook
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Focus trap hook for modals
export function useFocusTrap(ref) {
  const firstFocusableRef = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const focusableElements = node.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    firstFocusableRef.current = focusableElements[0];
    firstFocusableRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key !== "Tab") return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", handleKeyDown);
    return () => node.removeEventListener("keydown", handleKeyDown);
  }, [ref]);

  return firstFocusableRef;
}
