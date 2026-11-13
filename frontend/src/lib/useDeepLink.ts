import { useEffect, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

/**
 * The get-started checklist links to pages as `/credentials?add=1`. This runs `action` (open the
 * dialog, scroll to the form...) once when the page was opened that way, then tidies the address
 * so a refresh or the back button doesn't repeat it. `ready` holds it back until the page has what
 * it needs (for example the company has loaded).
 */
export function useDeepLinkAction(action: () => void, ready = true) {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  // While one page animates out, it is still mounted and would also see the new address. Only the
  // page the link was meant for (the one whose own path it is) may use up the `?add=1`.
  const ownPath = useRef(pathname);
  const wanted = params.get("add");

  useEffect(() => {
    if (!wanted || !ready || pathname !== ownPath.current) return;
    action();
    const next = new URLSearchParams(params);
    next.delete("add");
    setParams(next, { replace: true });
    // `action` is intentionally not a dependency: it only needs to run once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, ready, pathname]);
}

/** Bring an inline form into view and put the cursor in its first field. */
export function focusForm(id: string) {
  window.setTimeout(() => {
    const form = document.getElementById(id);
    if (!form) return;
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    form.querySelector<HTMLElement>("input:not([type=hidden]), textarea, [role=combobox]")?.focus({ preventScroll: true });
  }, 150);
}
