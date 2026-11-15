import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SCATTER_FULL_VIEW } from '@/lib/scatter-zoom';
import type { ZoomView } from '@/lib/zoom';
import { usePinchZoom } from './use-pinch-zoom';

/** Un recuadro de 200 × 200 px con el hook; muestra la vista y si hubo gesto. */
function Harness({ initial = SCATTER_FULL_VIEW }: { initial?: ZoomView }) {
  const [view, setView] = useState(initial);
  const ref = useRef<HTMLButtonElement>(null);
  const zoom = usePinchZoom(ref, view, setView);
  const [tapped, setTapped] = useState(0);
  return (
    <button
      type="button"
      ref={ref}
      data-testid="box"
      style={{ touchAction: zoom.touchAction }}
      {...zoom.handlers}
      onClick={() => !zoom.wasGesture() && setTapped((count) => count + 1)}
    >
      <output data-testid="view">{`${view.scale.toFixed(2)} ${view.x.toFixed(2)} ${view.y.toFixed(2)}`}</output>
      <output data-testid="taps">{tapped}</output>
    </button>
  );
}

function setup(initial?: ZoomView) {
  render(<Harness initial={initial} />);
  const box = screen.getByTestId('box');
  vi.spyOn(box, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 200,
    height: 200,
  } as DOMRect);
  return box;
}

const view = () => screen.getByTestId('view').textContent;
const touch = (id: number, x: number, y = 100) => ({
  pointerId: id,
  pointerType: 'touch',
  clientX: x,
  clientY: y,
});

describe('usePinchZoom', () => {
  it('dos dedos que se separan acercan, con el punto entre ellos quieto', () => {
    const box = setup();
    fireEvent.pointerDown(box, touch(1, 80));
    fireEvent.pointerDown(box, touch(2, 120));
    fireEvent.pointerMove(box, touch(1, 60));
    fireEvent.pointerMove(box, touch(2, 140));
    // De 40 a 80 px entre los dedos: el doble, alrededor del centro.
    expect(view()).toBe('2.00 -0.50 -0.50');
    fireEvent.pointerUp(box, touch(1, 60));
    fireEvent.pointerUp(box, touch(2, 140));
    expect(box).toHaveStyle({ touchAction: 'none' });
  });

  it('un pellizco no cuenta como toque', () => {
    const box = setup();
    fireEvent.pointerDown(box, touch(1, 80));
    fireEvent.pointerDown(box, touch(2, 120));
    fireEvent.pointerMove(box, touch(2, 160));
    fireEvent.pointerUp(box, touch(1, 80));
    fireEvent.pointerUp(box, touch(2, 160));
    fireEvent.click(box);
    expect(screen.getByTestId('taps')).toHaveTextContent('0');
    // El toque siguiente sí.
    fireEvent.pointerDown(box, touch(1, 100));
    fireEvent.pointerUp(box, touch(1, 100));
    fireEvent.click(box);
    expect(screen.getByTestId('taps')).toHaveTextContent('1');
  });

  it('a 1×, un dedo no mueve el gráfico (desplaza la página)', () => {
    const box = setup();
    expect(box).toHaveStyle({ touchAction: 'pan-x pan-y' });
    fireEvent.pointerDown(box, touch(1, 100));
    fireEvent.pointerMove(box, touch(1, 160));
    expect(view()).toBe('1.00 0.00 0.00');
  });

  it('con zoom, arrastrar desplaza sin salir del recuadro; un toque corto no es arrastre', () => {
    const box = setup({ scale: 2, x: -0.5, y: -0.5 });
    fireEvent.pointerDown(box, touch(1, 100));
    fireEvent.pointerMove(box, touch(1, 102));
    fireEvent.pointerUp(box, touch(1, 102));
    fireEvent.click(box);
    expect(screen.getByTestId('taps')).toHaveTextContent('1');
    expect(view()).toBe('2.00 -0.50 -0.50');

    fireEvent.pointerDown(box, touch(1, 100));
    fireEvent.pointerMove(box, touch(1, 140));
    expect(view()).toBe('2.00 -0.30 -0.50');
    // Más allá del borde, queda en el borde.
    fireEvent.pointerMove(box, touch(1, 400));
    expect(view()).toBe('2.00 0.00 -0.50');
    fireEvent.pointerUp(box, touch(1, 400));
  });

  it('Ctrl + rueda acerca en el cursor; la rueda sola no hace zoom', () => {
    const box = setup();
    fireEvent.wheel(box, { deltaY: -100, clientX: 100, clientY: 100 });
    expect(view()).toBe('1.00 0.00 0.00');
    const event = new WheelEvent('wheel', {
      deltaY: -139,
      clientX: 100,
      clientY: 100,
      ctrlKey: true,
      cancelable: true,
    });
    act(() => {
      box.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    // e^(139/200) ≈ 2.
    expect(view()).toBe('2.00 -0.50 -0.50');
  });
});
