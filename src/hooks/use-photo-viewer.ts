import { useId } from 'react';
import { useLocation, useNavigate } from 'react-router';

/** Lo que se guarda en el estado del historial mientras el visor está abierto. */
interface ViewerState {
  photoViewer?: { group: string; index: number };
}

export interface PhotoViewerControl {
  /** La foto abierta, o `null` si el visor está cerrado. */
  index: number | null;
  open: (index: number) => void;
  close: () => void;
}

/**
 * Abre el visor de fotos de un grupo (una galería, una tira, un selector) con una entrada propia en
 * el historial: "atrás" lo cierra. La URL no cambia, así los formularios no lo toman como salir.
 */
export function usePhotoViewer(): PhotoViewerControl {
  const group = useId();
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state ?? null) as (ViewerState & Record<string, unknown>) | null;
  const opened = state?.photoViewer?.group === group ? state.photoViewer.index : null;

  function open(index: number) {
    navigate(location, { state: { ...state, photoViewer: { group, index } } });
  }

  function close() {
    // Si se entró con el visor abierto (por ejemplo, al recargar), no hay adónde volver.
    if (location.key !== 'default') {
      navigate(-1);
      return;
    }
    const rest = { ...state };
    delete rest.photoViewer;
    navigate(location, { replace: true, state: rest });
  }

  return { index: opened, open, close };
}
