import { createContext, useContext } from 'react';

export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  'aria-required'?: true;
}

export interface FieldContextValue {
  control: FieldControlProps;
  labelId: string;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

/** Props de accesibilidad que `Field` le pasa a su control. Fuera de un `Field` devuelve `null`. */
export function useFieldContext(): FieldContextValue | null {
  return useContext(FieldContext);
}
