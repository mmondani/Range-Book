import { useEffect, useState, type CSSProperties } from 'react';
import { cx } from '@/lib/cx';
import styles from './skeleton.module.css';

export const SKELETON_DELAY_MS = 300;

export interface SkeletonProps {
  shape?: 'block' | 'card' | 'text';
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  className?: string;
}

/** Placeholder de carga. Aparece recién si la carga tarda más de 300 ms. */
export function Skeleton({ shape = 'block', width, height, className }: SkeletonProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), SKELETON_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;
  return (
    <span
      aria-hidden="true"
      data-testid="skeleton"
      className={cx(styles.skeleton, shape !== 'block' && styles[shape], className)}
      style={{ width, height }}
    />
  );
}
