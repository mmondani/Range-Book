import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { SCATTER_CONTENT } from '@/lib/scatter-zoom';
import { isZoomed, panView, pinchView, zoomAt, type ViewPoint, type ZoomView } from '@/lib/zoom';

/** Cuánto (en fracciones del recuadro) se mueve el dedo antes de que un toque sea un arrastre. */
const DRAG_THRESHOLD = 0.02;

export interface PinchZoom<T extends Element> {
  handlers: {
    onPointerDown: (event: ReactPointerEvent<T>) => void;
    onPointerMove: (event: ReactPointerEvent<T>) => void;
    onPointerUp: (event: ReactPointerEvent<T>) => void;
    onPointerCancel: (event: ReactPointerEvent<T>) => void;
    onPointerLeave: (event: ReactPointerEvent<T>) => void;
  };
  /** A 1×, un dedo desplaza la página; con zoom, el gráfico. */
  touchAction: 'pan-x pan-y' | 'none';
  /** Si el último gesto fue un pellizco o un arrastre: el toque que sigue no es una selección. */
  wasGesture: () => boolean;
}

/** Posición del puntero en fracciones del recuadro del elemento. */
function relativePoint(element: Element | null, clientX: number, clientY: number): ViewPoint {
  const rect = element?.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
  return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
}

/**
 * Gestos de zoom sobre un recuadro cuadrado (la dispersión del PMI): dos dedos pellizcan, un dedo
 * arrastra si hay zoom y Ctrl + rueda (o el pellizco del trackpad, que llega así) acerca en el
 * cursor. La rueda sola sigue desplazando la página.
 */
export function usePinchZoom<T extends Element>(
  ref: RefObject<T | null>,
  view: ZoomView,
  onView: (view: ZoomView) => void,
): PinchZoom<T> {
  const pointers = useRef(new Map<number, ViewPoint>());
  const start = useRef<{ view: ZoomView; points: ViewPoint[] } | null>(null);
  const moved = useRef(false);
  // La última vista (la que se acaba de pedir, aunque todavía no se haya dibujado) y el callback.
  const current = useRef(view);
  const callback = useRef(onView);
  useEffect(() => {
    current.current = view;
    callback.current = onView;
  });
  const emit = (next: ZoomView) => {
    current.current = next;
    callback.current(next);
  };

  const point = (event: { clientX: number; clientY: number }) =>
    relativePoint(ref.current, event.clientX, event.clientY);
  const restart = () => {
    start.current =
      pointers.current.size > 0
        ? { view: current.current, points: [...pointers.current.values()] }
        : null;
  };
  const end = (event: ReactPointerEvent<T>) => {
    if (pointers.current.delete(event.pointerId)) restart();
  };

  // Ctrl + rueda: tiene que poder cancelar el zoom de la página, así que no es pasivo.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onWheel = (event: Event) => {
      const wheel = event as WheelEvent;
      if (!wheel.ctrlKey) return;
      wheel.preventDefault();
      const at = relativePoint(element, wheel.clientX, wheel.clientY);
      const next = zoomAt(current.current, Math.exp(-wheel.deltaY / 200), at, SCATTER_CONTENT);
      current.current = next;
      callback.current(next);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [ref]);

  return {
    handlers: {
      onPointerDown(event) {
        if (pointers.current.size === 0) moved.current = false;
        pointers.current.set(event.pointerId, point(event));
        restart();
      },
      onPointerMove(event) {
        if (!pointers.current.has(event.pointerId) || !start.current) return;
        pointers.current.set(event.pointerId, point(event));
        const from = start.current.points;
        const to = [...pointers.current.values()];
        if (from.length >= 2 && to.length >= 2) {
          moved.current = true;
          emit(
            pinchView(start.current.view, [from[0]!, from[1]!], [to[0]!, to[1]!], SCATTER_CONTENT),
          );
          return;
        }
        if (from.length !== 1 || !isZoomed(start.current.view)) return;
        const dx = to[0]!.x - from[0]!.x;
        const dy = to[0]!.y - from[0]!.y;
        if (!moved.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        moved.current = true;
        emit(panView(start.current.view, dx, dy, SCATTER_CONTENT));
      },
      onPointerUp: end,
      onPointerCancel: end,
      onPointerLeave(event) {
        // El mouse que sale del gráfico termina el arrastre; los dedos se siguen aunque salgan.
        if (event.pointerType === 'mouse') end(event);
      },
    },
    touchAction: isZoomed(view) ? 'none' : 'pan-x pan-y',
    wasGesture: () => moved.current,
  };
}
