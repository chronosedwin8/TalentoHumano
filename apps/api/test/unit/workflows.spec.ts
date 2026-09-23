import { describe, expect, it } from 'vitest';
import { matchesStepCondition } from '../../src/core/workflows/workflows.service';

describe('condiciones de un paso de aprobacion', () => {
  it('un paso sin condicion siempre aplica', () => {
    expect(matchesStepCondition(null, {})).toBe(true);
    expect(matchesStepCondition(undefined, { days: 3 })).toBe(true);
    expect(matchesStepCondition({}, { days: 3 })).toBe(true);
  });

  it('una condicion sin campo aplica igual', () => {
    expect(matchesStepCondition({ op: 'gt', value: 5 }, { days: 1 })).toBe(true);
  });

  it('una condicion sin operador aplica igual', () => {
    expect(matchesStepCondition({ field: 'days', value: 5 }, { days: 1 })).toBe(true);
  });

  it('gt exige superar el umbral', () => {
    expect(matchesStepCondition({ field: 'days', op: 'gt', value: 5 }, { days: 6 })).toBe(true);
    expect(matchesStepCondition({ field: 'days', op: 'gt', value: 5 }, { days: 5 })).toBe(false);
    expect(matchesStepCondition({ field: 'days', op: 'gt', value: 5 }, { days: 4 })).toBe(false);
  });

  it('gte incluye el umbral', () => {
    expect(matchesStepCondition({ field: 'days', op: 'gte', value: 5 }, { days: 5 })).toBe(true);
    expect(matchesStepCondition({ field: 'days', op: 'gte', value: 5 }, { days: 4 })).toBe(false);
  });

  it('lt y lte funcionan en el otro sentido', () => {
    expect(matchesStepCondition({ field: 'days', op: 'lt', value: 5 }, { days: 4 })).toBe(true);
    expect(matchesStepCondition({ field: 'days', op: 'lt', value: 5 }, { days: 5 })).toBe(false);
    expect(matchesStepCondition({ field: 'days', op: 'lte', value: 5 }, { days: 5 })).toBe(true);
  });

  it('eq compara por identidad', () => {
    expect(
      matchesStepCondition(
        { field: 'type', op: 'eq', value: 'vacaciones' },
        { type: 'vacaciones' },
      ),
    ).toBe(true);
    expect(
      matchesStepCondition({ field: 'type', op: 'eq', value: 'vacaciones' }, { type: 'licencia' }),
    ).toBe(false);
  });

  it('eq es el operador por defecto cuando llega uno desconocido', () => {
    const condition = { field: 'type', op: 'contains' as never, value: 'vacaciones' };
    expect(matchesStepCondition(condition, { type: 'vacaciones' })).toBe(true);
    expect(matchesStepCondition(condition, { type: 'licencia' })).toBe(false);
  });

  it('neq excluye un valor concreto', () => {
    expect(
      matchesStepCondition({ field: 'type', op: 'neq', value: 'vacaciones' }, { type: 'licencia' }),
    ).toBe(true);
    expect(
      matchesStepCondition(
        { field: 'type', op: 'neq', value: 'vacaciones' },
        { type: 'vacaciones' },
      ),
    ).toBe(false);
  });

  it('in acepta una lista de valores', () => {
    const condition = { field: 'type', op: 'in' as const, value: ['vacaciones', 'licencia'] };
    expect(matchesStepCondition(condition, { type: 'licencia' })).toBe(true);
    expect(matchesStepCondition(condition, { type: 'incapacidad' })).toBe(false);
  });

  it('in es falso cuando el valor esperado no es una lista', () => {
    expect(
      matchesStepCondition(
        { field: 'type', op: 'in', value: 'vacaciones' },
        { type: 'vacaciones' },
      ),
    ).toBe(false);
  });

  it('un campo ausente en el contexto no cumple una condicion numerica', () => {
    expect(matchesStepCondition({ field: 'days', op: 'gt', value: 5 }, {})).toBe(false);
  });

  it('compara numeros guardados como texto', () => {
    // La configuracion del flujo llega como JSON y puede traer strings.
    expect(matchesStepCondition({ field: 'days', op: 'gt', value: '5' }, { days: '6' })).toBe(true);
    expect(matchesStepCondition({ field: 'days', op: 'gt', value: '5' }, { days: '4' })).toBe(
      false,
    );
  });
});

describe('escalamiento por numero de dias', () => {
  // Flujo tipico: el jefe aprueba siempre y RRHH entra solo si son mas de 10 dias.
  const steps = [
    { name: 'Jefe directo', condition: null },
    { name: 'Talento humano', condition: { field: 'days', op: 'gt' as const, value: 10 } },
  ];

  const applicable = (days: number) =>
    steps.filter((step) => matchesStepCondition(step.condition, { days })).map((step) => step.name);

  it('una ausencia corta solo pasa por el jefe', () => {
    expect(applicable(3)).toEqual(['Jefe directo']);
  });

  it('una ausencia larga suma la aprobacion de talento humano', () => {
    expect(applicable(15)).toEqual(['Jefe directo', 'Talento humano']);
  });

  it('el limite exacto no escala', () => {
    expect(applicable(10)).toEqual(['Jefe directo']);
  });

  it('un dia mas que el limite si escala', () => {
    expect(applicable(11)).toEqual(['Jefe directo', 'Talento humano']);
  });
});
