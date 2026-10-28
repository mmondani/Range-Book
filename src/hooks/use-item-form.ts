import { useState } from 'react';
import { hasErrors, type FieldErrors } from '@/lib/inventory';

export interface ItemFormOptions<I> {
  initial: I;
  validate: (input: I) => FieldErrors<I>;
  /** Guarda el borrador ya validado. Si falla, el formulario queda abierto. */
  save: (input: I) => Promise<void>;
}

/** Igualdad de un campo: las listas (fotos, modificaciones elegidas) se comparan por contenido. */
function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => item === b[index]);
  }
  return a === b;
}

/** Estado de un formulario corto del inventario: borrador, errores y guardado. */
export function useItemForm<I extends object>({ initial, validate, save }: ItemFormOptions<I>) {
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors<I>>({});
  const [errorAttempt, setErrorAttempt] = useState(0);
  const [saving, setSaving] = useState(false);

  const dirty = (Object.keys(initial) as Array<keyof I>).some(
    (key) => !sameValue(draft[key], initial[key]),
  );

  function setField<K extends keyof I>(key: K, value: I[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    // Al corregir un campo se borra su error; se vuelve a validar al guardar.
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  }

  async function submit() {
    const next = validate(draft);
    setErrors(next);
    if (hasErrors(next)) {
      setErrorAttempt((attempt) => attempt + 1);
      return;
    }
    setSaving(true);
    try {
      await save(draft);
    } finally {
      setSaving(false);
    }
  }

  return { draft, errors, errorAttempt, saving, dirty, setField, submit };
}
