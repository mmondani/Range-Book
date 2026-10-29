import { useEffect, useState } from 'react';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import type { DatasetFolder } from '../data/dataset-folder';
import type { RememberedFolder, ToolServices } from '../services';
import styles from './tool.module.css';

export interface FolderGateProps {
  services: ToolServices;
  onOpen: (folder: DatasetFolder | null) => void;
  opening: boolean;
  error?: string;
}

/** Pantalla inicial: abrir la carpeta del set (o seguir con la de la última vez). */
export function FolderGate({ services, onOpen, opening, error }: FolderGateProps) {
  const [remembered, setRemembered] = useState<RememberedFolder | null>(null);
  const [denied, setDenied] = useState(false);
  const supported = services.supportsFolders();

  useEffect(() => {
    if (!supported) return;
    let active = true;
    services.rememberedFolder().then(
      (folder) => active && setRemembered(folder),
      () => {},
    );
    return () => {
      active = false;
    };
  }, [services, supported]);

  async function reopen() {
    if (!remembered) return;
    setDenied(false);
    const folder = await remembered.reopen();
    if (!folder) setDenied(true);
    onOpen(folder);
  }

  async function pick() {
    setDenied(false);
    try {
      onOpen(await services.pickFolder());
    } catch {
      setDenied(true);
    }
  }

  return (
    <main className={styles.gate}>
      <h1 className={styles.title}>Calibración de la detección</h1>
      <p className={styles.muted}>
        Abrí la carpeta del set de fotos (por ejemplo <code>calibration/dataset/</code>, que está
        fuera del repo). Las fotos, <code>dataset.json</code> y los resultados de la evaluación se
        guardan ahí.
      </p>
      {!supported ? (
        <Alert title="Este navegador no permite abrir carpetas">Usá Chrome en una PC.</Alert>
      ) : (
        <div className={styles.row}>
          {remembered && (
            <Button variant="primary" onClick={() => void reopen()} loading={opening}>
              Seguir con «{remembered.name}»
            </Button>
          )}
          <Button
            variant={remembered ? 'secondary' : 'primary'}
            onClick={() => void pick()}
            loading={opening && !remembered}
          >
            Abrir carpeta del set
          </Button>
        </div>
      )}
      {denied && (
        <Alert tone="warning" title="No se pudo abrir la carpeta">
          Hace falta permiso para leer y escribir en ella.
        </Alert>
      )}
      {error && <Alert title="No se pudo abrir el set">{error}</Alert>}
    </main>
  );
}
