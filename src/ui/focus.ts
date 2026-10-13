import { useCallback } from "react";

/**
 * A ref callback that focuses the element once it mounts, without scrolling it into view.
 * `autoFocus` would scroll a long feedback panel to its bottom on phones and hide the result.
 */
export function useFocusOnMount<T extends HTMLElement>() {
  return useCallback((element: T | null) => {
    element?.focus({ preventScroll: true });
  }, []);
}
