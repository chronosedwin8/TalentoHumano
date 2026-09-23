import { Injectable } from '@nestjs/common';
import { EmployeeStatus } from '@prisma/client';
import { employeeCreateSchema, employeeUpdateSchema, uuid } from '@talento/shared';
import * as ExcelJS from 'exceljs';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { FilesService } from '../../core/files/files.service';
import { StorageService } from '../../core/files/storage.service';
import { PeopleService, type EmployeeListParams } from './people.service';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Hard cap so a single spreadsheet cannot tie up the request for minutes. */
const MAX_IMPORT_ROWS = 2000;
const MAX_EXPORT_ROWS = 5000;

interface ImportColumn {
  key: string;
  label: string;
  required?: boolean;
  example: string;
  /** Shown on the instructions sheet. */
  hint?: string;
  /** Extra header spellings accepted on import (already normalised). */
  aliases?: string[];
}

/**
 * Columns of the import template. Catalog references (position, department,
 * location, cost center, manager) accept the name/code/email as well as the
 * id, so the file can be filled by hand from the catalog sheet.
 */
export const IMPORT_COLUMNS: ImportColumn[] = [
  {
    key: 'employeeCode',
    label: 'Codigo',
    example: '',
    hint: 'Opcional; se genera si va vacio',
    aliases: ['codigo de empleado', 'codigo empleado'],
  },
  { key: 'firstName', label: 'Nombres', required: true, example: 'Ana Maria', aliases: ['nombre'] },
  {
    key: 'lastName',
    label: 'Apellidos',
    required: true,
    example: 'Perez',
    aliases: ['apellido', 'primer apellido'],
  },
  { key: 'secondLastName', label: 'Segundo apellido', example: 'Gomez' },
  { key: 'preferredName', label: 'Nombre preferido', example: 'Ana' },
  {
    key: 'documentType',
    label: 'Tipo de documento',
    example: 'CC',
    hint: 'CC, CE, PA, PEP',
    aliases: ['tipo documento'],
  },
  {
    key: 'documentNumber',
    label: 'Numero de documento',
    required: true,
    example: '1020304050',
    aliases: ['documento', 'numero documento', 'cedula'],
  },
  {
    key: 'email',
    label: 'Correo corporativo',
    required: true,
    example: 'ana.perez@empresa.com',
    aliases: ['correo', 'correo electronico'],
  },
  { key: 'personalEmail', label: 'Correo personal', example: 'ana@correo.com' },
  { key: 'phone', label: 'Telefono', example: '6015551234', aliases: ['telefono fijo'] },
  { key: 'mobile', label: 'Celular', example: '3001234567', aliases: ['movil'] },
  {
    key: 'birthDate',
    label: 'Fecha de nacimiento',
    example: '1990-05-14',
    hint: 'AAAA-MM-DD',
    aliases: ['nacimiento'],
  },
  {
    key: 'gender',
    label: 'Genero',
    example: 'female',
    hint: 'male, female, other, undisclosed (o masculino, femenino, otro)',
    aliases: ['sexo'],
  },
  { key: 'nationality', label: 'Nacionalidad', example: 'Colombiana' },
  { key: 'address', label: 'Direccion', example: 'Calle 1 # 2-3' },
  { key: 'city', label: 'Ciudad', example: 'Bogota' },
  {
    key: 'hiredAt',
    label: 'Fecha de ingreso',
    required: true,
    example: '2024-02-01',
    hint: 'AAAA-MM-DD',
    aliases: ['ingreso', 'fecha ingreso'],
  },
  {
    key: 'status',
    label: 'Estado',
    example: 'active',
    hint: 'active, inactive, on_leave, pre_hire, suspended (o activo, inactivo, por ingresar)',
  },
  {
    key: 'position',
    label: 'Cargo',
    example: 'Analista',
    hint: 'Nombre o id del cargo (hoja Catalogos)',
    aliases: ['positionid', 'cargo'],
  },
  {
    key: 'department',
    label: 'Area',
    example: 'Talento Humano',
    hint: 'Nombre o id del area (hoja Catalogos)',
    aliases: ['departmentid', 'departamento'],
  },
  {
    key: 'location',
    label: 'Sede',
    example: 'Bogota',
    hint: 'Nombre o id de la sede (hoja Catalogos)',
    aliases: ['locationid'],
  },
  {
    key: 'costCenter',
    label: 'Centro de costo',
    example: '',
    hint: 'Nombre, codigo o id',
    aliases: ['costcenterid', 'centro costo'],
  },
  {
    key: 'manager',
    label: 'Jefe',
    example: 'jefe@empresa.com',
    hint: 'Correo, codigo de empleado, documento o id del jefe',
    aliases: ['managerid', 'jefe inmediato'],
  },
];

