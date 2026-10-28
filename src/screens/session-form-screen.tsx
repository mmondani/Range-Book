import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useBlocker, useLocation, useNavigate, useParams } from 'react-router';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DateInput } from '@/components/date-input';
import { Field } from '@/components/field';
import { IconButton } from '@/components/icon-button';
import { ModificationPicker } from '@/components/modification-picker';
import { PhotoPicker } from '@/components/photo-picker';
import { Select } from '@/components/select';
import { Skeleton } from '@/components/skeleton';
import { Textarea } from '@/components/textarea';
import { WeatherPicker } from '@/components/weather-picker';
import { useCurrentUser } from '@/hooks/use-auth';
import { useFirearmModifications } from '@/hooks/use-firearm-modifications';
import { useItemForm } from '@/hooks/use-item-form';
import { usePhotoRepository } from '@/hooks/use-photos';
import { useSessionData, type SessionData } from '@/hooks/use-session-data';
import { useSessionRepository } from '@/hooks/use-sessions';
import { useToast } from '@/hooks/use-toast';
import { cx } from '@/lib/cx';
import type { Modification } from '@/lib/firearms';
import { isoDate } from '@/lib/format';
import { ammunitionName, rangeName, selectableItems } from '@/lib/inventory';
import { removedPhotos, uploadPhotos } from '@/lib/photos';
import {
  availableModifications,
  changeFirearm,
  draftStorageKey,
  firearmOptions,
  newSessionDraft,
  NOTES_MAX_LENGTH,
  parseFirearmOption,
  parseStoredDraft,
  serializeDraft,
  sessionDraft,
  sessionFields,
  validateSession,
  type Session,
} from '@/lib/sessions';
import styles from './session-form-screen.module.css';

/** M04 / W03 · Nueva y editar sesión. Las rondas no se cargan acá: se agregan desde el detalle. */
export function SessionFormScreen() {
  const { id } = useParams();
  const data = useSessionData();
  const modifications = useFirearmModifications(
    data.status === 'ready' ? data.firearms.map((firearm) => firearm.id) : [],
  );

  if (data.status === 'error') {
    return (
      <Alert title="No se pudieron cargar los datos">Revisá la conexión y volvé a intentar.</Alert>
    );
  }
  if (data.status === 'loading' || !modifications) {
    return (
      <div className={styles.loading} aria-busy="true" aria-label="Cargando el formulario">
        <Skeleton shape="card" height={160} />
        <Skeleton shape="card" height={160} />
      </div>
    );
  }
  const session = id ? data.sessions.find((item) => item.id === id) : undefined;
  if (id && !session) return <Navigate to="/sesiones" replace />;

  return (
    <SessionForm key={id ?? 'nueva'} session={session} data={data} modifications={modifications} />
  );
}

interface SessionFormProps {
  session?: Session;
  data: Extract<SessionData, { status: 'ready' }>;
  modifications: ReadonlyMap<string, Modification[]>;
}

