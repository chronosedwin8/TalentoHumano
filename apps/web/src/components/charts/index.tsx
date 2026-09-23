import * as React from 'react';
import {
  Area,
  AreaChart as RechartsAreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn, formatNumber } from '@/lib/utils';

/**
 * Chart palette.
 *
 * Categorical hues are assigned in a fixed order and never cycled: a ninth
 * series folds into "Otros". The order and both mode variants were validated
 * for colour-vision deficiency separation and contrast against the chart
 * surface; see docs/DECISIONS.md (ADR-0007).
 */
export const CATEGORICAL_LIGHT = [
  '#2a78d6', // azul
  '#eb6834', // naranja
  '#1baf7a', // aqua
  '#eda100', // amarillo
  '#e87ba4', // magenta
  '#008300', // verde
  '#4a3aa7', // violeta
  '#e34948', // rojo
];

export const CATEGORICAL_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
];

/** Single-hue ramp for magnitude (never a rainbow). */
export const SEQUENTIAL_LIGHT = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95'];
export const SEQUENTIAL_DARK = ['#184f95', '#256abf', '#2a78d6', '#3987e5', '#6da7ec', '#9ec5f4'];

/** Status colours are reserved and never reused as a categorical slot. */
/**
 * Status is a reserved encoding: none of these steps appears in the
 * categorical order, so "series 4" can never be mistaken for "critical".
 *
 * The adjacent-pair CVD check does not apply here — it is scoped to
 * categorical palettes, and status is a semantic warm ramp where amber and
 * orange are meant to sit next to each other. What is enforced instead is
 * distinctness from the categorical order, a valid lightness band, the chroma
 * floor, and contrast >= 3:1 against both surfaces (all verified with
 * `scripts/validate_palette.js`). Status is always rendered with an icon or a
 * label, never as colour alone.
 */
export const STATUS_COLORS = {
  good: '#157f5a',
  warning: '#b97d00',
  serious: '#c24a1c',
  critical: '#b32626',
} as const;

export const STATUS_COLORS_DARK = {
  good: '#22a876',
  warning: '#bd8a18',
  serious: '#d4612f',
  critical: '#d65150',
} as const;

export type StatusKey = keyof typeof STATUS_COLORS;

/** Status colour for the active theme. */
export function statusColor(status: StatusKey, isDark: boolean): string {
  return isDark ? STATUS_COLORS_DARK[status] : STATUS_COLORS[status];
}

function useIsDark(): boolean {
  const [dark, setDark] = React.useState(() => document.documentElement.classList.contains('dark'));
  React.useEffect(() => {
    const observer = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains('dark')),
    );
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

export function useChartPalette(): {
  categorical: string[];
  sequential: string[];
  isDark: boolean;
} {
  const isDark = useIsDark();
  return {
    isDark,
    categorical: isDark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT,
    sequential: isDark ? SEQUENTIAL_DARK : SEQUENTIAL_LIGHT,
  };
}

const AXIS_STYLE = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

function ChartTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      {label ? <p className="mb-1 font-medium text-popover-foreground">{label}</p> : null}
      {payload.map((entry: any) => (
        <div key={entry.dataKey ?? entry.name} className="flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: entry.color ?? entry.payload?.fill }}
          />
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="ml-auto font-medium tabular-nums text-popover-foreground">
            {formatNumber(Number(entry.value), Number.isInteger(Number(entry.value)) ? 0 : 1)}
            {unit ?? ''}
          </span>
        </div>
      ))}
    </div>
  );
}

export interface SeriesPoint {
  label: string;
  value: number;
  [key: string]: string | number;
}

/**
 * Keeps the `limit` largest categories and folds the rest into "Otros".
 *
 * Categorical hues are assigned in a fixed order and never cycled, so a chart
 * must never show more categories than the palette has: beyond that, colours
 * would repeat and two different categories would look identical.
 */
export function foldCategories(data: SeriesPoint[], limit: number): SeriesPoint[] {
  if (data.length <= limit) return data;
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, limit);
  const rest = sorted.slice(limit).reduce((acc, row) => acc + row.value, 0);
  return rest > 0 ? [...head, { label: 'Otros', value: rest }] : head;
}

