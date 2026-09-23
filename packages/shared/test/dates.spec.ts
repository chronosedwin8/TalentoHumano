import {
  addDays,
  ageBand,
  colombianHolidays,
  countDays,
  daysBetween,
  distanceMeters,
  easterSunday,
  eachDay,
  fromDateKey,
  isWeekend,
  overlaps,
  percent,
  randomTrackingCode,
  renderTemplate,
  round,
  seniorityBand,
  slugify,
  toDateKey,
  yearsOfService,
} from '@talento/shared';
import { describe, expect, it } from 'vitest';

const day = (key: string) => fromDateKey(key);

describe('utilidades de fecha', () => {
  it('convierte ida y vuelta entre Date y clave ISO', () => {
    expect(toDateKey(day('2026-03-15'))).toBe('2026-03-15');
  });

  it('reconoce sabado y domingo como fin de semana', () => {
    expect(isWeekend(day('2026-03-14'))).toBe(true); // sabado
    expect(isWeekend(day('2026-03-15'))).toBe(true); // domingo
    expect(isWeekend(day('2026-03-16'))).toBe(false); // lunes
  });

  it('cuenta los dias de un rango inclusivo', () => {
    expect(eachDay(day('2026-03-16'), day('2026-03-20'))).toHaveLength(5);
  });

  it('no se desfasa al cruzar el cambio de horario', () => {
    // Las fechas se manejan en UTC, asi que marzo y noviembre no pierden dias.
    expect(daysBetween(day('2026-03-01'), day('2026-04-01'))).toBe(31);
    expect(daysBetween(day('2026-11-01'), day('2026-12-01'))).toBe(30);
  });

  it('detecta el solapamiento de dos rangos', () => {
    expect(
      overlaps(day('2026-03-16'), day('2026-03-20'), day('2026-03-18'), day('2026-03-25')),
    ).toBe(true);
    expect(
      overlaps(day('2026-03-16'), day('2026-03-20'), day('2026-03-21'), day('2026-03-25')),
    ).toBe(false);
    // Rangos que se tocan en un extremo si se solapan.
    expect(
      overlaps(day('2026-03-16'), day('2026-03-20'), day('2026-03-20'), day('2026-03-25')),
    ).toBe(true);
  });
});

describe('festivos colombianos', () => {
  it('publica 18 festivos por ano', () => {
    for (const year of [2024, 2025, 2026, 2027, 2030]) {
      expect(colombianHolidays(year), `festivos de ${year}`).toHaveLength(18);
    }
  });

  it('calcula correctamente el domingo de pascua', () => {
    expect(toDateKey(easterSunday(2024))).toBe('2024-03-31');
    expect(toDateKey(easterSunday(2025))).toBe('2025-04-20');
    expect(toDateKey(easterSunday(2026))).toBe('2026-04-05');
  });

  it('deriva jueves y viernes santo de la pascua', () => {
    const holidays = colombianHolidays(2026);
    expect(holidays.find((h) => h.name === 'Jueves Santo')?.date).toBe('2026-04-02');
    expect(holidays.find((h) => h.name === 'Viernes Santo')?.date).toBe('2026-04-03');
  });

  it('deja fijos los festivos que la Ley Emiliani no traslada', () => {
    const holidays = colombianHolidays(2026);
    const fixed = [
      '2026-01-01',
      '2026-05-01',
      '2026-07-20',
      '2026-08-07',
      '2026-12-08',
      '2026-12-25',
    ];
    for (const date of fixed) {
      expect(holidays.map((h) => h.date)).toContain(date);
    }
  });

  it('traslada al lunes siguiente los festivos moviles (Ley Emiliani)', () => {
    const holidays = colombianHolidays(2026);
    // Reyes Magos cae el 6 de enero de 2026 (martes) y se corre al lunes 12.
    expect(holidays.find((h) => h.name === 'Reyes Magos')?.date).toBe('2026-01-12');
    // Todo festivo movil debe quedar en lunes.
    const movableNames = [
      'Reyes Magos',
      'Dia de San Jose',
      'San Pedro y San Pablo',
      'Dia de la Raza',
    ];
    for (const name of movableNames) {
      const holiday = holidays.find((h) => h.name === name);
      expect(day(holiday!.date).getUTCDay(), `${name} deberia caer en lunes`).toBe(1);
    }
  });

  it('no traslada un festivo movil que ya cae en lunes', () => {
    // El 1 de noviembre de 2027 es lunes: Todos los Santos se queda ahi.
    const holiday = colombianHolidays(2027).find((h) => h.name === 'Todos los Santos');
    expect(holiday?.date).toBe('2027-11-01');
  });

  it('nunca repite un mismo nombre', () => {
    for (const year of [2025, 2026, 2027]) {
      const names = colombianHolidays(year).map((h) => h.name);
      expect(new Set(names).size, `nombres repetidos en ${year}`).toBe(names.length);
    }
  });

  it('reconoce los anos en que dos celebraciones caen el mismo dia', () => {
    // En 2025 y 2030 San Pedro y San Pablo y el Sagrado Corazon coinciden tras
    // el traslado al lunes, asi que el ano tiene 18 celebraciones pero solo 17
    // dias no laborables. El conteo de dias habiles usa un Set, de modo que la
    // coincidencia no descuenta el dia dos veces.
    for (const year of [2025, 2030]) {
      const holidays = colombianHolidays(year);
      expect(holidays).toHaveLength(18);
      expect(new Set(holidays.map((h) => h.date)).size, `dias libres de ${year}`).toBe(17);
    }

    for (const year of [2024, 2026, 2027, 2028, 2029]) {
      const dates = colombianHolidays(year).map((h) => h.date);
      expect(new Set(dates).size, `dias libres de ${year}`).toBe(18);
    }
  });

  it('el dia compartido se descuenta una sola vez del conteo habil', () => {
    const holidays2025 = new Set(colombianHolidays(2025).map((h) => h.date));
    // Semana del lunes 2025-06-30: solo pierde ese lunes, no dos dias.
    expect(countDays(day('2025-06-30'), day('2025-07-04'), { holidays: holidays2025 })).toBe(4);
  });

  it('mantiene todos los festivos dentro del ano solicitado', () => {
    for (const holiday of colombianHolidays(2026)) {
      expect(holiday.date.startsWith('2026')).toBe(true);
    }
  });
});

