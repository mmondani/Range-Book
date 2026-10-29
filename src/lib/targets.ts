import { formatDecimal, formatInteger, parseDecimal } from './format';
import type { Archivable, FieldErrors } from './inventory';
import { storedPhotos, type PhotoDraft } from './photos';
import {
  hasZoneErrors,
  MAX_REFERENCE_MM,
  MAX_ZONE_SCORE,
  MAX_ZONES,
  sortZones,
  validateZones,
  type TargetZone,
  type ZoneErrors,
  type ZoneValues,
} from './target-zones';

/** Anillos concéntricos (el análisis calcula el puntaje) o sin zonas (puntaje manual). */
export type TargetScoring = 'rings' | 'none';

/** Lo que se guarda de un blanco (sin `id` ni `archived`). */
export interface TargetInput {
  name: string;
  /** Ruta en Storage, o `null` si no tiene foto. */
  photo: string | null;
  scoring: TargetScoring;
  /** Diámetro de la zona exterior (anillos) o ancho del blanco (sin zonas). */
  referenceSizeMm: number;
  /** De mayor a menor puntaje. Vacío si no tiene zonas. */
  zones: TargetZone[];
}

export interface Target extends TargetInput, Archivable {}

/** Fila del editor de zonas, con los valores como se escriben. */
export interface ZoneDraft {
  /** Clave estable para la lista de React. */
  key: string;
  score: string;
  diameter: string;
}

/** Borrador del formulario M12. */
export interface TargetDraft {
  name: string;
  /** Cero o una foto. */
  photos: PhotoDraft[];
  scoring: TargetScoring;
  referenceSize: string;
  /** Se conservan al pasar a "Sin zonas", pero solo se guardan con anillos. */
  zones: ZoneDraft[];
}

export function targetName({ name }: Pick<TargetInput, 'name'>): string {
  return name;
}

let nextZoneKey = 0;

export function zoneDraft(zone?: TargetZone): ZoneDraft {
  return {
    key: `zone-${++nextZoneKey}`,
    score: zone ? String(zone.score) : '',
    diameter: zone ? formatDecimal(zone.diameterMm) : '',
  };
}

export function targetDraft(target?: Target): TargetDraft {
  if (!target) {
    return { name: '', photos: [], scoring: 'rings', referenceSize: '', zones: [] };
  }
  return {
    name: target.name,
    photos: storedPhotos(target.photo ? [target.photo] : []),
    scoring: target.scoring,
    referenceSize: target.referenceSizeMm > 0 ? formatDecimal(target.referenceSizeMm) : '',
    zones: target.zones.map(zoneDraft),
  };
}

function parseScore(value: string): number | undefined {
  const text = value.trim();
  return /^\d+$/.test(text) ? Number(text) : undefined;
}

function zoneValues(zones: readonly ZoneDraft[]): ZoneValues[] {
  return zones.map((zone) => ({
    score: parseScore(zone.score),
    diameterMm: parseDecimal(zone.diameter),
  }));
}

/** Tamaño de referencia del borrador; `undefined` si no es un número mayor que 0 y razonable. */
export function referenceSize(draft: Pick<TargetDraft, 'referenceSize'>): number | undefined {
  const value = parseDecimal(draft.referenceSize);
  return value !== undefined && value > 0 && value <= MAX_REFERENCE_MM ? value : undefined;
}

/** Errores de cada fila de zonas, contra el tamaño de referencia si es válido. */
export function targetZoneErrors(draft: TargetDraft): ZoneErrors[] {
  return validateZones(zoneValues(draft.zones), referenceSize(draft));
}

export function validateTarget(draft: TargetDraft): FieldErrors<TargetDraft> {
  const errors: FieldErrors<TargetDraft> = {};
  if (!draft.name.trim()) errors.name = 'Ingresá el nombre';

  const reference = parseDecimal(draft.referenceSize);
  if (reference === undefined || reference <= 0) {
    errors.referenceSize =
      draft.scoring === 'rings'
        ? 'Ingresá el diámetro de la zona exterior'
        : 'Ingresá el ancho del blanco';
  } else if (reference > MAX_REFERENCE_MM) {
    errors.referenceSize = `Hasta ${formatInteger(MAX_REFERENCE_MM)} mm`;
  }

  if (draft.scoring === 'rings') {
    if (draft.zones.length === 0) errors.zones = 'Agregá al menos una zona o usá «Generar»';
    else if (draft.zones.length > MAX_ZONES) {
      errors.zones = `Podés cargar hasta ${MAX_ZONES} zonas`;
    } else if (hasZoneErrors(targetZoneErrors(draft))) {
      errors.zones = 'Revisá las zonas marcadas';
    }
  }
  return errors;
}

