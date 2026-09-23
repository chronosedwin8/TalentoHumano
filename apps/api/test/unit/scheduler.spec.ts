import { describe, expect, it } from 'vitest';
import { nextOccurrence } from '../../src/core/scheduler/reports-schedule.runner';

const at = (iso: string) => new Date(iso);

describe('siguiente ejecucion de un cron', () => {
  it('todos los dias a una hora fija', () => {
    const next = nextOccurrence('0 6 * * *', at('2026-09-23T10:00:00Z'));
    expect(next.toISOString()).toBe('2026-09-24T06:00:00.000Z');
  });

  it('cada quince minutos', () => {
    const next = nextOccurrence('*/15 * * * *', at('2026-09-23T10:07:00Z'));
    expect(next.toISOString()).toBe('2026-09-23T10:15:00.000Z');
  });

  it('el primer dia del mes', () => {
    const next = nextOccurrence('0 8 1 * *', at('2026-09-23T10:00:00Z'));
    expect(next.toISOString()).toBe('2026-10-01T08:00:00.000Z');
  });

  it('solo dias habiles (lunes a viernes)', () => {
    // 2026-09-25 is a Friday, so the next weekday run is Monday the 28th.
    const next = nextOccurrence('30 7 * * 1-5', at('2026-09-25T09:00:00Z'));
    expect(next.toISOString()).toBe('2026-09-28T07:30:00.000Z');
  });

  it('una expresion invalida cae en manana a las 06:00', () => {
    const next = nextOccurrence('cada dia', at('2026-09-23T10:00:00Z'));
    expect(next.toISOString()).toBe('2026-09-24T06:00:00.000Z');
    expect(nextOccurrence('99 * * * *', at('2026-09-23T10:00:00Z')).toISOString()).toBe(
      '2026-09-24T06:00:00.000Z',
    );
  });
});
