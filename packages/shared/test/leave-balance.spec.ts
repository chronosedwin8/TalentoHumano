import {
  CO_VACATION_DAYS_PER_YEAR,
  accrueVacationDays,
  availableLeaveDays,
  colombianHolidays,
  countDays,
  fromDateKey,
  overlaps,
} from '@talento/shared';
import { describe, expect, it } from 'vitest';

const day = (key: string) => fromDateKey(key);
const END_OF_2026 = day('2026-12-31');

describe('causacion de vacaciones', () => {
  it('la regla colombiana son 15 dias habiles por ano', () => {
    expect(CO_VACATION_DAYS_PER_YEAR).toBe(15);
  });

  it('un ano completo causa los dias del periodo', () => {
    const accrued = accrueVacationDays({
      hiredAt: day('2020-01-01'),
      year: 2026,
      daysPerYear: CO_VACATION_DAYS_PER_YEAR,
      asOf: END_OF_2026,
    });
    expect(accrued).toBeCloseTo(15, 1);
  });

  it('medio ano causa aproximadamente la mitad', () => {
    const accrued = accrueVacationDays({
      hiredAt: day('2020-01-01'),
      year: 2026,
      daysPerYear: CO_VACATION_DAYS_PER_YEAR,
      asOf: day('2026-06-30'),
    });
    expect(accrued).toBeGreaterThan(7);
    expect(accrued).toBeLessThan(8);
  });

  it('prorratea a quien ingresa a mitad de ano', () => {
    const accrued = accrueVacationDays({
      hiredAt: day('2026-07-01'),
      year: 2026,
      daysPerYear: CO_VACATION_DAYS_PER_YEAR,
      asOf: END_OF_2026,
    });
    // Del 1 de julio al 31 de diciembre son 184 dias: algo mas de medio periodo.
    expect(accrued).toBeCloseTo((184 / 365) * 15, 1);
  });

  it('prorratea a quien se retira a mitad de ano', () => {
    const accrued = accrueVacationDays({
      hiredAt: day('2020-01-01'),
      terminatedAt: day('2026-06-30'),
      year: 2026,
      daysPerYear: CO_VACATION_DAYS_PER_YEAR,
      asOf: END_OF_2026,
    });
    expect(accrued).toBeCloseTo((181 / 365) * 15, 1);
  });

  it('no causa nada antes del ingreso', () => {
    const accrued = accrueVacationDays({
      hiredAt: day('2027-03-01'),
      year: 2026,
      daysPerYear: CO_VACATION_DAYS_PER_YEAR,
      asOf: END_OF_2026,
    });
    expect(accrued).toBe(0);
  });

  it('no causa nada despues del retiro', () => {
    const accrued = accrueVacationDays({
      hiredAt: day('2020-01-01'),
      terminatedAt: day('2025-12-31'),
      year: 2026,
      daysPerYear: CO_VACATION_DAYS_PER_YEAR,
      asOf: END_OF_2026,
    });
    expect(accrued).toBe(0);
  });

  it('nunca causa hacia el futuro', () => {
    const untilMarch = accrueVacationDays({
      hiredAt: day('2020-01-01'),
      year: 2026,
      daysPerYear: CO_VACATION_DAYS_PER_YEAR,
      asOf: day('2026-03-31'),
    });
    expect(untilMarch).toBeLessThan(4);
  });

  it('el primer dia de trabajo ya causa fraccion', () => {
    const accrued = accrueVacationDays({
      hiredAt: day('2026-01-01'),
      year: 2026,
      daysPerYear: CO_VACATION_DAYS_PER_YEAR,
      asOf: day('2026-01-01'),
    });
    expect(accrued).toBeGreaterThan(0);
    expect(accrued).toBeLessThan(0.1);
  });

  it('respeta una politica con mas dias que el minimo legal', () => {
    const accrued = accrueVacationDays({
      hiredAt: day('2020-01-01'),
      year: 2026,
      daysPerYear: 20,
      asOf: END_OF_2026,
    });
    expect(accrued).toBeCloseTo(20, 1);
  });

  it('redondea a dos decimales', () => {
    const accrued = accrueVacationDays({
      hiredAt: day('2026-02-17'),
      year: 2026,
      daysPerYear: CO_VACATION_DAYS_PER_YEAR,
      asOf: END_OF_2026,
    });
    expect(accrued).toBe(Number(accrued.toFixed(2)));
  });
});