/** Documento a guardar a partir del borrador ya validado y la ruta de su foto ya subida. */
export function targetInput(draft: TargetDraft, photo: string | null): TargetInput {
  const zones =
    draft.scoring === 'rings'
      ? sortZones(
          zoneValues(draft.zones).map(({ score, diameterMm }) => ({
            score: score ?? 0,
            diameterMm: diameterMm ?? 0,
          })),
        )
      : [];
  return {
    name: draft.name.trim(),
    photo,
    scoring: draft.scoring,
    referenceSizeMm: referenceSize(draft) ?? 0,
    zones,
  };
}

/** «Anillos · Ø 500 mm · 10 zonas» o «Sin zonas · puntaje manual». */
export function targetSummary({ scoring, referenceSizeMm, zones }: TargetInput): string {
  if (scoring === 'none') return 'Sin zonas · puntaje manual';
  const count = zones.length === 1 ? '1 zona' : `${formatInteger(zones.length)} zonas`;
  return `Anillos · Ø ${formatDecimal(referenceSizeMm)} mm · ${count}`;
}

/** Puntaje de la zona más alta; `null` si el blanco no tiene zonas (no hay máximo). */
export function maxZoneScore(
  target: { scoring: TargetScoring; zones: readonly TargetZone[] } | undefined,
): number | null {
  if (!target || target.scoring !== 'rings' || target.zones.length === 0) return null;
  return Math.max(...target.zones.map((zone) => zone.score));
}

// --- Lectura de Firestore --------------------------------------------------------------------

function positive(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function parseZones(value: unknown): TargetZone[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((zone: unknown) => {
    const { score, diameterMm } = (zone ?? {}) as Record<string, unknown>;
    return typeof score === 'number' && positive(diameterMm) > 0
      ? [{ score, diameterMm: diameterMm as number }]
      : [];
  });
}

export function parseTarget(id: string, data: Record<string, unknown>): Target {
  const scoring: TargetScoring = data.scoring === 'none' ? 'none' : 'rings';
  return {
    id,
    name: typeof data.name === 'string' ? data.name : '',
    photo: typeof data.photo === 'string' ? data.photo : null,
    scoring,
    referenceSizeMm: positive(data.referenceSizeMm),
    zones: scoring === 'rings' ? sortZones(parseZones(data.zones)) : [],
    archived: data.archived === true,
  };
}

// --- Copia para la herramienta de calibración ------------------------------------------------

/** Lo que la herramienta de `calibration/` necesita de un blanco. */
export type TargetDefinition = Pick<TargetInput, 'name' | 'scoring' | 'referenceSizeMm' | 'zones'>;

const CLIPBOARD_VERSION = 1;

/** Texto que "Copiar para calibración" deja en el portapapeles (JSON). */
export function targetClipboardText({
  name,
  scoring,
  referenceSizeMm,
  zones,
}: TargetDefinition): string {
  return JSON.stringify(
    {
      rangebook: 'target',
      version: CLIPBOARD_VERSION,
      name,
      scoring,
      referenceSizeMm,
      zones: zones.map(({ score, diameterMm }) => ({ score, diameterMm })),
    },
    null,
    2,
  );
}

/** Blanco pegado desde el portapapeles; `null` si el texto no es un blanco válido. */
export function parseTargetClipboard(text: string): TargetDefinition | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  if (data.rangebook !== 'target' || data.version !== CLIPBOARD_VERSION) return null;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const scoring = data.scoring;
  const referenceSizeMm = positive(data.referenceSizeMm);
  if (!name || (scoring !== 'rings' && scoring !== 'none')) return null;
  if (referenceSizeMm === 0 || referenceSizeMm > MAX_REFERENCE_MM) return null;
  if (scoring === 'none') return { name, scoring, referenceSizeMm, zones: [] };

  if (!Array.isArray(data.zones) || data.zones.length === 0 || data.zones.length > MAX_ZONES) {
    return null;
  }
  const zones = parseZones(data.zones);
  const valid =
    zones.length === data.zones.length &&
    zones.every(
      ({ score, diameterMm }) =>
        Number.isInteger(score) &&
        score >= 0 &&
        score <= MAX_ZONE_SCORE &&
        diameterMm <= MAX_REFERENCE_MM,
    );
  return valid ? { name, scoring, referenceSizeMm, zones: sortZones(zones) } : null;
}
