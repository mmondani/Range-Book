import { useState } from 'react';
import { Link } from 'react-router';
import { Field } from '@/components/field';
import { Input } from '@/components/input';
import { InventorySheet } from '@/components/inventory-sheet';
import { ModificationChecklist } from '@/components/modification-checklist';
import { Select } from '@/components/select';
import { useCollection, type CollectionSource } from '@/hooks/use-collection';
import { useInventoryRepositories } from '@/hooks/use-inventory';
import { useInventorySheet } from '@/hooks/use-inventory-sheet';
import {
  cleanConfiguration,
  firearmName,
  modificationName,
  validateConfiguration,
  type Configuration,
  type ConfigurationInput,
  type Firearm,
  type Modification,
} from '@/lib/firearms';
import { NAME_MAX_LENGTH, selectableItems, sortByName } from '@/lib/inventory';

const MESSAGES = {
  created: 'Configuración agregada',
  archived: 'Configuración archivada',
  restored: 'Configuración restaurada',
};

// Sin arma elegida no hay modificaciones que mostrar.
const NO_MODIFICATIONS: CollectionSource<Modification> = {
  subscribe(_uid, onItems) {
    onItems([]);
    return () => {};
  },
};

export interface ConfigurationSheetProps {
  item?: Configuration;
  /** Arma fija (desde su detalle). Sin ella, se elige entre `firearms`. */
  firearm?: Firearm;
  firearms: readonly Firearm[];
  /** Todas las configuraciones, para no repetir nombres. */
  configurations: readonly Configuration[];
}

/**
 * Alta y edición de una configuración (arma virtual): nombre y modificaciones del arma. Al editar,
 * el arma base no cambia.
 */
export function ConfigurationSheet({
  item,
  firearm,
  firearms,
  configurations,
}: ConfigurationSheetProps) {
  const repositories = useInventoryRepositories();
  // Fijo: el borrador se compara contra él para saber si hay cambios (la lista, por referencia).
  const [initial] = useState<ConfigurationInput>(() =>
    item
      ? { name: item.name, firearmId: item.firearmId, modificationIds: item.modificationIds }
      : { name: '', firearmId: firearm?.id ?? '', modificationIds: [] },
  );
  const sheet = useInventorySheet({
    item,
    initial,
    validate: (input) => validateConfiguration(input, configurations, item?.id),
    clean: cleanConfiguration,
    repository: repositories.configurations,
    messages: MESSAGES,
  });
  const { draft, errors, setField } = sheet.form;
  const fixedFirearm = Boolean(item || firearm);
  const base = firearms.find((candidate) => candidate.id === draft.firearmId) ?? firearm;

  const modificationsState = useCollection(
    draft.firearmId ? repositories.modifications(draft.firearmId) : NO_MODIFICATIONS,
  );
  // Solo las activas, salvo las que ya estaban elegidas.
  const options =
    modificationsState.status === 'ready'
      ? sortByName(
          modificationsState.items.filter(
            (modification) =>
              !modification.archived || draft.modificationIds.includes(modification.id),
          ),
          modificationName,
        )
      : [];
  const firearmOptions = selectableItems(firearms, firearmName, draft.firearmId);

  function chooseFirearm(firearmId: string) {
    setField('firearmId', firearmId);
    setField('modificationIds', []);
  }

  return (
    <InventorySheet
      title={item ? 'Editar configuración' : 'Nueva configuración'}
      eyebrow={base ? firearmName(base) : 'Inventario'}
      submitLabel={item ? 'Guardar cambios' : 'Guardar configuración'}
      archive={sheet.archive && { label: 'Archivar configuración', ...sheet.archive }}
      {...sheet.props}
    >
      {!fixedFirearm && (
        <Field label="Arma base" required error={errors.firearmId}>
          <Select
            value={draft.firearmId}
            onChange={(event) => chooseFirearm(event.target.value)}
            data-autofocus
          >
            <option value="">Elegí un arma</option>
            {firearmOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {firearmName(option)}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Nombre" required error={errors.name}>
        <Input
          value={draft.name}
          onChange={(event) => setField('name', event.target.value)}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="off"
          placeholder="Ej: Config. IPSC"
          data-autofocus={fixedFirearm || undefined}
        />
      </Field>
      {draft.firearmId && (
        <Field
          label="Modificaciones"
          kind="group"
          required
          error={errors.modificationIds}
          help={
            modificationsState.status === 'ready' && options.length === 0 ? (
              <>
                Esta arma no tiene modificaciones.{' '}
                <Link to={`/inventario/armas/${draft.firearmId}`}>Agregalas desde su detalle</Link>.
              </>
            ) : undefined
          }
        >
          <ModificationChecklist
            options={options}
            selected={draft.modificationIds}
            onChange={(ids) => setField('modificationIds', ids)}
          />
        </Field>
      )}
    </InventorySheet>
  );
}