function SessionForm({ session, data, modifications }: SessionFormProps) {
  const uid = useCurrentUser()?.uid ?? '';
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const repository = useSessionRepository();
  const photoRepository = usePhotoRepository();
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [today] = useState(() => isoDate());
  // El id se genera antes de guardar para armar la ruta de las fotos.
  const [sessionId] = useState(() => session?.id ?? repository.newId(uid));
  const storageKey = draftStorageKey(uid, session?.id);
  const [initial] = useState(() =>
    session ? sessionDraft(session) : newSessionDraft(data.sessions, data.ranges, today),
  );
  const [restored] = useState(() => parseStoredDraft(localStorage.getItem(storageKey)));
  const [showRestored, setShowRestored] = useState(restored !== undefined);
  const leaving = useRef(false);

  const form = useItemForm({
    initial,
    start: restored ?? initial,
    validate: (draft) => validateSession(draft, today),
    async save(draft) {
      try {
        const photos = await uploadPhotos(
          draft.photos,
          { uid, kind: 'sessions', docId: sessionId },
          photoRepository,
        );
        const fields = sessionFields(draft, photos);
        if (session) await repository.update(uid, sessionId, fields);
        else await repository.create(uid, sessionId, fields);
      } catch {
        toast.show({ message: 'No se pudo guardar', tone: 'error' });
        return;
      }
      // Las fotos quitadas se borran recién después de guardar el documento.
      if (session) {
        for (const path of removedPhotos(session.photos, draft.photos)) {
          photoRepository.remove(path).catch(() => {});
        }
      }
      localStorage.removeItem(storageKey);
      leaving.current = true;
      toast.show({ message: session ? 'Cambios guardados' : 'Sesión creada' });
      if (session) close();
      else navigate(`/sesiones/${sessionId}`, { replace: true });
    },
  });
  const { draft, errors, setField, setFields, touch } = form;

  // Borrador local: se guarda mientras haya cambios, para no perderlos si se cierra la app.
  useEffect(() => {
    if (leaving.current) return;
    if (form.dirty) localStorage.setItem(storageKey, serializeDraft(form.draft));
    else localStorage.removeItem(storageKey);
  }, [form.draft, form.dirty, storageKey]);

  // Salir con cambios sin guardar (cerrar, "atrás", otra sección) pide confirmación.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !leaving.current &&
      form.dirty &&
      !form.saving &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (form.errorAttempt > 0)
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [form.errorAttempt]);

  function close() {
    // Si se entró directo por URL no hay adónde volver en el historial.
    if (location.key !== 'default') navigate(-1);
    else navigate(session ? `/sesiones/${session.id}` : '/sesiones', { replace: true });
  }

  function discardRestored() {
    localStorage.removeItem(storageKey);
    form.reset();
    setShowRestored(false);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void form.submit();
  }

  const { firearmId } = parseFirearmOption(draft.firearm);
  const firearmModifications = modifications.get(firearmId) ?? [];
  const groups = firearmOptions(data.firearms, data.configurations, draft.firearm);
  const ranges = selectableItems(data.ranges, rangeName, draft.rangeId);
  const ammunition = selectableItems(data.ammunition, ammunitionName, draft.ammunitionId);
  const title = session ? 'Editar sesión' : 'Nueva sesión';

  return (
    <div className={styles.screen}>
      <nav aria-label="Ruta" className={styles.breadcrumb}>
        <ol>
          <li>
            <Link to="/sesiones">Sesiones</Link>
          </li>
          <li aria-current="page">{title}</li>
        </ol>
      </nav>

      <header className={styles.header}>
        <IconButton aria-label="Cerrar sin guardar" className={styles.close} onClick={close}>
          <X aria-hidden="true" />
        </IconButton>
        <h1 className={cx('display', styles.title)}>{title}</h1>
      </header>

      {showRestored && (
        <Alert
          tone="warning"
          title="Recuperamos los cambios que no guardaste"
          action={<Button onClick={discardRestored}>Descartar borrador</Button>}
        >
          Las fotos nuevas que no se llegaron a guardar hay que volver a elegirlas.
        </Alert>
      )}

      <form id={formId} ref={formRef} noValidate className={styles.form} onSubmit={handleSubmit}>
        <section className={styles.section}>
          <h2 className={cx('eyebrow', styles.sectionTitle)}>Arma</h2>
          <div className={styles.pair}>
            <Field
              label="Arma / configuración"
              required
              error={errors.firearm}
              help={
                groups.length === 0 ? (
                  <>
                    Todavía no cargaste armas. <Link to="/inventario/armas/nueva">Agregá una</Link>.
                  </>
                ) : (
                  'Elegí un arma base o una configuración (arma + modificaciones).'
                )
              }
            >
              <Select
                value={draft.firearm}
                onChange={(event) =>
                  setFields(
                    changeFirearm(draft, event.target.value, {
                      sessions: data.sessions,
                      configurations: data.configurations,
                      modifications:
                        modifications.get(parseFirearmOption(event.target.value).firearmId) ?? [],
                      ammunition: data.ammunition,
                    }),
                  )
                }
                onBlur={() => touch('firearm')}
              >
                <option value="" disabled>
                  Elegí el arma
                </option>
                {groups.map((group) => (
                  <optgroup key={group.firearm.id} label={group.label}>
                    {group.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
            <Field
              label="Munición"
              required
              error={errors.ammunitionId}
              help={
                ammunition.length === 0 ? (
                  <>
                    Todavía no cargaste munición.{' '}
                    <Link to="/inventario/municiones/nueva">Agregá una</Link>.
                  </>
                ) : undefined
              }
            >
              <Select
                value={draft.ammunitionId}
                onChange={(event) => setField('ammunitionId', event.target.value)}
                onBlur={() => touch('ammunitionId')}
              >
                <option value="" disabled>
                  Elegí la munición
                </option>
                {ammunition.map((item) => (
                  <option key={item.id} value={item.id}>
                    {ammunitionName(item)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field
            label="Personalizaciones"
            kind="group"
            error={errors.modifications}
            help={
              firearmId
                ? 'Precargadas desde la configuración; podés ajustarlas para esta sesión.'
                : 'Elegí primero el arma.'
            }
          >
            <ModificationPicker
              value={draft.modifications}
              available={
                firearmId ? availableModifications(draft.modifications, firearmModifications) : []
              }
              onChange={(value) => setField('modifications', value)}
            />
          </Field>
        </section>

        <section className={styles.section}>
          <h2 className={cx('eyebrow', styles.sectionTitle)}>Lugar y condiciones</h2>
          <div className={cx(styles.pair, styles.dates)}>
            <Field label="Fecha" required error={errors.date}>
              <DateInput
                value={draft.date}
                max={today}
                onChange={(event) => setField('date', event.target.value)}
                onBlur={() => touch('date')}
              />
            </Field>
            <Field
              label="Polígono"
              required
              error={errors.rangeId}
              help={
                ranges.length === 0 ? (
                  <>
                    Todavía no cargaste polígonos.{' '}
                    <Link to="/inventario/poligonos/nuevo">Agregá uno</Link>.
                  </>
                ) : undefined
              }
            >
              <Select
                value={draft.rangeId}
                onChange={(event) => setField('rangeId', event.target.value)}
                onBlur={() => touch('rangeId')}
              >
                <option value="" disabled>
                  Elegí el polígono
                </option>
                {ranges.map((range) => (
                  <option key={range.id} value={range.id}>
                    {rangeName(range)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Clima" kind="group">
            <WeatherPicker
              value={draft.weather}
              onChange={(weather) => setField('weather', weather)}
            />
          </Field>
        </section>

        <section className={styles.section}>
          <Field label="Fotos del polígono" kind="group" error={errors.photos}>
            <PhotoPicker value={draft.photos} onChange={(photos) => setField('photos', photos)} />
          </Field>
        </section>

        <section className={styles.section}>
          <Field label="Notas" error={errors.notes}>
            <Textarea
              value={draft.notes}
              rows={4}
              maxLength={NOTES_MAX_LENGTH}
              placeholder="Objetivos, condiciones, sensaciones…"
              onChange={(event) => setField('notes', event.target.value)}
              onBlur={() => touch('notes')}
            />
          </Field>
        </section>

        {!session && (
          <p className={styles.note}>
            Las rondas (blancos) se agregan desde el detalle de la sesión, a medida que tirás.
          </p>
        )}
      </form>

      <div className={styles.actions}>
        <Button variant="ghost" className={styles.cancel} onClick={close} disabled={form.saving}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          type="submit"
          form={formId}
          loading={form.saving}
          className={styles.submit}
        >
          {session ? 'Guardar cambios' : 'Guardar sesión'}
        </Button>
      </div>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="¿Descartar los cambios?"
        description="Los datos que cargaste no se van a guardar."
        confirmLabel="Descartar"
        cancelLabel="Seguir editando"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => {
          leaving.current = true;
          localStorage.removeItem(storageKey);
          blocker.proceed?.();
        }}
      />
    </div>
  );
}
