import { MAX_IMPACTS } from '@/lib/analysis';
import type { Calibration, Pixel } from '@/lib/calibration';
import { compressImage } from '@/lib/image-compression';
import {
  DEFAULT_TUNING,
  detectImpactsInPhoto,
  detectionScale,
  holeDiameterMm,
  type DetectionTuning,
} from '@/lib/impact-detection';
import { readImagePixels } from '@/lib/pixel-image';
import { centerDetectionScale, detectCenterInPhoto } from '@/lib/target-center';
import type { TargetDefinition } from '@/lib/targets';
import { evaluablePhotos, type Dataset } from './dataset';
import {
  buildReport,
  evaluatePhoto,
  type EvaluationReport,
  type PhotoEvaluation,
} from './evaluation';
import { scaleCalibration } from './labeling';

/** Lo que detecta la app en una foto, en píxeles de la foto original. */
export interface PhotoDetection {
  impacts: Pixel[];
  /** Solo en blancos con anillos; `null` si no encontró un centro claro. */
  center: Pixel | null;
  holeMm: number;
}

/**
 * Corre la detección como en la app: la foto se comprime igual que al subirla (lado mayor de
 * 2000 px, JPEG al 80 %), se reduce y se buscan los impactos con la calibración y, en blancos
 * con anillos, el centro. Necesita canvas: no se usa en los tests unitarios.
 */
export async function detectInPhoto(
  original: Blob,
  photo: { width: number; height: number; calibration: Calibration; caliber: string },
  target: Pick<TargetDefinition, 'scoring' | 'zones'>,
  tuning?: Partial<DetectionTuning>,
): Promise<PhotoDetection> {
  const compressed = await compressImage(original);
  const sx = compressed.width / photo.width;
  const sy = compressed.height / photo.height;
  const calibration = scaleCalibration(photo.calibration, sx, sy);
  const holeMm = holeDiameterMm(photo.caliber);
  const toOriginal = ({ x, y }: Pixel) => ({ x: x / sx, y: y / sy });

  const pixels = await readImagePixels(compressed.blob, detectionScale(calibration, holeMm));
  const impacts = detectImpactsInPhoto(pixels, calibration, target.zones, holeMm, {
    maxImpacts: MAX_IMPACTS,
    tuning,
  }).map(toOriginal);

  let center: Pixel | null = null;
  if (target.scoring === 'rings') {
    const size = { width: compressed.width, height: compressed.height };
    const small = await readImagePixels(compressed.blob, centerDetectionScale(size));
    const found = detectCenterInPhoto(small, size);
    center = found && toOriginal(found);
  }
  return { impacts, center, holeMm };
}

export interface EvaluationRun {
  readPhoto: (file: string) => Promise<Blob | null>;
  detect: typeof detectInPhoto;
  tuning: Partial<DetectionTuning>;
  onProgress?: (done: number, total: number) => void;
  now?: () => Date;
}

/**
 * Evalúa la detección en las fotos listas del set, de a una, y arma el reporte. Entre foto y
 * foto le devuelve el control al navegador para que se vea el progreso.
 */
export async function evaluateDataset(
  dataset: Dataset,
  { readPhoto, detect, tuning, onProgress, now = () => new Date() }: EvaluationRun,
): Promise<EvaluationReport> {
  const photos = evaluablePhotos(dataset);
  const evaluations: PhotoEvaluation[] = [];
  const failed: EvaluationReport['failed'] = [];
  for (const [index, photo] of photos.entries()) {
    const calibration = photo.calibration!;
    const target = dataset.targets.find((item) => item.id === photo.targetId);
    const blob = target ? await readPhoto(photo.file).catch(() => null) : null;
    if (!target) failed.push({ file: photo.file, error: 'No tiene blanco' });
    else if (!blob) failed.push({ file: photo.file, error: 'Falta el archivo en la carpeta' });
    else {
      try {
        const detection = await detect(blob, { ...photo, calibration }, target, tuning);
        evaluations.push(evaluatePhoto({ ...photo, calibration }, target.scoring, detection));
      } catch {
        failed.push({ file: photo.file, error: 'No se pudo leer la foto' });
      }
    }
    onProgress?.(index + 1, photos.length);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return buildReport(evaluations, { ...DEFAULT_TUNING, ...tuning }, now(), failed);
}
