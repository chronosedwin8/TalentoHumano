import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

/**
 * Column level encryption for sensitive data (salary, bank details, health,
 * disciplinary and ethics content).
 *
 * AES-256-GCM at the application layer instead of pgcrypto round-trips: values
 * stay opaque in backups and replicas, and Prisma keeps working with plain
 * string columns. See docs/DECISIONS.md (ADR-0003).
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const raw = this.config.get<string>('env.ENCRYPTION_KEY') ?? '';
    this.key = EncryptionService.deriveKey(raw);
  }

  static deriveKey(raw: string): Buffer {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
    const asBase64 = Buffer.from(raw, 'base64');
    if (asBase64.length === 32) return asBase64;
    // Any other secret is stretched deterministically to 32 bytes.
    return createHash('sha256').update(raw, 'utf8').digest();
  }

  encrypt(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') return null;
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString('base64');
  }

  decrypt(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (!value.startsWith(PREFIX)) return value; // legacy / plain value
    try {
      const payload = Buffer.from(value.slice(PREFIX.length), 'base64');
      const iv = payload.subarray(0, 12);
      const tag = payload.subarray(12, 28);
      const ciphertext = payload.subarray(28);
      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch {
      this.logger.error('Could not decrypt a sensitive value');
      return null;
    }
  }

  encryptNumber(value: number | null | undefined): string | null {
    return value === null || value === undefined ? null : this.encrypt(String(value));
  }

  decryptNumber(value: string | null | undefined): number | null {
    const plain = this.decrypt(value);
    if (plain === null) return null;
    const n = Number(plain);
    return Number.isFinite(n) ? n : null;
  }

  /** Encrypts every listed key of an object, in place-safe fashion. */
  encryptFields<T extends Record<string, any>>(input: T, fields: (keyof T)[]): T {
    const out = { ...input };
    for (const field of fields) {
      const v = out[field];
      if (typeof v === 'string') out[field] = this.encrypt(v) as T[keyof T];
      else if (typeof v === 'number') out[field] = this.encryptNumber(v) as T[keyof T];
    }
    return out;
  }

  decryptFields<T extends Record<string, any>>(input: T, fields: (keyof T)[]): T {
    const out = { ...input };
    for (const field of fields) {
      const v = out[field];
      if (typeof v === 'string') out[field] = this.decrypt(v) as T[keyof T];
    }
    return out;
  }

  /** Replaces every listed key with null; used when the caller lacks access. */
  static maskFields<T extends Record<string, any>>(input: T, fields: (keyof T)[]): T {
    const out = { ...input };
    for (const field of fields) out[field] = null as T[keyof T];
    return out;
  }

  hash(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  randomToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }
}
