import { STANDALONE_QUERY } from './auth';

/** Cómo se instala la app: con el diálogo del navegador, con instrucciones (iOS) o no se puede. */
export type InstallMethod = 'prompt' | 'ios' | null;

/** Si la app está abierta como PWA instalada. */
export function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || (window.matchMedia?.(STANDALONE_QUERY).matches ?? false);
}

export interface DeviceInfo {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}

/** iPhone o iPad (el iPad con iPadOS 13+ se presenta como Mac, pero tiene pantalla táctil). */
export function isIos({ userAgent, platform, maxTouchPoints }: DeviceInfo): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

/**
 * Instalada, no se ofrece. En iOS no existe `beforeinstallprompt`: se explica cómo agregarla a
 * la pantalla de inicio. En el resto, solo si el navegador ofreció instalarla.
 */
export function installMethod({
  standalone,
  ios,
  canPrompt,
}: {
  standalone: boolean;
  ios: boolean;
  canPrompt: boolean;
}): InstallMethod {
  if (standalone) return null;
  if (canPrompt) return 'prompt';
  return ios ? 'ios' : null;
}
