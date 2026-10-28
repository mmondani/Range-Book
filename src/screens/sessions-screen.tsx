import { Crosshair, ListFilter, Plus, Search, SearchX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useParams, useSearchParams } from 'react-router';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { ChipGroup } from '@/components/chip-group';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { IconButton } from '@/components/icon-button';
import { Input } from '@/components/input';
import { LinkButton } from '@/components/link-button';
import { SessionCard } from '@/components/session-card';
import { Skeleton } from '@/components/skeleton';
import { StatTile } from '@/components/stat-tile';
import { useIsDesktop } from '@/hooks/use-media-query';
import { useSessionData } from '@/hooks/use-session-data';
import type { SessionsOutletContext } from '@/hooks/use-sessions';
import { cx } from '@/lib/cx';
import { firearmName } from '@/lib/firearms';
import { formatDecimal, formatInteger, formatMonthYear, isoDate } from '@/lib/format';
import {
  filterSessions,
  groupByMonth,
  monthSummary,
  sessionFirearms,
  sessionLabels,
  sessionTotals,
} from '@/lib/sessions';
import styles from './sessions-screen.module.css';

const QUERY_PARAM = 'q';
const FIREARM_PARAM = 'arma';

/**
 * M02 / W02 · Sesiones. En mobile, la lista o el detalle (M03); desde 1024 px, la lista y el detalle
 * de la sesión elegida a la vez. La búsqueda y el filtro por arma van en la query string.
 */
