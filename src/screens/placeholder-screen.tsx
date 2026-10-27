import { Construction } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';

/** Pantalla provisoria para las secciones que todavía no se implementaron. */
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <>
      <h1 className="display" style={{ fontSize: 34 }}>
        {title}
      </h1>
      <EmptyState
        icon={<Construction />}
        title="En construcción"
        text="Esta sección llega en los próximos pasos."
      />
    </>
  );
}
