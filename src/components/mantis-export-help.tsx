import { Check, ChevronDown, Copy } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { mantisBookmarklet } from '@/lib/mantis-bookmarklet';
import { Button } from './button';
import { Card } from './card';
import styles from './mantis-export-help.module.css';

export interface MantisExportHelpProps {
  /** Desplegable abierto al empezar (si nunca se importó). */
  defaultOpen?: boolean;
  /** Versión resumida, siempre abierta (columna lateral de desktop). */
  compact?: boolean;
}

const STEPS = [
  'Copiá el marcador con el botón de abajo.',
  'Creá un marcador nuevo en el navegador y pegá el texto copiado como su dirección (URL). Ponele de nombre "Exportar a Range Book".',
  'Entrá a train.mantisx.com con tu cuenta y abrí tu perfil.',
  'Tocá el marcador, elegí desde y hasta qué fecha exportar, y esperá a que se descargue el archivo.',
  'Volvé acá y elegí ese archivo.',
];

const COMPACT_STEPS = [
  'Copiá el marcador y creá uno nuevo en el navegador con ese texto como dirección (URL).',
  'Entrá a train.mantisx.com y abrí tu perfil.',
  'Tocá el marcador, elegí las fechas y esperá la descarga.',
  'Elegí el archivo acá.',
];

/**
 * Cómo exportar desde MantisX: los pasos y "Copiar el marcador". No se ofrece un link para
 * arrastrar a la barra de marcadores porque React bloquea los `javascript:`.
 */
export function MantisExportHelp({ defaultOpen = false, compact = false }: MantisExportHelpProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(mantisBookmarklet());
      setCopied(true);
    } catch {
      toast.show({ message: 'No se pudo copiar el marcador', tone: 'error' });
    }
  }

  const body = (
    <div className={styles.body}>
      <ol className={styles.steps}>
        {(compact ? COMPACT_STEPS : STEPS).map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <Button onClick={() => void copy()} className={styles.copy}>
        {copied ? <Check aria-hidden="true" size={18} /> : <Copy aria-hidden="true" size={18} />}
        <span aria-live="polite">{copied ? 'Marcador copiado' : 'Copiar el marcador'}</span>
      </Button>
      {!compact && (
        <p className={styles.note}>
          En Chrome para Android, para usarlo escribí "Exportar a Range Book" en la barra de
          direcciones y elegí el marcador. Tu contraseña de MantisX nunca pasa por Range Book.
        </p>
      )}
    </div>
  );

  if (compact) {
    return (
      <Card as="section" aria-labelledby="mantis-help-title" className={styles.compact}>
        <h2 id="mantis-help-title" className={styles.title}>
          Cómo exportar desde MantisX
        </h2>
        {body}
      </Card>
    );
  }
  return (
    <Card padded={false} className={styles.card}>
      <details open={defaultOpen} className={styles.details}>
        <summary className={styles.summary}>
          <span>Cómo exportar desde MantisX</span>
          <ChevronDown aria-hidden="true" size={18} className={styles.chevron} />
        </summary>
        {body}
      </details>
    </Card>
  );
}
