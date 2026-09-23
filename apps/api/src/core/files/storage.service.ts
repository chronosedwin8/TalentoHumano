import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm, stat, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Readable } from 'node:stream';

export interface PresignedUpload {
  /** Where the browser must PUT the bytes. */
  url: string;
  method: 'PUT' | 'POST';
  headers: Record<string, string>;
  storageKey: string;
  expiresIn: number;
}

/**
 * File storage with two drivers:
 *  - `local`: bytes on disk, download links signed with an HMAC token and
 *    served by the files controller (development and small self-hosted setups).
 *  - `s3`: pre-signed S3/MinIO URLs generated with SigV4 query signing, so the
 *    backend never streams file content.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: 'local' | 's3';
  private readonly root: string;
  private readonly signingSecret: string;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get<'local' | 's3'>('env.STORAGE_DRIVER') ?? 'local';
    this.root = resolve(this.config.get<string>('env.STORAGE_LOCAL_PATH') ?? './storage');
    this.signingSecret = this.config.get<string>('env.COOKIE_SECRET') ?? 'talento';
  }

  get isLocal(): boolean {
    return this.driver === 'local';
  }

  buildKey(companyId: string | null, filename: string): string {
    const safe = filename.replace(/[^\w.-]+/g, '_').slice(-120);
    const now = new Date();
    return [
      companyId ?? 'platform',
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, '0'),
      `${randomUUID()}-${safe}`,
    ].join('/');
  }

  async presignUpload(
    storageKey: string,
    mimeType: string,
    expiresIn = 900,
  ): Promise<PresignedUpload> {
    if (this.driver === 's3') {
      return {
        url: this.signS3Url('PUT', storageKey, expiresIn),
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        storageKey,
        expiresIn,
      };
    }
    const apiUrl = this.config.get<string>('env.API_URL') ?? '';
    const prefix = this.config.get<string>('env.API_PREFIX') ?? 'api';
    const token = this.signToken(storageKey, 'put', expiresIn);
    return {
      url: `${apiUrl}/${prefix}/v1/files/upload?key=${encodeURIComponent(storageKey)}&token=${token}`,
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      storageKey,
      expiresIn,
    };
  }

  async presignDownload(storageKey: string, expiresIn = 900, filename?: string): Promise<string> {
    if (this.driver === 's3') return this.signS3Url('GET', storageKey, expiresIn);
    const apiUrl = this.config.get<string>('env.API_URL') ?? '';
    const prefix = this.config.get<string>('env.API_PREFIX') ?? 'api';
    const token = this.signToken(storageKey, 'get', expiresIn);
    const name = filename ? `&filename=${encodeURIComponent(filename)}` : '';
    return `${apiUrl}/${prefix}/v1/files/download?key=${encodeURIComponent(storageKey)}&token=${token}${name}`;
  }

  /* ----------------------------- local driver ---------------------------- */

  private localPath(storageKey: string): string {
    const full = resolve(join(this.root, storageKey));
    if (!full.startsWith(this.root)) throw new Error('Invalid file path');
    return full;
  }

  signToken(storageKey: string, action: 'get' | 'put', expiresIn: number): string {
    const expiresAt = Date.now() + expiresIn * 1000;
    const signature = createHmac('sha256', this.signingSecret)
      .update(`${action}:${storageKey}:${expiresAt}`)
      .digest('base64url');
    return `${expiresAt}.${signature}`;
  }

  verifyToken(storageKey: string, action: 'get' | 'put', token: string): boolean {
    const [expiresRaw, signature] = (token ?? '').split('.');
    const expiresAt = Number(expiresRaw);
    if (!expiresAt || Number.isNaN(expiresAt) || expiresAt < Date.now()) return false;
    const expected = createHmac('sha256', this.signingSecret)
      .update(`${action}:${storageKey}:${expiresAt}`)
      .digest('base64url');
    return expected === signature;
  }

  async writeStream(
    storageKey: string,
    stream: Readable,
  ): Promise<{ size: number; checksum: string }> {
    const target = this.localPath(storageKey);
    await mkdir(dirname(target), { recursive: true });
    const hash = createHash('sha256');
    let size = 0;
    await new Promise<void>((resolvePromise, reject) => {
      const out = createWriteStream(target);
      stream.on('data', (chunk: Buffer) => {
        size += chunk.length;
        hash.update(chunk);
      });
      stream.on('error', reject);
      out.on('error', reject);
      out.on('finish', () => resolvePromise());
      stream.pipe(out);
    });
    return { size, checksum: hash.digest('hex') };
  }

  async writeBuffer(
    storageKey: string,
    buffer: Buffer,
  ): Promise<{ size: number; checksum: string }> {
    const target = this.localPath(storageKey);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, buffer);
    return { size: buffer.length, checksum: createHash('sha256').update(buffer).digest('hex') };
  }

  readStream(storageKey: string): Readable {
    return createReadStream(this.localPath(storageKey));
  }

  async readBuffer(storageKey: string): Promise<Buffer> {
    return readFile(this.localPath(storageKey));
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await stat(this.localPath(storageKey));
      return true;
    } catch {
      return false;
    }
  }

  async remove(storageKey: string): Promise<void> {
    if (this.driver === 'local') {
      await rm(this.localPath(storageKey), { force: true });
      return;
    }
    this.logger.warn(`S3 delete still pending for ${storageKey}`);
  }

  /* ------------------------------ s3 driver ------------------------------ */

  /** Minimal SigV4 query signing; works with AWS S3 and MinIO. */
  private signS3Url(method: 'GET' | 'PUT', storageKey: string, expiresIn: number): string {
    const endpoint = (this.config.get<string>('env.S3_ENDPOINT') ?? '').replace(/\/$/, '');
    const region = this.config.get<string>('env.S3_REGION') ?? 'us-east-1';
    const bucket = this.config.get<string>('env.S3_BUCKET') ?? 'talento';
    const accessKey = this.config.get<string>('env.S3_ACCESS_KEY') ?? '';
    const secretKey = this.config.get<string>('env.S3_SECRET_KEY') ?? '';
    const pathStyle = this.config.get<boolean>('env.S3_FORCE_PATH_STYLE') ?? true;

    const host = endpoint
      ? new URL(endpoint).host
      : pathStyle
        ? `s3.${region}.amazonaws.com`
        : `${bucket}.s3.${region}.amazonaws.com`;
    const protocol = endpoint ? new URL(endpoint).protocol : 'https:';
    const canonicalUri =
      '/' +
      (pathStyle ? `${bucket}/` : '') +
      storageKey
        .split('/')
        .map((part) => encodeURIComponent(part))
        .join('/');

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;

    const params: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${accessKey}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expiresIn),
      'X-Amz-SignedHeaders': 'host',
    };
    const canonicalQuery = Object.keys(params)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&');

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQuery,
      `host:${host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const hmac = (key: Buffer | string, data: string) =>
      createHmac('sha256', key).update(data, 'utf8').digest();
    const signingKey = hmac(
      hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), 's3'),
      'aws4_request',
    );
    const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

    return `${protocol}//${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
  }
}
