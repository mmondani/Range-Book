import {
  Check,
  CircleDashed,
  Cloud,
  CloudFog,
  CloudRain,
  Crosshair,
  Sun,
  Wind,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/badge';
import { BottomSheet } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { ChipGroup } from '@/components/chip-group';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DateInput } from '@/components/date-input';
import { EmptyState } from '@/components/empty-state';
import { Field } from '@/components/field';
import { IconButton } from '@/components/icon-button';
import { Input } from '@/components/input';
import { RemovableChip } from '@/components/removable-chip';
import { SegmentedControl } from '@/components/segmented-control';
import { Select } from '@/components/select';
import { Skeleton } from '@/components/skeleton';
import { StatTile } from '@/components/stat-tile';
import { Stepper } from '@/components/stepper';
import { Tabs, tabPanelProps } from '@/components/tabs';
import { Textarea } from '@/components/textarea';
import { useTheme } from '@/hooks/use-theme';
import { useToast } from '@/hooks/use-toast';
import type { ThemePreference } from '@/lib/theme';
import styles from './component-catalog.module.css';

const THEME_OPTIONS = [
  { value: 'dark', label: 'Oscuro' },
  { value: 'light', label: 'Claro' },
  { value: 'system', label: 'Sistema' },
] as const satisfies ReadonlyArray<{ value: ThemePreference; label: string }>;

const WEATHER = [
  { value: 'sunny', label: 'Soleado', icon: Sun },
  { value: 'cloudy', label: 'Nublado', icon: Cloud },
  { value: 'rainy', label: 'Lluvioso', icon: CloudRain },
  { value: 'foggy', label: 'Niebla', icon: CloudFog },
  { value: 'windy', label: 'Ventoso', icon: Wind },
];

type Category = 'firearms' | 'ammunition' | 'ranges';

