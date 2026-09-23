import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { EncryptionService } from '../../src/common/crypto/encryption.service';

/** Builds the service with a fixed key so the assertions are deterministic. */
function makeService(key = 'a'.repeat(64)): EncryptionService {
  const config = { get: (path: string) => (path === 'env.ENCRYPTION_KEY' ? key : undefined) };
  return new EncryptionService(config as unknown as ConfigService);
}

describe('derivacion de la llave', () => {
  it('acepta una llave hexadecimal de 32 bytes', () => {
    expect(EncryptionService.deriveKey('b'.repeat(64))).toHaveLength(32);
  });

  it('acepta una llave en base64 de 32 bytes', () => {
    const base64 = Buffer.alloc(32, 9).toString('base64');
    expect(EncryptionService.deriveKey(base64)).toHaveLength(32);
  });

  it('estira cualquier otro secreto a 32 bytes de forma determinista', () => {
    const first = EncryptionService.deriveKey('clave-corta');
    const second = EncryptionService.deriveKey('clave-corta');
    expect(first).toHaveLength(32);
    expect(first.equals(second)).toBe(true);
  });

  it('secretos distintos producen llaves distintas', () => {
    expect(EncryptionService.deriveKey('uno').equals(EncryptionService.deriveKey('dos'))).toBe(
      false,
    );
  });
});

describe('cifrado de columnas sensibles', () => {
  const service = makeService();

  it('devuelve el valor original al descifrar', () => {
    const plain = 'Salario base 4500000';
    const encrypted = service.encrypt(plain);
    expect(encrypted).not.toBe(plain);
    expect(service.decrypt(encrypted)).toBe(plain);
  });

  it('marca el texto cifrado con el prefijo de version', () => {
    expect(service.encrypt('dato')).toMatch(/^enc:v1:/);
  });

  it('nunca deja el texto plano visible en el cifrado', () => {
    const encrypted = service.encrypt('Diagnostico medico reservado') ?? '';
    expect(encrypted).not.toContain('Diagnostico');
    expect(encrypted).not.toContain('medico');
  });

  it('usa un nonce distinto en cada cifrado del mismo valor', () => {
    // Sin esto, dos empleados con el mismo salario tendrian el mismo cifrado
    // y el dato se podria inferir por comparacion.
    const a = service.encrypt('4500000');
    const b = service.encrypt('4500000');
    expect(a).not.toBe(b);
    expect(service.decrypt(a)).toBe('4500000');
    expect(service.decrypt(b)).toBe('4500000');
  });

  it('propaga null y undefined sin cifrar', () => {
    expect(service.encrypt(null)).toBeNull();
    expect(service.encrypt(undefined)).toBeNull();
    expect(service.decrypt(null)).toBeNull();
    expect(service.decrypt(undefined)).toBeNull();
  });

  it('descifra sin cambios un valor que nunca se cifro', () => {
    // Tolera datos migrados antes de activar el cifrado.
    expect(service.decrypt('texto plano heredado')).toBe('texto plano heredado');
  });

  it('conserva acentos, enies y emojis', () => {
    const plain = 'Incapacidad médica — niño 👶 / 3 días';
    expect(service.decrypt(service.encrypt(plain))).toBe(plain);
  });

  it('conserva cadenas largas', () => {
    const plain = 'x'.repeat(20_000);
    expect(service.decrypt(service.encrypt(plain))).toBe(plain);
  });

  it('trata la cadena vacia como ausencia de dato', () => {
    // Las columnas sensibles son opcionales: un campo vacio se guarda como
    // NULL en vez de como un cifrado de cero bytes.
    expect(service.encrypt('')).toBeNull();
    expect(service.decrypt('')).toBeNull();
  });

  it('no descifra con otra llave', () => {
    const encrypted = makeService('a'.repeat(64)).encrypt('secreto');
    const other = makeService('c'.repeat(64));
    // GCM detecta la manipulacion: devuelve null en vez de basura.
    expect(other.decrypt(encrypted)).toBeNull();
  });

  it('detecta un texto cifrado alterado', () => {
    const encrypted = service.encrypt('valor integro') ?? '';
    const tampered = encrypted.slice(0, -4) + 'AAAA';
    expect(service.decrypt(tampered)).toBeNull();
  });
});

