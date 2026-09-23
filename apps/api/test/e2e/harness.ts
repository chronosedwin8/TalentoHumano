import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap';

export const API = '/api/v1';

let app: INestApplication | null = null;

/** Boots the application once for the whole e2e run. */
export async function getApp(): Promise<INestApplication> {
  if (app) return app;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = configureApp(moduleRef.createNestApplication());
  await app.init();
  return app;
}

export async function closeApp(): Promise<void> {
  await app?.close();
  app = null;
}

export interface Session {
  token: string;
  user: {
    id: string;
    email: string;
    permissions: Array<{ code: string; scope: string }>;
    modules: string[];
    company: { id: string; slug: string; name: string } | null;
    employee: { id: string } | null;
  };
}

/** Signs in a demo user and returns its access token plus session payload. */
export async function login(
  email: string,
  password = process.env.DEMO_PASSWORD ?? 'Demo1234!',
): Promise<Session> {
  const server = (await getApp()).getHttpServer();
  const response = await request(server).post(`${API}/auth/login`).send({ email, password });
  if (response.status !== 200 && response.status !== 201) {
    throw new Error(
      `login de ${email} fallo con ${response.status}: ${response.text.slice(0, 200)}`,
    );
  }
  const data = response.body.data;
  return { token: data.accessToken, user: data.user };
}

/** Authenticated supertest agent for a session. */
export async function as(session: Session) {
  const server = (await getApp()).getHttpServer();
  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${session.token}`);
  return {
    get: (path: string) => auth(request(server).get(API + path)),
    post: (path: string, body?: unknown) => auth(request(server).post(API + path)).send(body ?? {}),
    patch: (path: string, body?: unknown) =>
      auth(request(server).patch(API + path)).send(body ?? {}),
    delete: (path: string) => auth(request(server).delete(API + path)),
  };
}

/** Unauthenticated agent, for the public portals. */
export async function anonymous() {
  const server = (await getApp()).getHttpServer();
  return {
    get: (path: string) => request(server).get(API + path),
    post: (path: string, body?: unknown) =>
      request(server)
        .post(API + path)
        .send(body ?? {}),
  };
}

/** Accounts created by `prisma/seed-demo.ts`. */
export const DEMO = {
  admin: 'admin@demo.com',
  hr: 'hr@demo.com',
  manager: 'manager@demo.com',
  employee: 'empleado@demo.com',
  ethics: 'etica@demo.com',
};
