import { modificationName, type Modification } from '@/lib/firearms';
import { Tag } from './tag';
import { TagList } from './tag-list';

export interface ModificationTagsProps {
  modifications: readonly Modification[];
  'aria-label'?: string;
  className?: string;
}

/** Modificaciones de una configuración. Las archivadas se ven atenuadas y lo dicen. */
export function ModificationTags({
  modifications,
  'aria-label': ariaLabel = 'Modificaciones',
  className,
}: ModificationTagsProps) {
  return (
    <TagList aria-label={ariaLabel} className={className}>
      {modifications.map((modification) => (
        <li key={modification.id}>
          <Tag muted={modification.archived}>
            {modificationName(modification)}
            {modification.archived && ' (archivada)'}
          </Tag>
        </li>
      ))}
    </TagList>
  );
}
