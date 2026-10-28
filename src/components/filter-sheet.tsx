import type { FilterOption } from '@/lib/performance';
import { BottomSheet } from './bottom-sheet';
import { Chip } from './chip';
import { ChipGroup } from './chip-group';

export interface FilterSheetProps {
  open: boolean;
  /** Nombre del filtro: «Munición». */
  title: string;
  options: readonly FilterOption[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

/** Opciones de un filtro en mobile: tocar una la aplica y cierra el sheet. */
export function FilterSheet({ open, title, options, value, onSelect, onClose }: FilterSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title} eyebrow="Filtrar por">
      <ChipGroup role="group" aria-label={title}>
        {options.map((option) => (
          <Chip
            key={option.value}
            selected={option.value === value}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </Chip>
        ))}
      </ChipGroup>
    </BottomSheet>
  );
}