describe('cifrado de valores numericos', () => {
  const service = makeService();

  it('devuelve el numero original', () => {
    expect(service.decryptNumber(service.encryptNumber(4500000))).toBe(4500000);
  });

  it('conserva decimales', () => {
    expect(service.decryptNumber(service.encryptNumber(1234.56))).toBeCloseTo(1234.56, 2);
  });

  it('conserva el cero y no lo confunde con ausencia de dato', () => {
    expect(service.decryptNumber(service.encryptNumber(0))).toBe(0);
  });

  it('propaga null', () => {
    expect(service.encryptNumber(null)).toBeNull();
    expect(service.decryptNumber(null)).toBeNull();
  });
});

describe('cifrado por campos de un registro', () => {
  const service = makeService();
  const FIELDS = ['baseSalary', 'bankAccount'] as const;

  it('cifra solo los campos indicados', () => {
    const employee = { fullName: 'Ana Perez', baseSalary: 4500000, bankAccount: '123456789' };
    const encrypted = service.encryptFields(employee, [...FIELDS]);
    expect(encrypted.fullName).toBe('Ana Perez');
    expect(String(encrypted.baseSalary)).toMatch(/^enc:v1:/);
    expect(String(encrypted.bankAccount)).toMatch(/^enc:v1:/);
  });

  it('no muta el objeto original', () => {
    const employee = { baseSalary: 4500000 };
    service.encryptFields(employee, ['baseSalary']);
    expect(employee.baseSalary).toBe(4500000);
  });

  it('descifrar deshace el cifrado por campos', () => {
    const employee = { fullName: 'Ana Perez', bankAccount: '123456789' };
    const roundTrip = service.decryptFields(service.encryptFields(employee, ['bankAccount']), [
      'bankAccount',
    ]);
    expect(roundTrip.bankAccount).toBe('123456789');
    expect(roundTrip.fullName).toBe('Ana Perez');
  });

  it('ignora los campos ausentes o nulos', () => {
    const encrypted = service.encryptFields({ baseSalary: null, other: 1 }, ['baseSalary']);
    expect(encrypted.baseSalary).toBeNull();
  });

  it('enmascara los campos cuando el usuario no tiene acceso', () => {
    const employee = { fullName: 'Ana Perez', baseSalary: 4500000, bankAccount: '123456789' };
    const masked = EncryptionService.maskFields(employee, [...FIELDS]);
    expect(masked.fullName).toBe('Ana Perez');
    expect(masked.baseSalary).toBeNull();
    expect(masked.bankAccount).toBeNull();
  });

  it('el enmascarado no deja rastro del valor original', () => {
    const masked = EncryptionService.maskFields({ baseSalary: 4500000 }, ['baseSalary']);
    expect(JSON.stringify(masked)).not.toContain('4500000');
  });
});

describe('hash y comparacion en tiempo constante', () => {
  const service = makeService();

  it('el hash es determinista', () => {
    expect(service.hash('clave-de-seguimiento')).toBe(service.hash('clave-de-seguimiento'));
  });

  it('el hash no revela la entrada', () => {
    expect(service.hash('clave-de-seguimiento')).not.toContain('clave');
  });

  it('entradas distintas producen hashes distintos', () => {
    expect(service.hash('uno')).not.toBe(service.hash('dos'));
  });

  it('safeEqual acepta dos valores iguales', () => {
    const hash = service.hash('acceso');
    expect(service.safeEqual(hash, service.hash('acceso'))).toBe(true);
  });

  it('safeEqual rechaza valores distintos', () => {
    expect(service.safeEqual(service.hash('acceso'), service.hash('otro'))).toBe(false);
  });

  it('safeEqual no lanza cuando las longitudes difieren', () => {
    expect(service.safeEqual(service.hash('acceso'), 'corto')).toBe(false);
  });
});

describe('tokens aleatorios', () => {
  const service = makeService();

  it('genera tokens distintos', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => service.randomToken()));
    expect(tokens.size).toBe(200);
  });

  it('respeta la longitud pedida', () => {
    expect(service.randomToken(16).length).toBeGreaterThanOrEqual(16);
  });
});
