import { WEATHER_LABELS, WEATHER_OPTIONS, type Weather } from '@/lib/sessions';
import { Chip } from './chip';
import { ChipGroup } from './chip-group';
import { useFieldContext } from './field-context';
import { WeatherIcon } from './weather-icon';

export interface WeatherPickerProps {
  value: Weather | null;
  /** Tocar el clima elegido lo desmarca (el campo es opcional). */
  onChange: (value: Weather | null) => void;
}

/** Clima como chips de radio. Usar dentro de un `Field` con `kind="group"`. */
export function WeatherPicker({ value, onChange }: WeatherPickerProps) {
  const field = useFieldContext();
  return (
    <ChipGroup role="radiogroup" aria-labelledby={field?.labelId}>
      {WEATHER_OPTIONS.map((weather) => (
        <Chip
          key={weather}
          role="radio"
          aria-checked={value === weather}
          selected={value === weather}
          icon={<WeatherIcon weather={weather} decorative />}
          onClick={() => onChange(value === weather ? null : weather)}
        >
          {WEATHER_LABELS[weather]}
        </Chip>
      ))}
    </ChipGroup>
  );
}
