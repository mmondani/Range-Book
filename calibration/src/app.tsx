import { PhotoProvider } from '@/components/photo-provider';
import { FolderGate } from './components/folder-gate';
import { Workspace } from './components/workspace';
import { useDatasetFolder } from './hooks/use-dataset-folder';
import { browserServices, localPhotoRepository, type ToolServices } from './services';

/** Herramienta de calibración: marcar el set de fotos y evaluar la detección. */
export function App({ services = browserServices }: { services?: ToolServices }) {
  const store = useDatasetFolder(services.measureImage);
  return (
    <PhotoProvider repository={localPhotoRepository}>
      {store.opened ? (
        <Workspace
          opened={store.opened}
          saveState={store.saveState}
          notice={store.notice}
          onUpdate={store.update}
          onAddFiles={(files) => void store.addFiles(files)}
          services={services}
        />
      ) : (
        <FolderGate
          services={services}
          onOpen={(folder) => void store.open(folder)}
          opening={store.opening}
          error={store.error}
        />
      )}
    </PhotoProvider>
  );
}