describe('saldo disponible', () => {
  it('resta lo tomado y lo pendiente de aprobacion', () => {
    expect(availableLeaveDays({ accruedDays: 15, takenDays: 5, pendingDays: 3 })).toBe(7);
  });

  it('suma ajustes manuales y saldo trasladado', () => {
    expect(
      availableLeaveDays({ accruedDays: 15, carryOverDays: 4, adjustedDays: 1, takenDays: 2 }),
    ).toBe(18);
  });

  it('una solicitud pendiente reserva el saldo antes de aprobarse', () => {
    const before = availableLeaveDays({ accruedDays: 10, takenDays: 0, pendingDays: 0 });
    const afterRequest = availableLeaveDays({ accruedDays: 10, takenDays: 0, pendingDays: 4 });
    expect(before - afterRequest).toBe(4);
  });

  it('puede quedar en negativo si se aprobo mas de lo causado', () => {
    // El sistema lo refleja en vez de ocultarlo: es una senal para RRHH.
    expect(availableLeaveDays({ accruedDays: 5, takenDays: 8 })).toBe(-3);
  });

  it('trata los campos ausentes como cero', () => {
    expect(availableLeaveDays({ accruedDays: 12 })).toBe(12);
  });
});

describe('dias de una solicitud de vacaciones', () => {
  const holidays2026 = new Set(colombianHolidays(2026).map((h) => h.date));

  it('cuenta solo dias habiles', () => {
    // Lunes 2026-03-16 a viernes 2026-03-27 son diez dias laborales de calendario.
    expect(countDays(day('2026-03-16'), day('2026-03-27'))).toBe(10);
    // Con el calendario de festivos se descuenta el lunes 23 (Dia de San Jose).
    expect(countDays(day('2026-03-16'), day('2026-03-27'), { holidays: holidays2026 })).toBe(9);
  });

  it('descuenta los festivos que caen dentro del rango', () => {
    // La semana santa de 2026: jueves 2 y viernes 3 de abril son festivos.
    expect(countDays(day('2026-03-30'), day('2026-04-03'), { holidays: holidays2026 })).toBe(3);
  });

  it('un puente festivo cuesta un solo dia de vacaciones', () => {
    // Del viernes 20 al lunes 23 de marzo de 2026: el lunes es Dia de San Jose,
    // asi que el colaborador descansa cuatro dias gastando un dia de saldo.
    expect(countDays(day('2026-03-20'), day('2026-03-23'), { holidays: holidays2026 })).toBe(1);
    expect(countDays(day('2026-03-20'), day('2026-03-23'), { businessDays: false })).toBe(4);
  });
});

describe('deteccion de solapamiento de ausencias', () => {
  it('detecta dos solicitudes que se pisan', () => {
    expect(
      overlaps(day('2026-03-16'), day('2026-03-20'), day('2026-03-19'), day('2026-03-24')),
    ).toBe(true);
  });

  it('permite dos solicitudes consecutivas sin traslape', () => {
    expect(
      overlaps(day('2026-03-16'), day('2026-03-20'), day('2026-03-23'), day('2026-03-27')),
    ).toBe(false);
  });

  it('detecta una solicitud contenida dentro de otra', () => {
    expect(
      overlaps(day('2026-03-01'), day('2026-03-31'), day('2026-03-10'), day('2026-03-12')),
    ).toBe(true);
  });

  it('detecta el caso de un solo dia repetido', () => {
    expect(
      overlaps(day('2026-03-16'), day('2026-03-16'), day('2026-03-16'), day('2026-03-16')),
    ).toBe(true);
  });
});
