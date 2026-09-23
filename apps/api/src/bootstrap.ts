import { VersioningType, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import helmet from 'helmet';

/**
 * Middleware, prefix, versioning and CORS shared by the server and the e2e
 * tests, so the tests exercise the same request pipeline that ships.
 */
export function configureApp(app: INestApplication): INestApplication {
  const config = app.get(ConfigService);
  const prefix = config.get<string>('env.API_PREFIX') ?? 'api';

  app.setGlobalPrefix(prefix, { exclude: ['health', 'metrics'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser(config.get<string>('env.COOKIE_SECRET')));
  // Raw uploads go through the local storage driver, which streams the request.
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  const origins = (config.get<string>('env.CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.length ? origins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['Content-Disposition'],
  });

  return app;
}
