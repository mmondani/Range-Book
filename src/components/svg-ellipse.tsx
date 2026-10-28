import type { PixelEllipse } from '@/lib/calibration';

export interface SvgEllipseProps {
  ellipse: PixelEllipse;
  className?: string;
}

/** Elipse de SVG girada alrededor de su centro (`angle` en grados). */
export function SvgEllipse({ ellipse: { center, rx, ry, angle }, className }: SvgEllipseProps) {
  return (
    <ellipse
      cx={center.x}
      cy={center.y}
      rx={rx}
      ry={ry}
      transform={angle ? `rotate(${angle} ${center.x} ${center.y})` : undefined}
      className={className}
    />
  );
}
