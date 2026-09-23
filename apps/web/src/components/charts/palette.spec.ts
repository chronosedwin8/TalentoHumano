import { describe, expect, it } from 'vitest';
import {
  CATEGORICAL_DARK,
  CATEGORICAL_LIGHT,
  SEQUENTIAL_DARK,
  SEQUENTIAL_LIGHT,
  STATUS_COLORS,
  STATUS_COLORS_DARK,
  foldCategories,
  statusColor,
  type SeriesPoint,
} from './index';

const point = (label: string, value: number): SeriesPoint => ({ label, value });

/**
 * The palette was validated for colour-vision-deficiency separation before any
 * chart was written (see docs/DECISIONS.md, ADR-0007). These tests pin the
 * properties that validation depends on.
 */
describe('paleta categorica', () => {
  it('define el mismo numero de tonos en claro y en oscuro', () => {
    expect(CATEGORICAL_LIGHT).toHaveLength(CATEGORICAL_DARK.length);
    expect(CATEGORICAL_LIGHT.length).toBeGreaterThanOrEqual(8);
  });

  it('usa colores hexadecimales validos', () => {
    for (const color of [...CATEGORICAL_LIGHT, ...CATEGORICAL_DARK]) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('no repite un tono dentro del mismo modo', () => {
    expect(new Set(CATEGORICAL_LIGHT).size).toBe(CATEGORICAL_LIGHT.length);
    expect(new Set(CATEGORICAL_DARK).size).toBe(CATEGORICAL_DARK.length);
  });

  it('el modo oscuro no es una copia del claro', () => {
    // Los pasos oscuros se eligieron contra la superficie oscura, no se
    // invirtieron automaticamente.
    expect(CATEGORICAL_DARK).not.toEqual(CATEGORICAL_LIGHT);
  });
});

describe('rampa secuencial', () => {
  it('es de un solo tono y va de claro a oscuro', () => {
    expect(SEQUENTIAL_LIGHT.length).toBeGreaterThanOrEqual(5);
    expect(SEQUENTIAL_DARK).toHaveLength(SEQUENTIAL_LIGHT.length);
  });

  it('invierte el sentido en modo oscuro', () => {
    expect(SEQUENTIAL_DARK[0]).toBe(SEQUENTIAL_LIGHT.at(-1));
  });
});

describe('colores de estado', () => {
  it('reserva un color por estado', () => {
    expect(Object.keys(STATUS_COLORS).sort()).toEqual(
      ['critical', 'good', 'serious', 'warning'].sort(),
    );
  });

  it('no reutiliza un color categorico como color de estado', () => {
    const categorical = new Set(
      [...CATEGORICAL_LIGHT, ...CATEGORICAL_DARK].map((color) => color.toLowerCase()),
    );
    for (const color of [...Object.values(STATUS_COLORS), ...Object.values(STATUS_COLORS_DARK)]) {
      expect(categorical.has(String(color).toLowerCase())).toBe(false);
    }
  });

  it('define los mismos estados en claro y en oscuro', () => {
    expect(Object.keys(STATUS_COLORS_DARK).sort()).toEqual(Object.keys(STATUS_COLORS).sort());
  });

  it('statusColor devuelve el paso del modo activo', () => {
    expect(statusColor('critical', false)).toBe(STATUS_COLORS.critical);
    expect(statusColor('critical', true)).toBe(STATUS_COLORS_DARK.critical);
  });
});

describe('plegado de categorias en "Otros"', () => {
  it('deja la lista intacta cuando cabe en la paleta', () => {
    const data = [point('A', 3), point('B', 2)];
    expect(foldCategories(data, 5)).toEqual(data);
  });

  it('conserva las categorias mas grandes y agrupa el resto', () => {
    const data = [
      point('A', 10),
      point('B', 8),
      point('C', 6),
      point('D', 4),
      point('E', 2),
      point('F', 1),
      point('G', 1),
    ];
    const folded = foldCategories(data, 5);
    expect(folded).toHaveLength(6);
    expect(folded.slice(0, 5).map((row) => row.label)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(folded.at(-1)).toEqual({ label: 'Otros', value: 2 });
  });

  it('nunca devuelve mas categorias que tonos tiene la paleta', () => {
    const data = Array.from({ length: 40 }, (_, index) => point(`Cat ${index}`, 40 - index));
    expect(foldCategories(data, CATEGORICAL_LIGHT.length - 1).length).toBeLessThanOrEqual(
      CATEGORICAL_LIGHT.length,
    );
  });

  it('conserva el total al plegar', () => {
    const data = [
      point('A', 10),
      point('B', 8),
      point('C', 6),
      point('D', 4),
      point('E', 2),
      point('F', 5),
    ];
    const total = data.reduce((acc, row) => acc + row.value, 0);
    const folded = foldCategories(data, 3);
    expect(folded.reduce((acc, row) => acc + row.value, 0)).toBe(total);
  });

  it('no agrega "Otros" cuando la cola suma cero', () => {
    const data = [point('A', 10), point('B', 8), point('C', 0), point('D', 0)];
    const folded = foldCategories(data, 2);
    expect(folded.map((row) => row.label)).toEqual(['A', 'B']);
  });

  it('ordena de mayor a menor al plegar', () => {
    const data = [point('bajo', 1), point('alto', 10), point('medio', 5), point('cola', 0.5)];
    const folded = foldCategories(data, 2);
    expect(folded[0].label).toBe('alto');
    expect(folded[1].label).toBe('medio');
  });

  it('una lista vacia se queda vacia', () => {
    expect(foldCategories([], 5)).toEqual([]);
  });
});
