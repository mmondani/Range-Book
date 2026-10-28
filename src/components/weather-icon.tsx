import { Cloud, CloudFog, CloudRain, Sun, Wind, type LucideIcon } from 'lucide-react';
import { cx } from '@/lib/cx';
import { WEATHER_LABELS, type Weather } from '@/lib/sessions';
import styles from './weather-icon.module.css';

const ICONS: Record<Weather, LucideIcon> = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  fog: CloudFog,
  windy: Wind,
};

export interface WeatherIconProps {
  weather: Weather;
  /** Decorativo si va junto al nombre del clima; si va solo, se anuncia con el nombre. */
  decorative?: boolean;
  size?: number;
  className?: string;
}

/** Ícono del clima (Lucide), con el color de `design-system.md`. */
export function WeatherIcon({
  weather,
  decorative = false,
  size = 18,
  className,
}: WeatherIconProps) {
  const Icon = ICONS[weather];
  return (
    <Icon
      size={size}
      className={cx(styles[weather], className)}
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': WEATHER_LABELS[weather] })}
    />
  );
}
