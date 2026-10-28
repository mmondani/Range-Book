import { Archive, ChevronLeft, Pencil, Plus, RotateCcw, Wrench } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, Outlet, useNavigate, useParams } from 'react-router';
import { Alert } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ConfigurationCard } from '@/components/configuration-card';
import { InventoryItems } from '@/components/inventory-items';
import { LinkButton } from '@/components/link-button';
import { PhotoGallery } from '@/components/photo-gallery';
import { Skeleton } from '@/components/skeleton';
import { StatTile } from '@/components/stat-tile';
import { Tag } from '@/components/tag';
import { useCollection, type CollectionState } from '@/hooks/use-collection';
import {
  OPENED_FROM_LIST,
  useArchiveActions,
  useInventoryRepositories,
  type SheetOutletContext,
} from '@/hooks/use-inventory';
import {
  accumulatedShots,
  accumulatedShotsDetail,
  configurationModifications,
  configurationSessions,
  firearmConfigurations,
  firearmName,
  modificationName,
  type Configuration,
  type Firearm,
  type Modification,
} from '@/lib/firearms';
import { formatInteger, formatIsoDate } from '@/lib/format';
import { archivedItems } from '@/lib/inventory';
import { storedPhotos } from '@/lib/photos';
import styles from './firearm-screen.module.css';

const FIREARM_MESSAGES = { archived: 'Arma archivada', restored: 'Arma restaurada' };
const MODIFICATION_MESSAGES = {
  archived: 'Modificación archivada',
  restored: 'Modificación restaurada',
};
const CONFIGURATION_MESSAGES = {
  archived: 'Configuración archivada',
  restored: 'Configuración restaurada',
};

/** Lo que el detalle les pasa a sus sheets (rutas hijas). */
export interface FirearmOutletContext extends SheetOutletContext {
  firearm: Firearm;
  firearms: Firearm[];
  modifications: CollectionState<Modification>;
  configurations: CollectionState<Configuration>;
}

function itemsOf<T>(state: CollectionState<T>): T[] {
  return state.status === 'ready' ? state.items : [];
}

