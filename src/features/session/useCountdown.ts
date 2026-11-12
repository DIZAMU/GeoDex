import { useEffect, useRef, useState } from "react";

/**
 * Visible countdown. Returns whole seconds left, or null when off.
 * Restarts whenever `key` changes; calls onExpire once when it reaches zero.
 */
export function useCountdown(
  seconds: number,
  key: string | null,
  onExpire: () => void,
): number | null {
  const [left, setLeft] = useState<number | null>(null);
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    if (seconds <= 0 || key === null) {
      setLeft(null);
      return;
    }
    const end = performance.now() + seconds * 1000;
    setLeft(seconds);
    let fired = false;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((end - performance.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0 && !fired) {
        fired = true;
        clearInterval(timer);
        expire.current();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [seconds, key]);

  return left;
}
