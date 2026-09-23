import {
  addMonths,
  chunk,
  colorFromString,
  daysBetween,
  endOfMonth,
  formatDateEs,
  fromDateKey,
  fullName,
  groupBy,
  initials,
  monthsBetween,
  startOfMonth,
  unique,
} from '../src/index.js';
import { describe, expect, it } from 'vitest';

const day = (key: string) => fromDateKey(key);

describe('nombres', () => {
  it('arma el nombre completo omitiendo las partes ausentes', () => {
    expect(fullName({ firstName: 'Ana', lastName: 'Perez', secondLastName: 'Gomez' })).toBe(
      'Ana Perez Gomez',
    );
    expect(fullName({ firstName: 'Ana', lastName: 'Perez' })).toBe('Ana Perez');
    expect(fullName({ firstName: 'Ana' })).toBe('Ana');
    expect(fullName({})).toBe('');
  });

  it('calcula las iniciales en mayuscula', () => {
    expect(initials('ana', 'perez')).toBe('AP');
    expect(initials('Ana', null)).toBe('A');
  });

  it('devuelve un marcador cuando no hay nombre', () => {
    expect(initials(null, null)).toBe('?');
  });
});

describe('aritmetica de meses', () => {
  it('suma meses cruzando el cambio de ano', () => {
    expect(formatDateEs(addMonths(day('2026-11-15'), 3))).toContain('2027');
  });

  it('resta meses', () => {
    expect(addMonths(day('2026-03-15'), -3).getUTCMonth()).toBe(11);
  });

  it('cuenta meses entre dos fechas', () => {
    expect(monthsBetween(day('2026-01-01'), day('2026-12-01'))).toBe(11);
    expect(monthsBetween(day('2025-06-01'), day('2026-06-01'))).toBe(12);
  });

  it('devuelve el primer y el ultimo dia del mes', () => {
    expect(startOfMonth(day('2026-02-17')).toISOString().slice(0, 10)).toBe('2026-02-01');
    expect(endOfMonth(day('2026-02-17')).toISOString().slice(0, 10)).toBe('2026-02-28');
  });

  it('acierta el ultimo dia de febrero en ano bisiesto', () => {
    expect(endOfMonth(day('2028-02-10')).toISOString().slice(0, 10)).toBe('2028-02-29');
  });

  it('cuenta los dias de un mes completo', () => {
    expect(daysBetween(startOfMonth(day('2026-01-10')), endOfMonth(day('2026-01-10')))).toBe(30);
  });
});

describe('formato de fecha en espanol', () => {
  it('formatea una fecha legible', () => {
    expect(formatDateEs('2026-03-15')).toMatch(/2026/);
  });

  it('devuelve vacio para una fecha ausente o invalida', () => {
    expect(formatDateEs(null)).toBe('');
    expect(formatDateEs(undefined)).toBe('');
    expect(formatDateEs('no-es-una-fecha')).toBe('');
  });
});

describe('color derivado de un texto', () => {
  it('es estable para la misma entrada', () => {
    expect(colorFromString('Ana Perez')).toBe(colorFromString('Ana Perez'));
  });

  it('entrega un color HSL valido', () => {
    expect(colorFromString('Talento')).toMatch(/^hsl\(\d{1,3}, 65%, 55%\)$/);
  });

  it('distingue entradas distintas', () => {
    expect(colorFromString('Ana')).not.toBe(colorFromString('Luis'));
  });
});

describe('colecciones', () => {
  it('parte una lista en bloques del tamano pedido', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('una lista vacia produce cero bloques', () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it('elimina duplicados conservando el orden', () => {
    expect(unique(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('agrupa por una clave calculada', () => {
    const rows = [
      { area: 'TI', name: 'Ana' },
      { area: 'TI', name: 'Luis' },
      { area: 'RRHH', name: 'Sara' },
    ];
    const grouped = groupBy(rows, (row) => row.area);
    expect(Object.keys(grouped).sort()).toEqual(['RRHH', 'TI']);
    expect(grouped.TI).toHaveLength(2);
  });

  it('agrupar una lista vacia devuelve un objeto vacio', () => {
    expect(groupBy([] as Array<{ k: string }>, (row) => row.k)).toEqual({});
  });
});
