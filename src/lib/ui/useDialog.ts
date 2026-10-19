import { useEffect } from "react";
let openDialogs = 0;
let previousOverflow = "";
export function useDialog(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const previous = document.activeElement as HTMLElement | null,
      dialog = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[role="dialog"][aria-modal="true"]',
        ),
      ).at(-1),
      shell = document.querySelector<HTMLElement>(".app-shell");
    if (!dialog) return;
    if (openDialogs++ === 0) previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (shell) shell.inert = true;
    const dock = document.querySelector<HTMLElement>(".floating-cinema-dock");
    if (dock) dock.inert = true;
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button,input,select,a[href],[tabindex="0"]',
        ),
      ).filter(
        (el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0,
      );
    const controls = focusable();
    (dialog.querySelector<HTMLElement>("input") || controls[0])?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const elements = focusable(),
        first = elements[0],
        last = elements.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    dialog.addEventListener("keydown", trap);
    return () => {
      dialog.removeEventListener("keydown", trap);
      openDialogs = Math.max(0, openDialogs - 1);
      if (openDialogs === 0) {
        if (shell) shell.inert = false;
        if (dock) dock.inert = false;
        document.body.style.overflow = previousOverflow;
        if (previous?.isConnected) previous.focus();
      }
    };
  }, [enabled]);
}
