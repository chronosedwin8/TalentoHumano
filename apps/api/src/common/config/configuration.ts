import { z } from 'zod';

const bool = (def: boolean) =>
  z
    .union([z.boolean(), z.string()])
    .default(def)
    .transform((v) =>
      typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()),
    );

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(3000),
  API_PREFIX: z.string().default('api'),
  APP_NAME: z.string().default('TALENTO'),
  WEB_URL: z.string().default('http://localhost:5173'),
  API_URL: z.string().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatorio'),
  DATABASE_URL_TEST: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  ENCRYPTION_KEY: z.string().min(32),
  COOKIE_SECRET: z.string().min(8).default('talento-cookie-secret'),
  COOKIE_DOMAIN: z.string().optional().default(''),
  COOKIE_SECURE: bool(false),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().int().default(5),
  LOCKOUT_MINUTES: z.coerce.number().int().default(15),
  THROTTLE_TTL: z.coerce.number().int().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().default(300),
  /**
   * Per minute, per IP limits for signing in and rotating a session.
   * Brute force is stopped per account; these limits only smooth out traffic,
   * and a whole office shares one public address, so they must be tunable.
   */
  AUTH_LOGIN_LIMIT: z.coerce.number().int().default(60),
  AUTH_REFRESH_LIMIT: z.coerce.number().int().default(120),

  REDIS_ENABLED: bool(false),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  /** Whether this process consumes the BullMQ queues (see main.ts / worker.ts). */
  QUEUE_WORKERS: bool(true),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./storage'),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('talento'),
  S3_ACCESS_KEY: z.string().optional().default(''),
  S3_SECRET_KEY: z.string().optional().default(''),
  S3_FORCE_PATH_STYLE: bool(true),
  MAX_UPLOAD_MB: z.coerce.number().int().default(50),

  MAIL_DRIVER: z.enum(['log', 'smtp']).default('log'),
  MAIL_FROM: z.string().default('TALENTO <no-reply@talento.local>'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: bool(false),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),

  SSO_GOOGLE_ENABLED: bool(false),
  SSO_GOOGLE_CLIENT_ID: z.string().optional().default(''),
  SSO_GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  SSO_MICROSOFT_ENABLED: bool(false),
  SSO_MICROSOFT_CLIENT_ID: z.string().optional().default(''),
  SSO_MICROSOFT_CLIENT_SECRET: z.string().optional().default(''),
  SSO_MICROSOFT_TENANT: z.string().default('common'),

  LOG_LEVEL: z.string().default('info'),
  /** OpenAPI UI is always on outside production; opt in there. */
  SWAGGER_ENABLED: bool(false),
  SENTRY_DSN: z.string().optional().default(''),
  METRICS_ENABLED: bool(true),

  CANDIDATE_RETENTION_MONTHS: z.coerce.number().int().default(12),
  AUDIT_RETENTION_MONTHS: z.coerce.number().int().default(60),
  DEMO_PASSWORD: z.string().default('Demo1234!'),
});

export type Env = z.infer<typeof envSchema>;

const DEFAULT_COOKIE_SECRET = 'talento-cookie-secret';

/**
 * Values that are fine on a laptop but must never reach a server. The
 * schema defaults keep local setup short; production has to be explicit.
 */
function productionIssues(env: Env): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const issues: string[] = [];
  if (env.COOKIE_SECRET === DEFAULT_COOKIE_SECRET) {
    issues.push('COOKIE_SECRET: debe definirse en produccion');
  }
  if (/change-me/i.test(env.JWT_ACCESS_SECRET) || /change-me/i.test(env.JWT_REFRESH_SECRET)) {
    issues.push('JWT_ACCESS_SECRET / JWT_REFRESH_SECRET: reemplace los valores de ejemplo');
  }
  if (/^0123456789abcdef/.test(env.ENCRYPTION_KEY)) {
    issues.push('ENCRYPTION_KEY: reemplace la clave de ejemplo');
  }
  if (!env.COOKIE_SECURE) {
    issues.push('COOKIE_SECURE: debe ser true en produccion (la sesion viaja por HTTPS)');
  }
  return issues;
}

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuracion de entorno invalida:\n${details}`);
  }
  const issues = productionIssues(parsed.data);
  if (issues.length) {
    throw new Error(
      `Configuracion insegura para produccion:\n${issues.map((i) => `  - ${i}`).join('\n')}`,
    );
  }
  return parsed.data;
}

export default (): { env: Env } => ({ env: validateEnv(process.env) });
