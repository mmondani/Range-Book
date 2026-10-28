import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openModals = 0;

function trapTab(node: HTMLElement, event: KeyboardEvent) {
  const focusable = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) {
    event.preventDefault();
    return;
  }
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === node)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Comportamiento común de sheets y diálogos: foco inicial dentro del modal (`[data-autofocus]` o el
 * propio modal), foco atrapado con Tab, Escape para pedir el cierre, scroll de la página bloqueado y
 * foco devuelto al cerrar.
 *
 * El listener de teclado es nativo y está en el nodo del modal: como los modales se montan en
 * portales separados, Escape en una confirmación abierta encima no cierra también al de abajo.
 */
export function useModal<T extends HTMLElement>(
  open: boolean,
  onRequestClose: () => void,
): RefObject<T | null> {
  const ref = useRef<T>(null);
  const closeRef = useRef(onRequestClose);

  useEffect(() => {
    closeRef.current = onRequestClose;
  });

  useEffect(() => {
    const node = ref.current;
    if (!open || !node) return;
    const previous = document.activeElement as HTMLElement | null;
    (node.querySelector<HTMLElement>('[data-autofocus]') ?? node).focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      } else if (event.key === 'Tab' && node) {
        trapTab(node, event);
      }
    }

    node.addEventListener('keydown', onKeyDown);
    openModals += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      openModals -= 1;
      if (openModals === 0) document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [open]);

  return ref;
}
