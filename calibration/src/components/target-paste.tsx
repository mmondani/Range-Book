import { useState } from 'react';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Textarea } from '@/components/textarea';
import { parseTargetClipboard, type TargetDefinition } from '@/lib/targets';
import styles from './tool.module.css';

const INVALID = 'El texto no es un blanco copiado de la app («Copiar para calibración»).';

export interface TargetPasteProps {
  onTarget: (definition: TargetDefinition) => void;
}

/**
 * Suma un blanco copiado desde la app (inventario → blanco → "Copiar para calibración"): con el
 * botón, que lee el portapapeles, o pegándolo en el campo.
 */
export function TargetPaste({ onTarget }: TargetPasteProps) {
  const [text, setText] = useState('');
  const [message, setMessage] = useState<{ error: boolean; text: string }>();

  function add(value: string) {
    const definition = parseTargetClipboard(value);
    if (!definition) {
      setMessage({ error: true, text: INVALID });
      return;
    }
    onTarget(definition);
    setText('');
    setMessage({ error: false, text: `Blanco «${definition.name}» agregado` });
  }

  async function paste() {
    try {
      add(await navigator.clipboard.readText());
    } catch {
      setMessage({ error: true, text: 'No se pudo leer el portapapeles: pegalo en el campo.' });
    }
  }

  return (
    <div className={styles.stack}>
      <Button onClick={() => void paste()}>Pegar blanco copiado de la app</Button>
      <Field label="O pegalo acá">
        <Textarea value={text} onChange={(event) => setText(event.target.value)} rows={2} />
      </Field>
      {text.trim() && <Button onClick={() => add(text)}>Agregar blanco</Button>}
      {message && (
        <p role="status" className={message.error ? styles.error : styles.muted}>
          {message.text}
        </p>
      )}
    </div>
  );
}