/** Horizontal or vertical bars for comparing magnitude across categories. */
export function BarChart({
  data,
  height = 260,
  layout = 'vertical',
  unit,
  color,
  className,
  maxCategories = 8,
}: {
  data: SeriesPoint[];
  height?: number;
  layout?: 'vertical' | 'horizontal';
  unit?: string;
  color?: string;
  className?: string;
  maxCategories?: number;
}) {
  const { categorical } = useChartPalette();
  const fill = color ?? categorical[0];

  // A long tail is folded into "Otros" rather than cycling hues.
  const rows = React.useMemo(() => foldCategories(data, maxCategories - 1), [data, maxCategories]);

  if (!rows.length) return <NoData height={height} />;

  const isHorizontal = layout === 'horizontal';

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={rows}
          layout={isHorizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: 16, bottom: 4, left: isHorizontal ? 8 : 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            horizontal={!isHorizontal}
            vertical={isHorizontal}
          />
          {isHorizontal ? (
            <>
              <XAxis type="number" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="label"
                tick={AXIS_STYLE}
                axisLine={false}
                tickLine={false}
                width={140}
              />
            </>
          ) : (
            <>
              <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={40} />
            </>
          )}
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: 'hsl(var(--muted))' }} />
          <Bar
            dataKey="value"
            name="Total"
            fill={fill}
            radius={isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={isHorizontal ? 18 : 36}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Change over time. Always a single y-scale: never a dual axis. */
export function LineChart({
  data,
  series,
  height = 260,
  unit,
  area = false,
  className,
}: {
  data: Array<Record<string, string | number>>;
  series: Array<{ key: string; label: string }>;
  height?: number;
  unit?: string;
  area?: boolean;
  className?: string;
}) {
  const { categorical } = useChartPalette();
  if (!data.length) return <NoData height={height} />;

  const Chart = area ? RechartsAreaChart : RechartsLineChart;

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <Chart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <defs>
            {series.map((item, index) => (
              <linearGradient key={item.key} id={`fill-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={categorical[index % categorical.length]}
                  stopOpacity={0.25}
                />
                <stop
                  offset="100%"
                  stopColor={categorical[index % categorical.length]}
                  stopOpacity={0.02}
                />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={<ChartTooltip unit={unit} />} />
          {series.length > 1 ? (
            <Legend
              verticalAlign="top"
              align="right"
              height={28}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}
            />
          ) : null}
          {series.map((item, index) =>
            area ? (
              <Area
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stroke={categorical[index % categorical.length]}
                strokeWidth={2}
                fill={`url(#fill-${item.key})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
              />
            ) : (
              <Line
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stroke={categorical[index % categorical.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
              />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Part-to-whole. Capped at five slices plus "Otros"; every slice is labelled in
 * the legend so identity never depends on colour alone.
 */
export function DonutChart({
  data,
  height = 240,
  className,
  unit,
}: {
  data: SeriesPoint[];
  height?: number;
  className?: string;
  unit?: string;
}) {
  const { categorical } = useChartPalette();

  const rows = React.useMemo(() => foldCategories(data, 5), [data]);

  if (!rows.length) return <NoData height={height} />;
  const total = rows.reduce((acc, row) => acc + row.value, 0);

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center', className)}>
      <ResponsiveContainer width="100%" height={height} className="sm:max-w-[240px]">
        <RechartsPieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="label"
            innerRadius="58%"
            outerRadius="88%"
            paddingAngle={2}
            stroke="hsl(var(--background))"
            strokeWidth={2}
          >
            {rows.map((row, index) => (
              <Cell key={row.label} fill={categorical[index % categorical.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip unit={unit} />} />
        </RechartsPieChart>
      </ResponsiveContainer>

      <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
        {rows.map((row, index) => (
          <li key={row.label} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: categorical[index % categorical.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{row.label}</span>
            <span className="font-medium tabular-nums">{formatNumber(row.value)}</span>
            <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
              {total ? `${Math.round((row.value / total) * 100)}%` : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Nine-box style matrix; magnitude uses the single-hue sequential ramp. */
export function HeatGrid({
  cells,
  columns,
  rowLabels,
  columnLabels,
  renderCell,
  className,
}: {
  cells: Array<{ key: string; value: number; label?: string }>;
  columns: number;
  rowLabels?: string[];
  columnLabels?: string[];
  renderCell?: (cell: { key: string; value: number; label?: string }) => React.ReactNode;
  className?: string;
}) {
  const { sequential } = useChartPalette();
  const max = Math.max(1, ...cells.map((cell) => cell.value));

  const stepFor = (value: number) => {
    if (value === 0) return 'hsl(var(--muted))';
    const index = Math.min(
      sequential.length - 1,
      Math.floor((value / max) * (sequential.length - 1)),
    );
    return sequential[index];
  };

  // With row labels the grid gains a leading column for them, so the matrix
  // reads like the printed risk matrix it represents.
  const gridColumns = rowLabels?.length
    ? `minmax(0, auto) repeat(${columns}, minmax(0, 1fr))`
    : `repeat(${columns}, minmax(0, 1fr))`;

  const rows: Array<Array<(typeof cells)[number]>> = [];
  for (let index = 0; index < cells.length; index += columns) {
    rows.push(cells.slice(index, index + columns));
  }

  return (
    <div className={className}>
      <div className="grid gap-2" style={{ gridTemplateColumns: gridColumns }}>
        {rows.map((row, rowIndex) => (
          <React.Fragment key={rowLabels?.[rowIndex] ?? `row-${rowIndex}`}>
            {rowLabels?.length ? (
              <span className="flex items-center pr-1 text-xs font-medium text-muted-foreground">
                {rowLabels[rowIndex] ?? ''}
              </span>
            ) : null}
            {row.map((cell) => (
              <div
                key={cell.key}
                className="min-h-[88px] rounded-lg border p-2 text-xs"
                style={{
                  backgroundColor: stepFor(cell.value),
                  color: cell.value > max * 0.6 ? '#fff' : undefined,
                }}
              >
                {renderCell ? (
                  renderCell(cell)
                ) : (
                  <>
                    <p className="font-semibold">{cell.label}</p>
                    <p className="text-lg font-bold tabular-nums">{cell.value}</p>
                  </>
                )}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
      {columnLabels ? (
        <div
          className="mt-2 grid gap-2 text-center text-xs text-muted-foreground"
          style={{ gridTemplateColumns: gridColumns }}
        >
          {rowLabels?.length ? <span /> : null}
          {columnLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NoData({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"
      style={{ height }}
    >
      Sin datos para el periodo seleccionado
    </div>
  );
}

/** Accessible table fallback shown beside a chart when contrast relief applies. */
export function SeriesTable({ data, unit }: { data: SeriesPoint[]; unit?: string }) {
  if (!data.length) return null;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
          <th className="py-2 text-left font-medium">Categoria</th>
          <th className="py-2 text-right font-medium">Valor</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {data.map((row) => (
          <tr key={row.label}>
            <td className="py-2">{row.label}</td>
            <td className="py-2 text-right tabular-nums">
              {formatNumber(row.value)}
              {unit ?? ''}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
