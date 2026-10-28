import { Boxes, Construction, Crosshair, Layers, MapPin, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import {
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router';
import { EmptyState } from '@/components/empty-state';
import { FirearmCards } from '@/components/firearm-cards';
import { Input } from '@/components/input';
import { InventoryItems } from '@/components/inventory-items';
import { LinkButton } from '@/components/link-button';
import { ModificationTags } from '@/components/modification-tags';
import { tabPanelProps, Tabs, type TabItem } from '@/components/tabs';
import { useCollection, type CollectionState } from '@/hooks/use-collection';
import { useFirearmModifications } from '@/hooks/use-firearm-modifications';
import {
  OPENED_FROM_LIST,
  useArchiveActions,
  useInventoryRepositories,
  type InventoryOutletContext,
} from '@/hooks/use-inventory';
import { useIsDesktop } from '@/hooks/use-media-query';
import {
  configurationModifications,
  configurationName,
  configurationSessions,
  firearmName,
  modificationName,
  type Configuration,
} from '@/lib/firearms';
import { formatInteger } from '@/lib/format';
import {
  activeItems,
  ammunitionName,
  archivedItems,
  INVENTORY_CATEGORIES,
  NEW_ITEM_SEGMENT,
  parseCategory,
  rangeName,
  type Archivable,
  type InventoryCategory,
} from '@/lib/inventory';
import styles from './inventory-screen.module.css';

const TABS_ID = 'inventory';
const ARCHIVED_PARAM = 'archivados';

const CATEGORY_LABELS: Record<InventoryCategory, string> = {
  armas: 'Armas',
  configuraciones: 'Configuraciones',
  municiones: 'Munición',
  poligonos: 'Polígonos',
  blancos: 'Blancos',
};

/** Botón primario de cada categoría. Las que todavía no tienen ABM no lo muestran. */
const NEW_LABELS: Partial<Record<InventoryCategory, string>> = {
  armas: 'Nueva arma',
  configuraciones: 'Nueva configuración',
  municiones: 'Nueva munición',
  poligonos: 'Nuevo polígono',
};

const CONFIGURATION_MESSAGES = {
  archived: 'Configuración archivada',
  restored: 'Configuración restaurada',
};

const AMMUNITION_MESSAGES = { archived: 'Munición archivada', restored: 'Munición restaurada' };
const RANGE_MESSAGES = { archived: 'Polígono archivado', restored: 'Polígono restaurado' };

function count<T extends Archivable>(state: CollectionState<T>, pick: (items: T[]) => T[]) {
  return state.status === 'ready' ? pick(state.items).length : undefined;
}

/** M08 / W06 · Inventario. Los sheets de alta y edición son rutas hijas. */
export function InventoryScreen() {
  const category = parseCategory(useParams().category);
  const navigate = useNavigate();
  const { search } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDesktop = useIsDesktop();
  const [query, setQuery] = useState('');

  const repositories = useInventoryRepositories();
  const firearms = useCollection(repositories.firearms);
  const configurations = useCollection(repositories.configurations);
  const usage = useCollection(repositories.usage);
  const modifications = useFirearmModifications(
    firearms.status === 'ready' ? firearms.items.map((item) => item.id) : [],
  );
  const ammunition = useCollection(repositories.ammunition);
  const ranges = useCollection(repositories.ranges);
  const ammunitionActions = useArchiveActions(repositories.ammunition, AMMUNITION_MESSAGES);
  const rangeActions = useArchiveActions(repositories.ranges, RANGE_MESSAGES);
  const configurationActions = useArchiveActions(
    repositories.configurations,
    CONFIGURATION_MESSAGES,
  );

  if (!category) return <Navigate to="/inventario/armas" replace />;

  const showArchived = searchParams.get(ARCHIVED_PARAM) === '1';
  const listPath = `/inventario/${category}${search}`;
  const states: Partial<Record<InventoryCategory, CollectionState<Archivable>>> = {
    armas: firearms,
    configuraciones: configurations,
    municiones: ammunition,
    poligonos: ranges,
  };
  const current = states[category];
  const archivedCount = current ? (count(current, archivedItems) ?? 0) : 0;
  const newLabel = NEW_LABELS[category];
  // La búsqueda solo está en desktop (W06).
  const searchText = isDesktop ? query : '';

  const tabs: ReadonlyArray<TabItem<InventoryCategory>> = INVENTORY_CATEGORIES.map((value) => {
    const state = states[value];
    return { value, label: CATEGORY_LABELS[value], count: state && count(state, activeItems) };
  });

  function itemPath(path: string) {
    return { pathname: `/inventario/${category}/${path}`, search };
  }

  function edit(item: Archivable) {
    navigate(itemPath(`${item.id}/editar`), { state: OPENED_FROM_LIST });
  }

  function toggleArchived(checked: boolean) {
    setSearchParams(
      (params) => {
        if (checked) params.set(ARCHIVED_PARAM, '1');
        else params.delete(ARCHIVED_PARAM);
        return params;
      },
      { replace: true },
    );
  }

  const newPath = itemPath(NEW_ITEM_SEGMENT[category]);

  function newButton(label: string) {
    return (
      <LinkButton variant="primary" to={newPath} state={OPENED_FROM_LIST}>
        <Plus aria-hidden="true" size={18} />
        {label}
      </LinkButton>
    );
  }

  const outlet: InventoryOutletContext = {
    firearms,
    configurations,
    ammunition,
    ranges,
    listPath,
  };

  const usageItems = usage.status === 'ready' ? usage.items : [];
  const configurationItems = configurations.status === 'ready' ? configurations.items : [];
  const firearmById = new Map(
    (firearms.status === 'ready' ? firearms.items : []).map((firearm) => [firearm.id, firearm]),
  );
  const baseName = (configuration: Configuration) => {
    const base = firearmById.get(configuration.firearmId);
    return base ? firearmName(base) : '';
  };
  const includedModifications = (configuration: Configuration) =>
    configurationModifications(configuration, modifications?.get(configuration.firearmId) ?? []);
  const configurationTags = (configuration: Configuration) => (
    <ModificationTags
      aria-label={`Modificaciones de ${configuration.name}`}
      modifications={includedModifications(configuration)}
    />
  );

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={`display ${styles.title}`}>Inventario</h1>
        <div className={styles.headerActions}>
          {isDesktop && current && (
            <div className={styles.search}>
              <Search aria-hidden="true" size={20} className={styles.searchIcon} />
              <Input
                type="search"
                aria-label="Buscar en inventario"
                placeholder="Buscar…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className={styles.searchInput}
              />
            </div>
          )}
          {newLabel && newButton(newLabel)}
        </div>
      </header>

      <div className={styles.toolbar}>
        <Tabs
          id={TABS_ID}
          aria-label="Categorías"
          tabs={tabs}
          value={category}
          onChange={(next) => navigate({ pathname: `/inventario/${next}`, search })}
          className={styles.tabs}
        />
        {current && (archivedCount > 0 || showArchived) && (
          <label className={styles.archivedToggle}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => toggleArchived(event.target.checked)}
            />
            Mostrar archivados <span className="num">({archivedCount})</span>
          </label>
        )}
      </div>

      <div {...tabPanelProps(TABS_ID, category)} className={styles.panel}>
        {category === 'armas' && (
          <InventoryItems
            aria-label="Armas"
            state={firearms}
            name={firearmName}
            searchFields={(item) => [item.brand, item.model, item.caliber]}
            showArchived={showArchived}
            query={searchText}
            empty={{
              icon: <Crosshair />,
              title: 'Sin armas',
              text: 'Cargá tus armas para registrar sesiones y llevar la cuenta de los tiros.',
              action: newButton('Nueva arma'),
            }}
            render={(items) => (
              <FirearmCards
                aria-label="Armas"
                firearms={items}
                modifications={modifications}
                configurations={configurationItems}
                usage={usageItems}
              />
            )}
          />
        )}
        {category === 'configuraciones' && (
          <>
            <p className={styles.help}>
              Un arma base + modificaciones. Se eligen al crear una sesión.
            </p>
            <InventoryItems
              aria-label="Configuraciones"
              state={configurations}
              name={configurationName}
              searchFields={(item) => [
                item.name,
                baseName(item),
                ...includedModifications(item).map(modificationName),
              ]}
              showArchived={showArchived}
              query={searchText}
              detail={(item) => `Base: ${baseName(item)}`}
              extra={configurationTags}
              columns={[
                { key: 'name', header: 'Nombre', kind: 'primary', cell: configurationName },
                { key: 'firearm', header: 'Arma base', cell: baseName },
                { key: 'modifications', header: 'Modificaciones', cell: configurationTags },
                {
                  key: 'sessions',
                  header: 'Sesiones',
                  cell: (item) => (
                    <span className="num">
                      {formatInteger(configurationSessions(usageItems, item.firearmId, item.id))}
                    </span>
                  ),
                },
              ]}
              empty={{
                icon: <Layers />,
                title: 'Sin configuraciones',
                text: 'Combiná un arma con sus modificaciones para elegirla en una sesión. El arma sin modificaciones ya está disponible como «Stock».',
                action: newButton('Nueva configuración'),
              }}
              onEdit={edit}
              onRestore={configurationActions.restore}
            />
          </>
        )}
        {category === 'municiones' && (
          <InventoryItems
            aria-label="Munición"
            state={ammunition}
            name={ammunitionName}
            searchFields={(item) => [item.brand, item.model, item.description]}
            showArchived={showArchived}
            query={searchText}
            title={ammunitionName}
            detail={(item) => item.description}
            columns={[
              { key: 'brand', header: 'Marca', kind: 'primary', cell: (item) => item.brand },
              { key: 'model', header: 'Modelo', cell: (item) => item.model },
              {
                key: 'description',
                header: 'Descripción',
                kind: 'muted',
                cell: (item) => item.description,
              },
            ]}
            empty={{
              icon: <Boxes />,
              title: 'Sin munición',
              text: 'Cargá las municiones que usás para elegirlas al registrar una sesión.',
              action: newButton('Nueva munición'),
            }}
            onEdit={edit}
            onRestore={ammunitionActions.restore}
          />
        )}
        {category === 'poligonos' && (
          <InventoryItems
            aria-label="Polígonos"
            state={ranges}
            name={rangeName}
            searchFields={(item) => [item.name, item.address]}
            showArchived={showArchived}
            query={searchText}
            icon={<MapPin size={24} />}
            title={rangeName}
            detail={(item) => item.address}
            columns={[
              { key: 'name', header: 'Nombre', kind: 'primary', cell: rangeName },
              { key: 'address', header: 'Dirección', kind: 'muted', cell: (item) => item.address },
            ]}
            empty={{
              icon: <MapPin />,
              title: 'Sin polígonos',
              text: 'Cargá los polígonos donde entrenás para elegirlos al registrar una sesión.',
              action: newButton('Nuevo polígono'),
            }}
            onEdit={edit}
            onRestore={rangeActions.restore}
          />
        )}
        {!current && (
          <EmptyState
            icon={<Construction />}
            title="En construcción"
            text="Esta categoría llega en los próximos pasos."
          />
        )}
      </div>

      <Outlet context={outlet} />
    </div>
  );
}