describe('conteo de dias habiles', () => {
  const holidays2026 = new Set(colombianHolidays(2026).map((h) => h.date));

  it('cuenta dias calendario cuando se pide asi', () => {
    expect(countDays(day('2026-03-16'), day('2026-03-22'), { businessDays: false })).toBe(7);
  });

  it('excluye sabados y domingos', () => {
    // Lunes 16 a domingo 22 de marzo: cinco dias habiles.
    expect(countDays(day('2026-03-16'), day('2026-03-22'))).toBe(5);
  });

  it('excluye los festivos del calendario', () => {
    // La semana del 1 de mayo de 2026 (viernes, Dia del Trabajo).
    const withHoliday = countDays(day('2026-04-27'), day('2026-05-01'), { holidays: holidays2026 });
    const withoutHoliday = countDays(day('2026-04-27'), day('2026-05-01'));
    expect(withoutHoliday).toBe(5);
    expect(withHoliday).toBe(4);
  });

  it('cuenta cero cuando el rango cae entero en fin de semana', () => {
    expect(countDays(day('2026-03-14'), day('2026-03-15'))).toBe(0);
  });

  it('un unico dia habil cuenta uno', () => {
    expect(countDays(day('2026-03-16'), day('2026-03-16'))).toBe(1);
  });

  it('quince dias habiles de vacaciones abarcan tres semanas de calendario', () => {
    // Regla colombiana: 15 dias habiles de vacaciones por ano trabajado.
    // Partiendo del lunes 2026-06-01, el dia 15 habil es el viernes 2026-06-19.
    let counted = 0;
    let cursor = day('2026-06-01');
    while (counted < 15) {
      if (!isWeekend(cursor) && !holidays2026.has(toDateKey(cursor))) counted += 1;
      if (counted < 15) cursor = addDays(cursor, 1);
    }
    expect(countDays(day('2026-06-01'), cursor, { holidays: holidays2026 })).toBe(15);
    expect(daysBetween(day('2026-06-01'), cursor)).toBeGreaterThanOrEqual(18);
  });
});

describe('antiguedad y bandas demograficas', () => {
  it('calcula anos de servicio', () => {
    expect(yearsOfService(day('2020-01-01'), day('2026-01-01'))).toBeCloseTo(6, 1);
  });

  it('clasifica la antiguedad en bandas', () => {
    const at = day('2026-01-01');
    expect(seniorityBand(day('2025-11-01'), at)).toBe('0-6m');
    expect(seniorityBand(day('2025-05-01'), at)).toBe('6-12m');
    expect(seniorityBand(day('2024-01-01'), at)).toBe('1-3a');
    expect(seniorityBand(day('2022-01-01'), at)).toBe('3-5a');
    expect(seniorityBand(day('2019-01-01'), at)).toBe('5-10a');
  });

  it('agrupa la edad en rangos y nunca expone la fecha exacta', () => {
    const band = ageBand(day('1990-06-15'), day('2026-01-01'));
    expect(band).toMatch(/^\d+/);
    expect(band).not.toContain('1990');
  });
});

describe('utilidades varias', () => {
  it('genera slugs seguros para URL', () => {
    expect(slugify('Analista de Talento Humano')).toBe('analista-de-talento-humano');
    expect(slugify('Gestión & Nómina')).toBe('gestion-nomina');
  });

  it('interpola variables de plantilla y deja intactas las desconocidas', () => {
    const rendered = renderTemplate(
      'Hola {{employee.first_name}}, bienvenido a {{company.name}}.',
      {
        employee: { first_name: 'Ana' },
        company: { name: 'Demo S.A.S.' },
      },
    );
    expect(rendered).toBe('Hola Ana, bienvenido a Demo S.A.S..');
  });

  it('calcula porcentajes y redondea', () => {
    expect(percent(1, 4)).toBe(25);
    expect(percent(0, 0)).toBe(0);
    expect(round(3.14159, 2)).toBe(3.14);
  });

  it('mide la distancia entre coordenadas para el geocerco', () => {
    // Un grado de latitud son ~111 km.
    expect(distanceMeters(4.7, -74.05, 4.71, -74.05)).toBeGreaterThan(1000);
    expect(distanceMeters(4.7, -74.05, 4.71, -74.05)).toBeLessThan(1200);
    expect(distanceMeters(4.7, -74.05, 4.7, -74.05)).toBe(0);
  });

  it('genera codigos de seguimiento con el formato publicado', () => {
    const code = randomTrackingCode(() => 0.5);
    expect(code).toMatch(/^TAL-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it('genera codigos de seguimiento distintos entre si', () => {
    const codes = new Set(Array.from({ length: 200 }, () => randomTrackingCode()));
    expect(codes.size).toBeGreaterThan(190);
  });
});
