# Estrategia de pruebas

## El criterio

Cada prueba responde a una pregunta: **si esto se rompe, quien se entera y
cuando**. Lo que puede regresar en silencio —permisos, calendario, cifrado— se
prueba con umbral de cobertura. Lo que solo se puede afirmar contra la base de
datos real se prueba por comportamiento.

| Nivel | Cantidad | Contra que corre | Comando |
|---|---|---|---|
| Unitarias | 177 | Nada externo | `pnpm test` |
| e2e de API | 76 | PostgreSQL real, aplicacion Nest completa | `pnpm test:e2e` |
| Navegador | 34 | Pila completa, Chromium y movil | `pnpm test:browser` |

## Unitarias

### `packages/shared` (95)

El contrato que comparten la API y la web.

- **Permisos.** Forma de los codigos, ausencia de duplicados, y sobre todo el
  comportamiento de los comodines. Hay una prueba de regresion explicita para el
  caso que rompio el sistema una vez: `people.*` debe alcanzar
  `people.employee.read`, que tiene tres segmentos.
- **Roles.** Que cada rol expanda a permisos reales, que el colaborador no
  alcance datos sensibles de terceros, que el auditor pueda leer y no borrar.
- **Calendario colombiano.** Los 18 festivos, el calculo de pascua, el traslado
  al lunes de la Ley Emiliani, y el caso de 2025 y 2030, donde San Pedro y el
  Sagrado Corazon caen el mismo lunes y el ano tiene 17 dias libres.
- **Causacion de vacaciones.** 15 dias habiles por ano, prorrateo por ingreso y
  retiro, y que nunca se cause hacia el futuro.

Cobertura: 98.6% de lineas, 95% de funciones. Umbral: 80%.

### `apps/api` (50)

- **Cifrado de columnas.** Ida y vuelta, nonce distinto por valor, deteccion de
  alteracion, rechazo con otra llave, enmascarado de campos. Cobertura 100%.
- **Condiciones de aprobacion.** Cada operador, y el escalamiento tipico: el
  jefe aprueba siempre, talento humano entra solo si la ausencia supera diez
  dias.

### `apps/web` (32)

- **Lista blanca de embebidos.** Que `youtube.com.atacante.net` no pase, que
  `javascript:` no pase, que un subdominio legitimo si.
- **Paleta de graficas.** Que los tonos no se repitan, que el modo oscuro no sea
  una copia del claro, que los colores de estado no aparezcan en el orden
  categorico, y que la cola se pliegue en "Otros" conservando el total.

## e2e de API

Levantan la aplicacion Nest completa con el mismo `configureApp` que usa
`main.ts`, y hablan HTTP contra un PostgreSQL real sembrado con la empresa de
demostracion.

| Archivo | Verifica |
|---|---|
| `access-control.e2e.spec.ts` | Autenticacion, permisos por rol, **aislamiento entre empresas** |
| `leaves.e2e.spec.ts` | Saldos, solicitudes, solapamiento, limites, alcance de datos |
| `ethics.e2e.spec.ts` | **Anonimato de extremo a extremo**, cifrado, seguimiento |
| `recruiting.e2e.spec.ts` | Portal publico, postulacion, llegada al pipeline |

Algunas afirmaciones no se pueden hacer desde HTTP, asi que estas pruebas
consultan la base de datos directamente. Por ejemplo, la suite de denuncias
verifica que `ethics_reports` **no tenga columnas** de IP ni dispositivo, que el
contenido guardado empiece por `enc:v1:` y que no exista fila de auditoria que
apunte al reporte.

## Navegador

Playwright, dos proyectos: `chromium` de escritorio y `mobile` (Pixel 7) para el
portal del colaborador.

| Archivo | Flujo |
|---|---|
| `auth.spec.ts` | Ingreso, credenciales invalidas, sesion tras recarga, menu segun rol |
| `ethics-portal.spec.ts` | **Denuncia anonima, codigo, seguimiento y mensaje** |
| `careers.spec.ts` | Postulacion publica completa y llegada al pipeline |
| `portal.spec.ts` | Autoservicio, modulos ocultos, y en movil menu y desbordamiento |

### Lo que encontraron

No eran fallos de las pruebas: eran defectos reales que ninguna prueba de API
habria visto.

1. **`Button asChild` rompia la pagina.** El componente pasaba el indicador de
   carga junto al hijo, y `Slot` de Radix exige exactamente un hijo. Cada
   `<Button asChild><Link>` de la aplicacion reventaba con una pantalla de error.
2. **Las etiquetas no estaban asociadas a sus campos.** `Field` no generaba
   identificador, asi que un lector de pantalla no anunciaba la etiqueta y
   pulsar sobre ella no enfocaba el campo.
3. **El asterisco de campo obligatorio se leia en voz alta.** Ahora es
   decorativo y la obligatoriedad viaja en `aria-required`.
4. **El limite de refresco cerraba la sesion al recargar.** 30 refrescos por
   minuto por IP se agotan con uso normal detras de un NAT.
5. **El limite de ingreso habria bloqueado una oficina entera** un lunes por la
   manana.

## Cobertura

```bash
pnpm test:cov
```

El umbral cubre logica pura: permisos, roles, utilidades de dominio y cifrado.
No cubre servicios ni controladores, porque una prueba de servicio con un doble
de Prisma prueba el doble ([ADR-0010](DECISIONS.md#adr-0010)).

## Requisitos para correrlas

```bash
# Unitarias: nada.
pnpm test

# e2e de API y navegador: base de datos migrada y sembrada.
pnpm db:migrate && pnpm seed && pnpm seed:demo
pnpm test:e2e

# Navegador: ademas la API arriba.
pnpm dev:api
pnpm test:browser
```

Las pruebas e2e escriben en la base de datos de demostracion. No se ejecutan
contra produccion.

## En integracion continua

`.github/workflows/ci.yml` corre cuatro trabajos: tipos y unitarias; e2e de API
con PostgreSQL de servicio; flujos de navegador con la pila levantada; y
construccion de las imagenes. El despliegue solo ocurre en `main` y si los
cuatro pasan.