/** Catálogo de componentes para la revisión visual contra la maqueta (solo en desarrollo). */
export function ComponentCatalog() {
  const { preference, setPreference } = useTheme();
  const toast = useToast();
  const [shots, setShots] = useState(15);
  const [weather, setWeather] = useState('sunny');
  const [units, setUnits] = useState<'mm' | 'in'>('mm');
  const [category, setCategory] = useState<Category>('firearms');
  const [mods, setMods] = useState(['Mira Holosun 507C', 'Compensador']);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetText, setSheetText] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className={styles.catalog}>
      <header className={styles.header}>
        <h1 className="display" style={{ fontSize: 34 }}>
          Componentes
        </h1>
        <SegmentedControl
          aria-label="Tema"
          options={THEME_OPTIONS}
          value={preference}
          onChange={setPreference}
        />
      </header>

      <section className={styles.section}>
        <h2 className="eyebrow">Botones</h2>
        <div className={styles.row}>
          <Button variant="primary">Guardar sesión</Button>
          <Button>Secundario</Button>
          <Button variant="ghost">Cancelar</Button>
          <Button variant="danger">Eliminar</Button>
          <Button variant="primary" loading>
            Guardando
          </Button>
          <Button disabled>Deshabilitado</Button>
          <Button variant="primary" size="lg">
            Grande
          </Button>
          <IconButton aria-label="Buscar">
            <Crosshair aria-hidden="true" />
          </IconButton>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className="eyebrow">Chips y badges</h2>
        <ChipGroup role="radiogroup" aria-label="Clima">
          {WEATHER.map(({ value, label, icon: Icon }) => (
            <Chip
              key={value}
              role="radio"
              aria-checked={weather === value}
              selected={weather === value}
              icon={<Icon size={18} aria-hidden="true" />}
              onClick={() => setWeather(value)}
            >
              {label}
            </Chip>
          ))}
        </ChipGroup>
        <ChipGroup>
          {mods.map((mod) => (
            <RemovableChip
              key={mod}
              removeLabel={`Quitar ${mod}`}
              onRemove={() => setMods((current) => current.filter((m) => m !== mod))}
            >
              {mod}
            </RemovableChip>
          ))}
          <Chip variant="add">Agregar</Chip>
          <Chip variant="filter">Glock 17</Chip>
        </ChipGroup>
        <div className={styles.row}>
          <Badge tone="success" icon={<Check aria-hidden="true" />}>
            Analizada
          </Badge>
          <Badge tone="warning" icon={<CircleDashed aria-hidden="true" />}>
            Sin analizar
          </Badge>
          <Badge tone="accent">Hoy</Badge>
          <Badge>Archivada</Badge>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className="eyebrow">Tarjeta y StatTiles</h2>
        <Card className={styles.stats}>
          <StatTile label="Sesiones" value="6" />
          <StatTile label="Disparos" value="540" />
          <StatTile label="Prom./tiro" value="9,1" accent />
        </Card>
        <Card className={styles.stats}>
          <StatTile
            label="Grupo"
            value="42"
            unit="mm"
            help="▼ 3,1 mm vs. período anterior"
            trend="up"
          />
          <StatTile label="Puntaje" value="138" unit="/150" help="15 disparos" />
        </Card>
      </section>

      <section className={styles.section}>
        <h2 className="eyebrow">Formulario</h2>
        <div className={styles.grid}>
          <Field label="Blanco" required>
            <Select defaultValue="issf">
              <option value="issf">ISSF Pistola Precisión</option>
              <option value="ipsc">IPSC Classic</option>
            </Select>
          </Field>
          <Field
            label="Distancia"
            required
            help="Se precarga con la distancia de la ronda anterior."
          >
            <Input inputMode="decimal" defaultValue="25" suffix="m" className="num" />
          </Field>
          <Field label="Fecha" required>
            <DateInput defaultValue="2026-10-25" />
          </Field>
          <Field label="Munición" required error="Elegí una munición.">
            <Select defaultValue="">
              <option value="" disabled>
                Elegir…
              </option>
            </Select>
          </Field>
          <Field label="Disparos" required kind="group">
            <Stepper
              value={shots}
              onChange={setShots}
              min={1}
              decrementLabel="Restar un disparo"
              incrementLabel="Sumar un disparo"
            />
          </Field>
          <Field label="Unidades" kind="group">
            <SegmentedControl
              options={[
                { value: 'mm', label: 'Milímetros' },
                { value: 'in', label: 'Pulgadas' },
              ]}
              value={units}
              onChange={setUnits}
            />
          </Field>
        </div>
        <Field label="Notas">
          <Textarea placeholder="Ej: tirones abajo-izquierda" />
        </Field>
      </section>

      <section className={styles.section}>
        <h2 className="eyebrow">Tabs</h2>
        <Tabs
          id="catalog"
          aria-label="Categorías"
          value={category}
          onChange={setCategory}
          tabs={[
            { value: 'firearms', label: 'Armas', count: 3 },
            { value: 'ammunition', label: 'Municiones', count: 5 },
            { value: 'ranges', label: 'Polígonos', count: 2 },
          ]}
        />
        <div {...tabPanelProps('catalog', category)}>Panel: {category}</div>
      </section>

      <section className={styles.section}>
        <h2 className="eyebrow">Modales y avisos</h2>
        <div className={styles.row}>
          <Button onClick={() => setSheetOpen(true)}>Abrir sheet</Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Eliminar sesión
          </Button>
          <Button
            onClick={() =>
              toast.show({
                message: 'Sesión eliminada',
                action: {
                  label: 'Deshacer',
                  onAction: () => toast.show({ message: 'Restaurada' }),
                },
              })
            }
          >
            Toast con Deshacer
          </Button>
          <Button onClick={() => toast.show({ message: 'No se pudo guardar', tone: 'error' })}>
            Toast de error
          </Button>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className="eyebrow">Vacío y cargando</h2>
        <Card>
          <EmptyState
            icon={<Crosshair />}
            title="Todavía no registraste sesiones"
            text="Cargá tu primera sesión en el polígono."
            action={<Button variant="primary">Nueva sesión</Button>}
          />
        </Card>
        <Skeleton shape="card" height={96} />
        <Skeleton shape="text" width="60%" />
      </section>

      <BottomSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setSheetText('');
        }}
        eyebrow="Glock 17 · 25 oct"
        title="Nueva ronda · 3"
        dirty={sheetText !== ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSheetOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => setSheetOpen(false)}>
              Guardar ronda
            </Button>
          </>
        }
      >
        <Field label="Comentarios" help="Escribí algo y cerrá para ver la confirmación.">
          <Textarea value={sheetText} onChange={(event) => setSheetText(event.target.value)} />
        </Field>
      </BottomSheet>

      <ConfirmDialog
        open={confirmOpen}
        title="¿Eliminar la sesión?"
        description="Se eliminan también sus rondas y fotos."
        confirmLabel="Eliminar"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          toast.show({ message: 'Sesión eliminada' });
        }}
      />
    </div>
  );
}