export function SessionsScreen() {
  const { id } = useParams();
  const isDesktop = useIsDesktop();
  const data = useSessionData();
  const { search } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get(QUERY_PARAM) ?? '';
  const firearmId = searchParams.get(FIREARM_PARAM) ?? '';
  const [searchOpen, setSearchOpen] = useState(query !== '');
  const [filterOpen, setFilterOpen] = useState(firearmId !== '');
  const [today] = useState(() => isoDate());
  const searchInput = useRef<HTMLInputElement>(null);

  // Al abrir la búsqueda en mobile, el foco va al campo.
  useEffect(() => {
    if (searchOpen && !isDesktop) searchInput.current?.focus();
  }, [searchOpen, isDesktop]);

  const listPath = `/sesiones${search}`;
  const outlet: SessionsOutletContext = { data, listPath };

  // Mobile: el detalle ocupa toda la pantalla.
  if (id && !isDesktop) return <Outlet context={outlet} />;

  function setParam(name: string, value: string) {
    setSearchParams(
      (params) => {
        if (value) params.set(name, value);
        else params.delete(name);
        return params;
      },
      { replace: true },
    );
  }

  function clearFilters() {
    setSearchParams(
      (params) => {
        params.delete(QUERY_PARAM);
        params.delete(FIREARM_PARAM);
        return params;
      },
      { replace: true },
    );
  }

  const ready = data.status === 'ready' ? data : undefined;
  const hasSessions = ready ? ready.sessions.length > 0 : false;
  const filtered = ready ? filterSessions(ready.sessions, { query, firearmId }, ready.lookups) : [];
  const summary = ready ? monthSummary(ready.sessions, today) : undefined;
  const filterFirearms = ready ? sessionFirearms(ready.sessions, ready.firearms) : [];
  const showSearch = isDesktop || searchOpen;
  const showFilter = (isDesktop || filterOpen) && filterFirearms.length > 0;

  function list() {
    if (data.status === 'loading') {
      return (
        <div className={styles.loading} aria-busy="true" aria-label="Cargando sesiones">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} shape="card" height={isDesktop ? 64 : 104} />
          ))}
        </div>
      );
    }
    if (data.status === 'error') {
      return (
        <Alert title="No se pudieron cargar las sesiones">
          Revisá la conexión y volvé a intentar.
        </Alert>
      );
    }
    if (!hasSessions) {
      return (
        <EmptyState
          icon={<Crosshair />}
          title="Todavía no registraste sesiones"
          text="Creá una al llegar al polígono y cargá las rondas a medida que tirás."
          action={
            <LinkButton to="/sesiones/nueva" variant="primary">
              <Plus aria-hidden="true" size={18} />
              Nueva sesión
            </LinkButton>
          }
        />
      );
    }
    if (filtered.length === 0) {
      return (
        <EmptyState
          icon={<SearchX />}
          title="Sin resultados"
          text="Probá con otra búsqueda o quitá el filtro de arma."
          action={<Button onClick={clearFilters}>Limpiar filtros</Button>}
        />
      );
    }
    return groupByMonth(filtered).map((group) => (
      <section key={group.month} className={styles.month} aria-labelledby={`mes-${group.month}`}>
        <h2 id={`mes-${group.month}`} className={cx('eyebrow', styles.monthTitle)}>
          {formatMonthYear(group.month)}
        </h2>
        <ul className={styles.list}>
          {group.sessions.map((session) => (
            <li key={session.id}>
              <SessionCard
                session={session}
                labels={sessionLabels(session, data.lookups)}
                totals={sessionTotals(session, data.targets)}
                to={`/sesiones/${session.id}${search}`}
                isToday={session.date === today}
                variant={isDesktop ? 'item' : 'card'}
                selected={session.id === id}
              />
            </li>
          ))}
        </ul>
      </section>
    ));
  }

  return (
    <div className={styles.screen}>
      <section className={styles.listColumn} aria-label="Lista de sesiones">
        <header className={styles.header}>
          <h1 className={`display ${styles.title}`}>Sesiones</h1>
          {ready && hasSessions && (
            <>
              <span className={cx('num', styles.total)}>
                {formatInteger(ready.sessions.length)} en total
              </span>
              <div className={styles.headerActions}>
                <IconButton
                  aria-label="Buscar sesiones"
                  aria-expanded={searchOpen}
                  onClick={() => setSearchOpen(!searchOpen)}
                >
                  <Search aria-hidden="true" />
                </IconButton>
                {filterFirearms.length > 0 && (
                  <IconButton
                    aria-label="Filtrar sesiones"
                    aria-expanded={filterOpen}
                    onClick={() => setFilterOpen(!filterOpen)}
                  >
                    <ListFilter aria-hidden="true" />
                  </IconButton>
                )}
              </div>
            </>
          )}
        </header>

        {summary && hasSessions && (
          <Card as="section" aria-label="Resumen del mes" className={styles.summary}>
            <StatTile label="Sesiones" value={formatInteger(summary.sessions)} />
            <StatTile label="Disparos" value={formatInteger(summary.shots)} />
            <StatTile
              label="Prom./tiro"
              value={summary.averagePerShot === null ? '—' : formatDecimal(summary.averagePerShot)}
              accent={summary.averagePerShot !== null}
            />
          </Card>
        )}

        {hasSessions && showSearch && (
          <div className={styles.search}>
            <label htmlFor="sessions-search" className="visually-hidden">
              Buscar sesiones
            </label>
            <Search className={styles.searchIcon} aria-hidden="true" size={18} />
            <Input
              id="sessions-search"
              type="search"
              value={query}
              placeholder="Buscar por arma, polígono o nota"
              className={styles.searchInput}
              ref={searchInput}
              onChange={(event) => setParam(QUERY_PARAM, event.target.value)}
            />
          </div>
        )}

        {hasSessions && showFilter && (
          <ChipGroup role="group" aria-label="Filtrar por arma">
            <Chip selected={firearmId === ''} onClick={() => setParam(FIREARM_PARAM, '')}>
              Todas
            </Chip>
            {filterFirearms.map((firearm) => (
              <Chip
                key={firearm.id}
                selected={firearmId === firearm.id}
                onClick={() => setParam(FIREARM_PARAM, firearm.id)}
              >
                {firearmName(firearm)}
              </Chip>
            ))}
          </ChipGroup>
        )}

        <div className={styles.groups}>{list()}</div>
      </section>

      {isDesktop && (
        <section className={styles.detailColumn} aria-label="Detalle de la sesión">
          {id ? (
            <Outlet context={outlet} />
          ) : (
            hasSessions && (
              <EmptyState
                icon={<Crosshair />}
                title="Elegí una sesión"
                text="Su detalle, con las rondas y las notas, se ve acá."
              />
            )
          )}
        </section>
      )}

      {hasSessions && (
        <Fab to="/sesiones/nueva" icon={<Plus aria-hidden="true" />}>
          Nueva sesión
        </Fab>
      )}
    </div>
  );
}
