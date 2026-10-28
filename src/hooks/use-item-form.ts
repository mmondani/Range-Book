import { useState } from 'react';
import { hasErrors, type FieldErrors } from '@/lib/inventory';

export interface ItemFormOptions<I> {
  /** Valores guardados: contra ellos se calcula si hay cambios. */
  initial: I;
  /** Borrador con el que arranca, si no es `initial` (por ejemplo, uno recuperado). */
  start?: I;
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

/** Estado de un formulario: borrador, errores y guardado. */
export function useItemForm<I extends object>({
  initial,
  start = initial,
  validate,
  save,
}: ItemFormOptions<I>) {
  const [draft, setDraft] = useState(start);
  const [errors, setErrors] = useState<FieldErrors<I>>({});
  const [errorAttempt, setErrorAttempt] = useState(0);
  const [saving, setSaving] = useState(false);

  const dirty = (Object.keys(initial) as Array<keyof I>).some(
    (key) => !sameValue(draft[key], initial[key]),
  );

  function clearErrors(keys: Array<keyof I>) {
    setErrors((current) =>
      keys.some((key) => current[key])
        ? { ...current, ...Object.fromEntries(keys.map((key) => [key, undefined])) }
        : current,
    );
  }

  function setField<K extends keyof I>(key: K, value: I[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    // Al corregir un campo se borra su error; se vuelve a validar al salir del campo o al guardar.
    clearErrors([key]);
  }

  /** Cambia varios campos a la vez (por ejemplo, el arma y lo que se precarga con ella). */
  function setFields(values: Partial<I>) {
    setDraft((current) => ({ ...current, ...values }));
    clearErrors(Object.keys(values) as Array<keyof I>);
  }

  /** Valida un campo al salir de él. */
  function touch(key: keyof I) {
    const error = validate(draft)[key];
    setErrors((current) => (current[key] === error ? current : { ...current, [key]: error }));
  }

  /** Vuelve a los valores guardados (por ejemplo, al descartar un borrador recuperado). */
  function reset() {
    setDraft(initial);
    setErrors({});
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

  return {
    draft,
    errors,
    errorAttempt,
    saving,
    dirty,
    setField,
    setFields,
    touch,
    reset,
    submit,
  };
}
