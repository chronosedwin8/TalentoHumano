import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

/**
 * Read load test over the four heaviest paginated listings of the product
 * (people, leaves, recruiting, helpdesk). Read-only: it never writes.
 *
 * Every listing goes through `listPaged`/`paged`, which runs a `findMany` plus
 * a `count` against the same filter, so the four endpoints stress the same
 * pagination path with different joins. That is what makes them comparable and
 * worth measuring side by side.
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API = `${BASE_URL}/api/v1`;

// The listings need company-wide scope. `hr_admin` is the only demo role whose
// permission patterns (`people.*`, `leaves.*`, `recruiting.*`, `helpdesk.*`)
// cover all four at once; a collaborator would only see its own rows and the
// measurement would not reflect the real query cost.
const USER_EMAIL = __ENV.LOAD_USER || 'hr@demo.com';
const USER_PASSWORD = __ENV.DEMO_PASSWORD || 'Demo1234!';

// Matches PAGINATION.DEFAULT_LIMIT in packages/shared: measuring another page
// size would not describe what the UI actually asks for.
const PAGE_SIZE = 25;

// Rotating over the first pages keeps the database from answering every single
// request from the exact same cached page, without walking off the end of the
// seeded demo data (which is small).
const MAX_PAGE = 3;

const employeesTrend = new Trend('listado_colaboradores', true);
const leavesTrend = new Trend('listado_ausencias', true);
const candidatesTrend = new Trend('listado_candidatos', true);
const ticketsTrend = new Trend('listado_tickets', true);

// The API applies a global per-IP throttle (THROTTLE_LIMIT, 300 req/min by
// default). Every VU shares one source IP, so a run against an unraised limit
// degenerates into a 429 benchmark. Tracking it separately turns that into an
// explicit, self-explaining failure instead of a wall of unexplained errors.
const rateLimited = new Rate('respuestas_429');

// Default k6 behaviour marks any status outside 200-399 as a failed request,
// which would silently absorb a 3xx. These listings only ever answer 200, so
// anything else has to count against `http_req_failed`.
http.setResponseCallback(http.expectedStatuses(200));

export const options = {
  scenarios: {
    listados: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // Ramp instead of a step start: a cold start would measure Prisma's
        // connection pool warming up, not the steady-state latency we care about.
        { duration: '30s', target: 20 },
        { duration: '60s', target: 20 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // Paginated listing on seeded demo data: a `findMany` + `count` with a few
    // joins should stay well inside the 1s mark where a UI list starts feeling slow.
    http_req_duration: ['p(95)<800'],
    // Nothing here is expected to fail: these are plain reads with a valid
    // token. 1% leaves room for the odd connection hiccup and no more.
    http_req_failed: ['rate<0.01'],
    // Guards against the case where requests succeed at the HTTP level but the
    // body is not the `{ data, meta }` envelope the clients expect.
    checks: ['rate>0.99'],
    // Any 429 means the throttle was not raised for the run, so the numbers
    // above describe the rate limiter rather than the API.
    respuestas_429: ['rate==0'],
    // Per-endpoint budgets. People and leaves are the ones the whole company
    // opens every morning, so they get the tightest budget. Candidates and
    // tickets carry more joins (tags + application counts, category +
    // requester + assignee) and are used by smaller teams, hence more room.
    listado_colaboradores: ['p(95)<800'],
    listado_ausencias: ['p(95)<800'],
    listado_candidatos: ['p(95)<900'],
    listado_tickets: ['p(95)<900'],
  },
};

/**
 * Logs in once for the whole test and hands the token to every VU.
 *
 * `POST /auth/login` is throttled to 60 requests per minute per IP and hashing
 * a password is deliberately expensive, so logging in per iteration would both
 * lock the test out and time the hash instead of the listings.
 */
export function setup() {
  const res = http.post(
    `${API}/auth/login`,
    JSON.stringify({ email: USER_EMAIL, password: USER_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth/login' } },
  );

  if (res.status !== 200) {
    throw new Error(
      `Login fallido (${res.status}) para ${USER_EMAIL}. ` +
        'Verifique que la API este arriba y que la semilla demo se haya ejecutado.',
    );
  }

  // Responses are wrapped by TransformInterceptor into `{ data, meta }`.
  return { token: res.json('data.accessToken') };
}

export default function (data) {
  const params = {
    headers: {
      Authorization: `Bearer ${data.token}`,
      'Content-Type': 'application/json',
    },
  };

  const page = (__ITER % MAX_PAGE) + 1;
  const query = `?page=${page}&limit=${PAGE_SIZE}`;

  // Sequential rather than http.batch: the batch would fire four requests from
  // one VU at once, which inflates the apparent concurrency and makes the
  // per-endpoint timings reflect queueing instead of the query itself.
  measure('people/employees', `${API}/people/employees${query}`, params, employeesTrend);
  measure('leaves/requests', `${API}/leaves/requests${query}`, params, leavesTrend);
  measure('recruiting/candidates', `${API}/recruiting/candidates${query}`, params, candidatesTrend);
  measure('helpdesk/tickets', `${API}/helpdesk/tickets${query}`, params, ticketsTrend);

  // A real user reads the list before asking for the next one. Without this
  // pause 20 VUs would behave like a few hundred, and the run would measure
  // saturation rather than the latency under the load we claim to apply.
  sleep(1);
}

/**
 * Issues one listing request, records its duration under its own metric and
 * checks both the status and the response envelope.
 *
 * `tags.name` is set explicitly so k6 groups the request under a stable label
 * instead of one bucket per `?page=` value.
 */
function measure(name, url, params, trend) {
  const res = http.get(url, { ...params, tags: { name } });

  trend.add(res.timings.duration);
  rateLimited.add(res.status === 429);

  check(res, {
    [`${name}: status 200`]: (r) => r.status === 200,
    [`${name}: trae data`]: (r) => {
      const body = safeJson(r);
      return body !== null && Array.isArray(body.data);
    },
  });
}

/** A timeout or a non-JSON error page must fail the check, never the script. */
function safeJson(res) {
  try {
    return res.json();
  } catch (error) {
    return null;
  }
}