const STATUS_ALIASES: Record<string, EmployeeStatus> = {
  activo: 'active',
  activa: 'active',
  inactivo: 'inactive',
  inactiva: 'inactive',
  retirado: 'inactive',
  'en ausencia': 'on_leave',
  ausencia: 'on_leave',
  'por ingresar': 'pre_hire',
  prehire: 'pre_hire',
  suspendido: 'suspended',
};

const GENDER_ALIASES: Record<string, string> = {
  masculino: 'male',
  hombre: 'male',
  m: 'male',
  femenino: 'female',
  mujer: 'female',
  f: 'female',
  otro: 'other',
  'sin declarar': 'undisclosed',
  'no declara': 'undisclosed',
};

export interface ImportRowResult {
  row: number;
  status: 'created' | 'updated' | 'error';
  message?: string;
  id?: string;
  name?: string;
  email?: string;
}

interface CatalogEntry {
  id: string;
  name: string;
  code?: string | null;
}

interface ImportCatalogs {
  positions: CatalogEntry[];
  departments: CatalogEntry[];
  locations: CatalogEntry[];
  costCenters: CatalogEntry[];
  employees: Array<{ id: string; email: string; employeeCode: string; documentNumber: string }>;
}

/** Lower-case, accent-free, punctuation collapsed to single spaces. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9@.]+/g, ' ')
    .trim();
}

/** Plain text of a cell, whatever Excel stored (rich text, hyperlink, formula, date). */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('richText' in value)
      return value.richText
        .map((part) => part.text)
        .join('')
        .trim();
    if ('text' in value) return cellText(value.text as ExcelJS.CellValue);
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
    if ('error' in value) return '';
    return String(value).trim();
  }
  return String(value).trim();
}

/** Accepts ISO, DD/MM/YYYY and Excel serial numbers. */
function toIsoDate(raw: string): string {
  if (!raw) return raw;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000);
    return date.toISOString().slice(0, 10);
  }
  return raw;
}

