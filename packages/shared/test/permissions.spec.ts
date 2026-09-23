import {
  ACTION_LABELS,
  MODULE_CATALOG,
  PERMISSION_CATALOG,
  SCOPE_RANK,
  SCOPES,
  SYSTEM_ROLES,
  SYSTEM_ROLE_DEFINITIONS,
  expandPermissionPatterns,
  permissionMatches,
  type Scope,
} from '@talento/shared';
import { describe, expect, it } from 'vitest';

describe('catalogo de permisos', () => {
  it('usa la forma prefijo.recurso.accion en todos los codigos', () => {
    for (const permission of PERMISSION_CATALOG) {
      const [, resource, action] = permission.code.split('.');
      expect(permission.code.split('.')).toHaveLength(3);
      expect(resource).toBe(permission.resource);
      expect(action).toBe(permission.action);
    }
  });

  it('solo los permisos de workflow usan un prefijo distinto a su modulo', () => {
    // Los flujos de aprobacion se configuran desde Configuracion, asi que sus
    // permisos viven en el modulo `settings` aunque su codigo diga `workflow`.
    const odd = PERMISSION_CATALOG.filter(
      (permission) => !permission.code.startsWith(`${permission.module}.`),
    );
    expect(new Set(odd.map((permission) => permission.code.split('.')[0]))).toEqual(
      new Set(['workflow']),
    );
    expect(odd.every((permission) => permission.module === 'settings')).toBe(true);
  });

  it('no repite codigos', () => {
    const codes = PERMISSION_CATALOG.map((permission) => permission.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('solo referencia modulos del catalogo', () => {
    const modules = new Set(MODULE_CATALOG.map((module) => module.key));
    for (const permission of PERMISSION_CATALOG) {
      expect(modules.has(permission.module)).toBe(true);
    }
  });

  it('usa acciones con etiqueta conocida', () => {
    for (const permission of PERMISSION_CATALOG) {
      expect(ACTION_LABELS[permission.action]).toBeDefined();
    }
  });

  it('marca como sensibles los permisos sobre datos protegidos', () => {
    const sensitive = PERMISSION_CATALOG.filter((permission) => permission.sensitive).map(
      (p) => p.code,
    );
    expect(sensitive).toContain('people.sensitive.read');
    expect(sensitive).toContain('ethics.report.read');
  });
});

describe('permissionMatches', () => {
  it('acepta una coincidencia exacta', () => {
    expect(permissionMatches('people.employee.read', 'people.employee.read')).toBe(true);
  });

  it('rechaza un permiso que no fue otorgado', () => {
    expect(permissionMatches('people.employee.read', 'people.employee.delete')).toBe(false);
  });

  it('el comodin de modulo cubre codigos de tres segmentos', () => {
    // Regresion: `people.*` compilaba a `^people\.[^.]+$` y no casaba con
    // `people.employee.read`, dejando al rol sin permisos efectivos.
    expect(permissionMatches('people.*', 'people.employee.read')).toBe(true);
    expect(permissionMatches('people.*', 'people.sensitive.read')).toBe(true);
  });

  it('el comodin de modulo no cruza a otro modulo', () => {
    expect(permissionMatches('people.*', 'recruiting.candidate.read')).toBe(false);
  });

  it('el comodin intermedio solo cubre un segmento', () => {
    expect(permissionMatches('people.*.read', 'people.employee.read')).toBe(true);
    expect(permissionMatches('people.*.read', 'people.employee.delete')).toBe(false);
  });

  it('el comodin global cubre cualquier codigo', () => {
    expect(permissionMatches('*', 'settings.role.delete')).toBe(true);
  });

  it('no interpreta el punto como comodin de expresion regular', () => {
    expect(permissionMatches('people.employee.read', 'peopleXemployeeXread')).toBe(false);
  });
});

describe('expandPermissionPatterns', () => {
  it('expande un comodin de modulo a codigos concretos del catalogo', () => {
    const expanded = expandPermissionPatterns(['ethics.*']);
    expect(expanded.length).toBeGreaterThan(0);
    expect(expanded.every((code) => code.startsWith('ethics.'))).toBe(true);
    expect(expanded).toContain('ethics.report.read');
  });

  it('devuelve solo codigos existentes en el catalogo', () => {
    const codes = new Set(PERMISSION_CATALOG.map((permission) => permission.code));
    for (const code of expandPermissionPatterns(['*'])) {
      expect(codes.has(code)).toBe(true);
    }
  });

  it('no duplica cuando dos patrones se solapan', () => {
    const expanded = expandPermissionPatterns(['people.*', 'people.employee.read']);
    expect(new Set(expanded).size).toBe(expanded.length);
  });
});

describe('alcances de datos', () => {
  it('ordena los alcances de mas estrecho a mas amplio', () => {
    const ranked = [...SCOPES].sort((a, b) => SCOPE_RANK[a] - SCOPE_RANK[b]);
    expect(ranked).toEqual(['own', 'team', 'area', 'company']);
  });
});

describe('roles del sistema', () => {
  it('define los once roles previstos', () => {
    expect(Object.keys(SYSTEM_ROLES)).toHaveLength(11);
    for (const key of Object.values(SYSTEM_ROLES)) {
      expect(SYSTEM_ROLE_DEFINITIONS.some((role) => role.key === key)).toBe(true);
    }
  });

  it('cada rol expande a permisos reales y a un alcance valido', () => {
    for (const role of SYSTEM_ROLE_DEFINITIONS) {
      const expanded = expandPermissionPatterns(role.permissions);
      expect(expanded.length, `el rol ${role.key} no expande a ningun permiso`).toBeGreaterThan(0);
      expect(SCOPES).toContain(role.scope as Scope);
    }
  });

  it('el rol empleado solo ve datos propios y nunca datos sensibles de terceros', () => {
    const employee = SYSTEM_ROLE_DEFINITIONS.find((role) => role.key === SYSTEM_ROLES.EMPLOYEE);
    expect(employee?.scope).toBe('own');
    const expanded = expandPermissionPatterns(employee?.permissions ?? []);
    expect(expanded).not.toContain('settings.audit.read');
    expect(expanded).not.toContain('ethics.report.read');
    expect(expanded).not.toContain('people.sensitive.read');
  });

  it('el oficial de etica accede al canal de denuncias', () => {
    const officer = SYSTEM_ROLE_DEFINITIONS.find(
      (role) => role.key === SYSTEM_ROLES.ETHICS_OFFICER,
    );
    const expanded = expandPermissionPatterns(officer?.permissions ?? []);
    expect(expanded).toContain('ethics.report.read');
  });

  it('el auditor puede leer la bitacora pero no modificar nada', () => {
    const auditor = SYSTEM_ROLE_DEFINITIONS.find((role) => role.key === SYSTEM_ROLES.AUDITOR);
    const expanded = expandPermissionPatterns(auditor?.permissions ?? []);
    expect(expanded).toContain('settings.audit.read');
    expect(expanded.filter((code) => code.endsWith('.delete'))).toHaveLength(0);
  });

  it('el administrador de la empresa cubre todo el catalogo', () => {
    const admin = SYSTEM_ROLE_DEFINITIONS.find((role) => role.key === SYSTEM_ROLES.COMPANY_ADMIN);
    const expanded = expandPermissionPatterns(admin?.permissions ?? []);
    expect(expanded.length).toBe(PERMISSION_CATALOG.length);
  });
});
