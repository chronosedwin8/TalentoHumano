# TALENTO

Plataforma de gestion de talento humano: HRIS, seleccion, onboarding, ausencias,
tiempo, formacion, desempeno, cultura, encuestas, canal de denuncias, documentos,
servicio al colaborador, seguridad y salud en el trabajo, y analitica.

> **La plataforma no liquida nomina.** Registra novedades, las clasifica y las
> exporta para que las procese el sistema contable. No calcula salarios,
> liquidaciones, prestaciones ni aportes, y no lleva contabilidad. Todo dato
> economico que se guarda es informativo y se muestra cifrado en reposo.

## Que hay aqui

| | |
|---|---|
| Monorepo | pnpm workspaces: `apps/api`, `apps/web`, `packages/shared` |
| API | NestJS 10 · Prisma 6 · PostgreSQL 17 · 421 endpoints |
| Web | React 18 · Vite 6 · Tailwind · TanStack Query · PWA |
| Modelo de datos | 211 tablas, multiempresa desde el primer dia |
| Permisos | 308 permisos `modulo.recurso.accion` · 11 roles · 4 alcances de datos |
| Pruebas | 182 unitarias · 106 e2e de API · 58 flujos de navegador |

## Puesta en marcha

Necesita Node 22, pnpm 9 y PostgreSQL 17 (o Docker para levantarlo).

```bash
git clone https://github.com/chronosedwin8/TalentoHumano.git
cd TalentoHumano
pnpm install
cp .env.example .env          # ponga su usuario y clave de PostgreSQL en
                              # DATABASE_URL, y genere las llaves de seguridad

# Opcional: base de datos, cache y capturador de correo en contenedores
docker compose -f infra/docker-compose.yml up -d

pnpm --filter @talento/shared build
pnpm db:migrate               # crea el esquema
pnpm seed                     # catalogos base y roles del sistema
pnpm seed:demo                # empresa de demostracion con datos realistas

pnpm dev                      # API en :3000, aplicacion web en :5173
```

La API documenta su contrato en `http://localhost:3000/api/docs`.

### Cuentas de demostracion

Todas usan la contrasena de `DEMO_PASSWORD` (por defecto `Demo1234!`).

| Usuario | Rol | Para ver |
|---|---|---|
| `admin@demo.com` | Administrador de empresa | Configuracion, roles, auditoria |
| `hr@demo.com` | Talento humano | Personal, ausencias, seleccion, documentos |
| `manager@demo.com` | Jefe de area | Su equipo y sus aprobaciones |
| `empleado@demo.com` | Colaborador | Portal de autoservicio |
| `etica@demo.com` | Oficial de etica | Canal de denuncias |

Portales publicos, sin sesion: `/careers/demo`, `/ethics/demo`,
`/ethics-seguimiento`, `/verificar/{codigo}`.

## Comandos

```bash
pnpm dev                 # API y web en paralelo
pnpm build               # compila los tres paquetes
pnpm lint                # ESLint sin advertencias permitidas
pnpm typecheck           # TypeScript estricto en todo el monorepo
pnpm test                # pruebas unitarias
pnpm --filter @talento/api run admin:create -- --email correo --password clave --name "Nombre"   # cuenta con acceso total
pnpm test:cov            # unitarias con umbral de cobertura
pnpm test:e2e            # e2e de la API contra PostgreSQL real
pnpm test:browser        # flujos de navegador (Playwright)
pnpm db:studio           # explorador de la base de datos
```

## Documentacion

| Documento | Contenido |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Como esta construido y por que |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Decisiones tecnicas con su contexto (ADR) |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Modelo de datos por modulo |
| [docs/API.md](docs/API.md) | Convenciones de la API y catalogo de endpoints |
| [docs/SECURITY.md](docs/SECURITY.md) | Permisos, cifrado, auditoria y Habeas Data |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Despliegue, respaldos y restauracion |
| [docs/TESTING.md](docs/TESTING.md) | Estrategia de pruebas |
| [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) | Criterios de aceptacion y su verificacion |
| [docs/MODULES/](docs/MODULES/) | Un documento por modulo funcional |
| [CHANGELOG.md](CHANGELOG.md) | Historial de cambios |

## Estructura

```
apps/
  api/            NestJS: controladores, servicios, Prisma, migraciones, semillas
  web/            React: paginas por modulo, componentes, flujos de navegador
packages/
  shared/         Contrato comun: permisos, roles, esquemas Zod, utilidades
infra/            Docker, nginx y scripts de operacion
docs/             Documentacion tecnica y funcional
```

## Licencia

Software propietario. Todos los derechos reservados.