/** M09 / W07 · Detalle de arma: fotos, tiros acumulados, modificaciones y configuraciones. */
export function FirearmScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const repositories = useInventoryRepositories();
  const firearms = useCollection(repositories.firearms);
  const modifications = useCollection(repositories.modifications(id));
  const configurations = useCollection(repositories.configurations);
  const usage = useCollection(repositories.usage);
  const firearmActions = useArchiveActions(repositories.firearms, FIREARM_MESSAGES);
  const modificationActions = useArchiveActions(
    repositories.modifications(id),
    MODIFICATION_MESSAGES,
  );
  const configurationActions = useArchiveActions(
    repositories.configurations,
    CONFIGURATION_MESSAGES,
  );
  const [showArchivedModifications, setShowArchivedModifications] = useState(false);
  const [showArchivedConfigurations, setShowArchivedConfigurations] = useState(false);

  if (firearms.status === 'loading') {
    return (
      <div className={styles.loading} aria-busy="true" aria-label="Cargando el arma">
        <Skeleton shape="card" height={240} />
        <Skeleton shape="card" height={96} />
      </div>
    );
  }
  if (firearms.status === 'error') {
    return <Alert title="No se pudo cargar el arma">Revisá la conexión y volvé a intentar.</Alert>;
  }
  const firearm = firearms.items.find((item) => item.id === id);
  if (!firearm) return <Navigate to="/inventario/armas" replace />;

  const name = firearmName(firearm);
  const detailPath = `/inventario/armas/${firearm.id}`;
  const usageItems = itemsOf(usage);
  const shots = accumulatedShots(firearm, usageItems);
  const allModifications = itemsOf(modifications);
  const ownConfigurations = itemsOf(configurations).filter((c) => c.firearmId === firearm.id);
  const archivedModifications = archivedItems(allModifications).length;
  const archivedConfigurations = archivedItems(ownConfigurations).length;

  function open(path: string) {
    navigate(`${detailPath}/${path}`, { state: OPENED_FROM_LIST });
  }

  function addButton(path: string, label: string, ariaLabel?: string) {
    return (
      <LinkButton
        variant="ghost"
        to={`${detailPath}/${path}`}
        state={OPENED_FROM_LIST}
        aria-label={ariaLabel}
      >
        <Plus aria-hidden="true" size={18} />
        {label}
      </LinkButton>
    );
  }

  const outlet: FirearmOutletContext = {
    listPath: detailPath,
    firearm,
    firearms: firearms.items,
    modifications,
    configurations,
  };

  return (
    <div className={styles.screen}>
      <nav aria-label="Ruta" className={styles.breadcrumb}>
        <Link to="/inventario/armas" className={styles.back}>
          <ChevronLeft aria-hidden="true" size={20} />
          Armas
        </Link>
        <ol className={styles.trail}>
          <li>
            <Link to="/inventario/armas">Inventario</Link>
          </li>
          <li>
            <Link to="/inventario/armas">Armas</Link>
          </li>
          <li aria-current="page">{name}</li>
        </ol>
      </nav>

      <div className={styles.top}>
        <PhotoGallery
          photos={storedPhotos(firearm.photos)}
          label={`Fotos de ${name}`}
          className={styles.gallery}
        />

        <section className={styles.info} aria-label="Datos del arma">
          <header className={styles.header}>
            <div className={styles.titles}>
              <span className="eyebrow">{firearm.brand}</span>
              <h1 className={`display ${styles.title}`}>{firearm.model}</h1>
              <div className={styles.tags}>
                <Tag>{firearm.caliber}</Tag>
                {firearm.archived && <Badge>Archivada</Badge>}
              </div>
            </div>
            <div className={styles.actions}>
              <LinkButton variant="ghost" to={`${detailPath}/editar`} state={OPENED_FROM_LIST}>
                <Pencil aria-hidden="true" size={18} />
                Editar
              </LinkButton>
              {firearm.archived ? (
                <Button variant="ghost" onClick={() => void firearmActions.restore(firearm)}>
                  <RotateCcw aria-hidden="true" size={18} />
                  Restaurar
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => void firearmActions.archive(firearm)}>
                  <Archive aria-hidden="true" size={18} />
                  Archivar
                </Button>
              )}
            </div>
          </header>

          <Card>
            <StatTile
              label="Tiros acumulados"
              value={usage.status === 'ready' ? formatInteger(shots.total) : '—'}
              help={usage.status === 'ready' ? accumulatedShotsDetail(shots) : undefined}
              size="lg"
              accent
            />
          </Card>

          <Card as="div" padded={false}>
            <dl className={styles.purchase}>
              <div>
                <dt>Fecha de compra</dt>
                <dd className="num">
                  {firearm.purchaseDate ? formatIsoDate(firearm.purchaseDate) : '—'}
                </dd>
              </div>
              <div>
                <dt>Lugar de compra</dt>
                <dd>{firearm.purchasePlace || '—'}</dd>
              </div>
            </dl>
          </Card>
        </section>
      </div>

      <div className={styles.sections}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={`display ${styles.sectionTitle}`}>Modificaciones</h2>
            {!firearm.archived &&
              addButton('modificaciones/nueva', 'Agregar', 'Agregar modificación')}
          </div>
          {(archivedModifications > 0 || showArchivedModifications) && (
            <label className={styles.archivedToggle}>
              <input
                type="checkbox"
                checked={showArchivedModifications}
                onChange={(event) => setShowArchivedModifications(event.target.checked)}
              />
              Mostrar modificaciones archivadas{' '}
              <span className="num">({archivedModifications})</span>
            </label>
          )}
          <InventoryItems
            aria-label="Modificaciones"
            state={modifications}
            name={modificationName}
            searchFields={(item) => [item.brand, item.model, item.comments]}
            showArchived={showArchivedModifications}
            title={modificationName}
            detail={(item) => item.comments}
            columns={[
              { key: 'brand', header: 'Marca', kind: 'primary', cell: (item) => item.brand },
              { key: 'model', header: 'Modelo', cell: (item) => item.model },
              {
                key: 'comments',
                header: 'Comentarios',
                kind: 'muted',
                cell: (item) => item.comments,
              },
            ]}
            empty={{
              icon: <Wrench />,
              title: 'Sin modificaciones',
              text: 'Cargá miras, gatillos o cargadores para armar configuraciones.',
              headingLevel: 3,
            }}
            archivedText="Marcá «Mostrar modificaciones archivadas» para verlas y restaurarlas."
            onEdit={(item) => open(`modificaciones/${item.id}/editar`)}
            onRestore={modificationActions.restore}
          />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={`display ${styles.sectionTitle}`}>Configuraciones</h2>
            {!firearm.archived && addButton('configuraciones/nueva', 'Nueva configuración')}
          </div>
          <p className={styles.help}>
            Combiná el arma base con modificaciones para elegirla en una sesión.
          </p>
          {(archivedConfigurations > 0 || showArchivedConfigurations) && (
            <label className={styles.archivedToggle}>
              <input
                type="checkbox"
                checked={showArchivedConfigurations}
                onChange={(event) => setShowArchivedConfigurations(event.target.checked)}
              />
              Mostrar configuraciones archivadas{' '}
              <span className="num">({archivedConfigurations})</span>
            </label>
          )}
          {configurations.status === 'error' ? (
            <Alert title="No se pudieron cargar las configuraciones">
              Revisá la conexión y volvé a intentar.
            </Alert>
          ) : (
            <ul aria-label="Configuraciones" className={styles.configurations}>
              {firearmConfigurations(firearm.id, ownConfigurations, showArchivedConfigurations).map(
                (configuration) => (
                  <ConfigurationCard
                    key={configuration.id ?? 'stock'}
                    configuration={configuration}
                    modifications={configurationModifications(configuration, allModifications)}
                    sessions={configurationSessions(usageItems, firearm.id, configuration.id)}
                    onEdit={
                      configuration.kind === 'saved'
                        ? () => open(`configuraciones/${configuration.id}/editar`)
                        : undefined
                    }
                    onRestore={
                      configuration.kind === 'saved'
                        ? () => void configurationActions.restore(configuration)
                        : undefined
                    }
                  />
                ),
              )}
            </ul>
          )}
        </section>
      </div>

      <Outlet context={outlet} />
    </div>
  );
}
