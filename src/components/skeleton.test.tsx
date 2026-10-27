import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Skeleton, SKELETON_DELAY_MS } from './skeleton';

describe('Skeleton', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('aparece recién si la carga tarda más de 300 ms', () => {
    vi.useFakeTimers();
    render(<Skeleton shape="card" height={96} />);
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(SKELETON_DELAY_MS));
    expect(screen.getByTestId('skeleton')).toHaveAttribute('aria-hidden', 'true');
  });
});