@Injectable()
export class EmployeeImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly people: PeopleService,
    private readonly files: FilesService,
    private readonly storage: StorageService,
  ) {}

  /* ------------------------------ template ------------------------------ */

  async buildTemplate(ctx: RequestContext): Promise<Buffer> {
    const catalogs = await this.loadCatalogs(ctx.companyId);
    const workbook = this.newWorkbook();

    const sheet = workbook.addWorksheet('Colaboradores', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = IMPORT_COLUMNS.map((column) => ({
      key: column.key,
      header: column.required ? `${column.label} *` : column.label,
      width: Math.max(14, Math.min(34, column.label.length + 6)),
    }));
    this.styleHeader(sheet);
    sheet.addRow(Object.fromEntries(IMPORT_COLUMNS.map((column) => [column.key, column.example])));

    // Drop-down lists on the closed-set columns so typos are caught before the upload.
    const lists: Record<string, string[]> = {
      status: Object.values(EmployeeStatus),
      gender: ['male', 'female', 'other', 'undisclosed'],
      documentType: ['CC', 'CE', 'PA', 'PEP'],
    };
    for (const [key, values] of Object.entries(lists)) {
      const index = IMPORT_COLUMNS.findIndex((column) => column.key === key) + 1;
      for (let row = 2; row <= 500; row += 1) {
        sheet.getCell(row, index).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${values.join(',')}"`],
        };
      }
    }

    const catalog = workbook.addWorksheet('Catalogos');
    const columns: Array<[string, string[]]> = [
      ['Areas', catalogs.departments.map((entry) => entry.name)],
      ['Cargos', catalogs.positions.map((entry) => entry.name)],
      ['Sedes', catalogs.locations.map((entry) => entry.name)],
      ['Centros de costo', catalogs.costCenters.map((entry) => entry.name)],
      ['Estados', Object.values(EmployeeStatus)],
      ['Generos', ['male', 'female', 'other', 'undisclosed']],
      ['Tipos de documento', ['CC', 'CE', 'PA', 'PEP']],
    ];
    catalog.columns = columns.map(([header]) => ({ header, width: 28 }));
    this.styleHeader(catalog);
    const longest = Math.max(...columns.map(([, values]) => values.length));
    for (let index = 0; index < longest; index += 1) {
      catalog.addRow(columns.map(([, values]) => values[index] ?? ''));
    }

    const instructions = workbook.addWorksheet('Instrucciones');
    instructions.columns = [
      { header: 'Columna', width: 26 },
      { header: 'Clave', width: 20 },
      { header: 'Obligatoria', width: 12 },
      { header: 'Ejemplo', width: 26 },
      { header: 'Notas', width: 60 },
    ];
    this.styleHeader(instructions);
    for (const column of IMPORT_COLUMNS) {
      instructions.addRow([
        column.label,
        column.key,
        column.required ? 'Si' : 'No',
        column.example,
        column.hint ?? '',
      ]);
    }
    instructions.addRow([]);
    instructions.addRow([
      'Los encabezados se reconocen sin importar mayusculas ni tildes. Una fila cuyo documento o correo ya exista actualiza al colaborador; las demas lo crean. La importacion nunca crea usuarios.',
    ]);

    return this.toBuffer(workbook);
  }

  /* ------------------------------- import ------------------------------- */

  /** Reads the uploaded XLSX and turns each row into a plain object keyed by column key. */
  async rowsFromFile(
    ctx: RequestContext,
    fileId: string,
  ): Promise<{ rows: Array<Record<string, string>>; ignoredColumns: string[] }> {
    const file = await this.files.findById(ctx.companyId, fileId);
    if (!file.isUploaded) throw BusinessException.validation('El archivo aun no termina de subir');
    const isXlsx = file.mimeType === XLSX_MIME || file.filename.toLowerCase().endsWith('.xlsx');
    if (!isXlsx) throw BusinessException.validation('El archivo debe ser un Excel (.xlsx)');

    const workbook = new ExcelJS.Workbook();
    const bytes = await this.readStoredFile(file.storageKey);
    await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.getWorksheet('Colaboradores') ?? workbook.worksheets[0];
    if (!sheet) throw BusinessException.validation('El archivo no tiene hojas');

    const headerRow = sheet.getRow(1);
    const mapping = new Map<number, string>();
    const ignoredColumns: string[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, index) => {
      const header = cellText(cell.value).replace(/\*/g, '').trim();
      if (!header) return;
      const key = this.matchHeader(header);
      if (key) mapping.set(index, key);
      else ignoredColumns.push(header);
    });

    const mapped = new Set(mapping.values());
    const missing = IMPORT_COLUMNS.filter((column) => column.required && !mapped.has(column.key));
    if (missing.length) {
      throw BusinessException.validation(
        `Faltan columnas obligatorias: ${missing.map((column) => column.label).join(', ')}`,
        { missing: missing.map((column) => column.key), ignoredColumns },
      );
    }

    const rows: Array<Record<string, string>> = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: Record<string, string> = {};
      let hasValue = false;
      for (const [index, key] of mapping) {
        const value = cellText(row.getCell(index).value);
        if (value) hasValue = true;
        record[key] = value;
      }
      if (hasValue) rows.push(record);
    });

    if (!rows.length) throw BusinessException.validation('El archivo no tiene filas para importar');
    if (rows.length > MAX_IMPORT_ROWS) {
      throw BusinessException.validation(`Maximo ${MAX_IMPORT_ROWS} filas por importacion`, {
        rows: rows.length,
      });
    }
    return { rows, ignoredColumns };
  }

  /**
   * Validates every row against the employee schema and, unless `dryRun`,
   * creates or updates. A row whose document or corporate email already
   * exists updates that employee. Users are never created here.
   */
  async importRows(
    ctx: RequestContext,
    rows: Array<Record<string, unknown>>,
    dryRun: boolean,
  ): Promise<ImportRowResult[]> {
    const catalogs = await this.loadCatalogs(ctx.companyId);
    const results: ImportRowResult[] = [];
    const seen = new Map<string, number>();

    for (const [index, raw] of rows.entries()) {
      const rowNumber = index + 2; // 1-based, after the header row
      const resolved = this.resolveRow(raw, catalogs);
      const label = {
        name: [resolved.payload.firstName, resolved.payload.lastName].filter(Boolean).join(' '),
        email: String(resolved.payload.email ?? ''),
      };

      if (resolved.errors.length) {
        results.push({
          row: rowNumber,
          status: 'error',
          message: resolved.errors.join('; '),
          ...label,
        });
        continue;
      }

      const existing = this.findExisting(resolved.payload, catalogs);
      const parsed = existing
        ? employeeUpdateSchema.safeParse(resolved.payload)
        : employeeCreateSchema.safeParse({ ...resolved.payload, createUserAccount: false });
      if (!parsed.success) {
        results.push({
          row: rowNumber,
          status: 'error',
          message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          ...label,
        });
        continue;
      }

      // Duplicates inside the same file are rejected before touching the database.
      const dupKeys = [
        `doc:${resolved.payload.documentNumber}`,
        `mail:${String(resolved.payload.email ?? '').toLowerCase()}`,
      ];
      const duplicateOf = dupKeys.map((key) => seen.get(key)).find((row) => row !== undefined);
      if (duplicateOf !== undefined) {
        results.push({
          row: rowNumber,
          status: 'error',
          message: `Repite el documento o correo de la fila ${duplicateOf}`,
          ...label,
        });
        continue;
      }
      dupKeys.forEach((key) => seen.set(key, rowNumber));

      if (dryRun) {
        results.push({
          row: rowNumber,
          status: existing ? 'updated' : 'created',
          id: existing?.id,
          ...label,
        });
        continue;
      }

      try {
        if (existing) {
          const { employeeCode: _code, ...data } = parsed.data as Record<string, unknown>;
          const employee = await this.people.update(ctx, existing.id, data);
          results.push({ row: rowNumber, status: 'updated', id: employee.id, ...label });
        } else {
          const employee = await this.people.create(
            ctx,
            parsed.data as Parameters<PeopleService['create']>[1],
          );
          catalogs.employees.push({
            id: employee.id,
            email: employee.email,
            employeeCode: employee.employeeCode,
            documentNumber: employee.documentNumber,
          });
          results.push({ row: rowNumber, status: 'created', id: employee.id, ...label });
        }
      } catch (error) {
        results.push({
          row: rowNumber,
          status: 'error',
          message: (error as Error).message,
          ...label,
        });
      }
    }

    return results;
  }

  /* ------------------------------- export ------------------------------- */

  /** XLSX of the employee list; never carries encrypted or health/bank columns. */
  async buildExport(ctx: RequestContext, params: Omit<EmployeeListParams, 'page' | 'limit'>) {
    const rows = await this.people.exportRows(ctx, params, MAX_EXPORT_ROWS);
    const workbook = this.newWorkbook();
    const sheet = workbook.addWorksheet('Colaboradores', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = [
      { header: 'Codigo', key: 'employeeCode', width: 14 },
      { header: 'Nombres', key: 'firstName', width: 20 },
      { header: 'Apellidos', key: 'lastName', width: 20 },
      { header: 'Segundo apellido', key: 'secondLastName', width: 18 },
      { header: 'Correo corporativo', key: 'email', width: 30 },
      { header: 'Correo personal', key: 'personalEmail', width: 28 },
      { header: 'Telefono', key: 'phone', width: 16 },
      { header: 'Celular', key: 'mobile', width: 16 },
      { header: 'Tipo de documento', key: 'documentType', width: 12 },
      { header: 'Numero de documento', key: 'documentNumber', width: 18 },
      { header: 'Fecha de nacimiento', key: 'birthDate', width: 14 },
      { header: 'Genero', key: 'gender', width: 12 },
      { header: 'Nacionalidad', key: 'nationality', width: 16 },
      { header: 'Ciudad', key: 'city', width: 16 },
      { header: 'Estado', key: 'status', width: 12 },
      { header: 'Fecha de ingreso', key: 'hiredAt', width: 14 },
      { header: 'Fecha de retiro', key: 'terminatedAt', width: 14 },
      { header: 'Modalidad', key: 'workModality', width: 12 },
      { header: 'Cargo', key: 'position', width: 24 },
      { header: 'Area', key: 'department', width: 24 },
      { header: 'Sede', key: 'location', width: 20 },
      { header: 'Centro de costo', key: 'costCenter', width: 20 },
      { header: 'Jefe', key: 'manager', width: 26 },
      { header: 'Correo del jefe', key: 'managerEmail', width: 30 },
    ];
    this.styleHeader(sheet);
    const day = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : '');
    for (const row of rows) {
      sheet.addRow({
        employeeCode: row.employeeCode,
        firstName: row.firstName,
        lastName: row.lastName,
        secondLastName: row.secondLastName ?? '',
        email: row.email,
        personalEmail: row.personalEmail ?? '',
        phone: row.phone ?? '',
        mobile: row.mobile ?? '',
        documentType: row.documentType,
        documentNumber: row.documentNumber,
        birthDate: day(row.birthDate),
        gender: row.gender ?? '',
        nationality: row.nationality ?? '',
        city: row.city ?? '',
        status: row.status,
        hiredAt: day(row.hiredAt),
        terminatedAt: day(row.terminatedAt),
        workModality: row.workModality,
        position: row.position?.name ?? '',
        department: row.department?.name ?? '',
        location: row.location?.name ?? '',
        costCenter: row.costCenter?.name ?? '',
        manager: row.manager?.fullName ?? '',
        managerEmail: row.manager?.email ?? '',
      });
    }
    return { buffer: await this.toBuffer(workbook), count: rows.length };
  }

  /* ------------------------------- helpers ------------------------------ */

  private matchHeader(header: string): string | null {
    const wanted = normalizeText(header);
    if (!wanted) return null;
    for (const column of IMPORT_COLUMNS) {
      const candidates = [column.key, column.label, ...(column.aliases ?? [])].map(normalizeText);
      if (candidates.includes(wanted)) return column.key;
    }
    return null;
  }

  /** Turns the raw strings of a row into a payload the employee schema understands. */
  private resolveRow(
    raw: Record<string, unknown>,
    catalogs: ImportCatalogs,
  ): { payload: Record<string, unknown>; errors: string[] } {
    const errors: string[] = [];
    const text = (key: string): string => {
      const value = raw[key];
      if (value === null || value === undefined) return '';
      if (value instanceof Date) return value.toISOString().slice(0, 10);
      return String(value).trim();
    };
    const optional = (value: string) => (value === '' ? undefined : value);

    const status = text('status');
    const gender = text('gender');
    const payload: Record<string, unknown> = {
      employeeCode: optional(text('employeeCode')),
      firstName: text('firstName'),
      lastName: text('lastName'),
      secondLastName: optional(text('secondLastName')),
      preferredName: optional(text('preferredName')),
      documentType: optional(text('documentType').toUpperCase()) ?? 'CC',
      documentNumber: text('documentNumber').replace(/\.0+$/, ''),
      email: text('email').toLowerCase(),
      personalEmail: optional(text('personalEmail').toLowerCase()),
      phone: optional(text('phone')),
      mobile: optional(text('mobile')),
      birthDate: optional(toIsoDate(text('birthDate'))),
      gender: optional(GENDER_ALIASES[normalizeText(gender)] ?? gender.toLowerCase()),
      nationality: optional(text('nationality')),
      address: optional(text('address')),
      city: optional(text('city')),
      hiredAt: toIsoDate(text('hiredAt')),
      status: optional(STATUS_ALIASES[normalizeText(status)] ?? status.toLowerCase()),
    };

    // Catalog references: the raw payload may carry the id directly (JSON
    // rows from the API) or the name/code typed in the spreadsheet.
    const references: Array<[string, string, string, CatalogEntry[]]> = [
      ['positionId', 'position', 'Cargo', catalogs.positions],
      ['departmentId', 'department', 'Area', catalogs.departments],
      ['locationId', 'location', 'Sede', catalogs.locations],
      ['costCenterId', 'costCenter', 'Centro de costo', catalogs.costCenters],
    ];
    for (const [idKey, nameKey, label, entries] of references) {
      const value = text(idKey) || text(nameKey);
      if (!value) continue;
      const match = this.findCatalogEntry(entries, value);
      if (!match) errors.push(`${label} "${value}" no existe`);
      else payload[idKey] = match.id;
    }

    const manager = text('managerId') || text('manager');
    if (manager) {
      const wanted = manager.toLowerCase();
      const match = catalogs.employees.find(
        (employee) =>
          employee.id === manager ||
          employee.email.toLowerCase() === wanted ||
          employee.employeeCode.toLowerCase() === wanted ||
          employee.documentNumber === manager,
      );
      if (!match) errors.push(`Jefe "${manager}" no existe`);
      else payload.managerId = match.id;
    }

    return { payload, errors };
  }

  private findCatalogEntry(entries: CatalogEntry[], value: string): CatalogEntry | undefined {
    if (uuid.safeParse(value).success) return entries.find((entry) => entry.id === value);
    const wanted = normalizeText(value);
    return entries.find(
      (entry) =>
        normalizeText(entry.name) === wanted ||
        (entry.code ? normalizeText(entry.code) === wanted : false),
    );
  }

  private findExisting(payload: Record<string, unknown>, catalogs: ImportCatalogs) {
    const document = String(payload.documentNumber ?? '');
    const email = String(payload.email ?? '').toLowerCase();
    return catalogs.employees.find(
      (employee) =>
        (document && employee.documentNumber === document) ||
        (email && employee.email.toLowerCase() === email),
    );
  }

  private async loadCatalogs(companyId: string): Promise<ImportCatalogs> {
    const db = this.prisma.forCompany(companyId);
    const [positions, departments, locations, costCenters, employees] = await Promise.all([
      db.position.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      db.department.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      db.location.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      db.costCenter.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      db.employee.findMany({
        where: { deletedAt: null },
        select: { id: true, email: true, employeeCode: true, documentNumber: true },
      }),
    ]);
    return { positions, departments, locations, costCenters, employees };
  }

  private async readStoredFile(storageKey: string): Promise<Buffer> {
    if (this.storage.isLocal) return this.storage.readBuffer(storageKey);
    // S3/MinIO: the backend never streams uploads, so it fetches the object
    // through the same short-lived signed URL the browser would use.
    const url = await this.storage.presignDownload(storageKey, 300);
    const response = await fetch(url);
    if (!response.ok) throw BusinessException.validation('No fue posible leer el archivo subido');
    return Buffer.from(await response.arrayBuffer());
  }

  private newWorkbook(): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TALENTO';
    workbook.created = new Date();
    return workbook;
  }

  private styleHeader(sheet: ExcelJS.Worksheet): void {
    const header = sheet.getRow(1);
    header.font = { bold: true };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    header.alignment = { vertical: 'middle' };
  }

  private async toBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
    const out = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
  }
}
