import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

/**
 * Write load test over attendance clocking: `POST /time/clock` plus the
 * `GET /time/clock/today` read the kiosk does right after marking.
 *
 * This test INSERTS rows (`time_clock_entry`) and recomputes the attendance
 * day of the account it runs as. It is only safe against a local or demo
 * database. See infra/load/README.md.
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API = `${BASE_URL}/api/v1`;

// A collaborator account, because `POST /time/clock` marks the *authenticated*
// employee (`ctx.employeeId`) and rejects users with no employee attached.
const USER_EMAIL = __ENV.LOAD_USER || 'empleado@demo.com';
const USER_PASSWORD = __ENV.DEMO_PASSWORD || 'Demo1234!';

// The order TimeService.CLOCK_SEQUENCE allows: in -> break_start -> break_end
// -> out -> in. Walking the cycle keeps a useful share of the writes landing
// as real inserts instead of every one of them being rejected on sequence.
const CLOCK_CYCLE = ['in', 'break_start', 'break_end', 'out'];

const clockTrend = new Trend('marcacion_registro', true);
const todayTrend = new Trend('marcacion_consulta_dia', true);

// Writes that actually created an entry. Tracked for visibility only, with no
// threshold: with several VUs clocking the same employee, how many win the
// sequence race is not deterministic and must not decide whether a run passes.
const acceptedWrites = new Counter('marcaciones_insertadas');

// A response is "legitimate" when it is either a successful insert or one of
// the business rules rejecting it. Anything else (500, 403, timeout) is a
// real defect.
const legitimateResponse = new Rate('respuestas_legitimas');

// Same reason as in listados.js: the global per-IP throttle would otherwise
// turn the whole run into a silent 429 benchmark.
const rateLimited = new Rate('respuestas_429');

/**
 * 409 CLOCK_DUPLICATE (same type twice within a minute) and 422
 * CLOCK_SEQUENCE_INVALID (a type the previous entry does not allow) are the
 * API correctly refusing an impossible attendance record. Under concurrency
 * they are not only possible but expected, so they are declared as accepted
 * statuses: otherwise `http_req_failed` would report a broken API while the
 * API is in fact doing its job.
 */
http.setResponseCallback(http.expectedStatuses(200, 201, 409, 422));

export const options = {
  scenarios: {
    marcacion: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // Half the concurrency of the read test on purpose: each iteration
        // writes a row and recomputes an attendance day, so the same VU count
        // would put far more pressure on the database than the read test does.
        { duration: '20s', target: 10 },
        { duration: '60s', target: 10 },
        { duration: '20s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // Looser than the listings because a clock-in is not a single insert: it
    // reads the last entry of the day, inserts, recomputes the attendance day
    // and emits a domain event, all inside the request.
    marcacion_registro: ['p(95)<1200'],
    // The day query is two lookups on (companyId, employeeId, localDate) and
    // returns a handful of rows, so it must stay fast even while writes run.
    marcacion_consulta_dia: ['p(95)<500'],
    // Evaluated against the accepted statuses above, so this only catches
    // server errors and timeouts, never the legitimate business rejections.
    http_req_failed: ['rate<0.01'],
    // Every single response must be an insert or a known business rule.
    respuestas_legitimas: ['rate>0.99'],
    // Any 429 means the throttle was not raised and the timings above are
    // measuring the rate limiter.
    respuestas_429: ['rate==0'],
  },
};

/**
 * One login for the whole test, shared by every VU: `POST /auth/login` is
 * throttled to 60 requests per minute per IP and password hashing is
 * deliberately slow, so logging in per iteration would break the run and
 * measure bcrypt instead of the clock endpoint.
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

  clockIn(params);
  readToday(params);

  // A kiosk marks once and walks away; without this pause 10 VUs would hammer
  // the same employee row far harder than any real shift change does.
  sleep(1);
}

/** Sends one clock entry and accepts the documented business rejections. */
function clockIn(params) {
  const body = JSON.stringify({
    type: CLOCK_CYCLE[__ITER % CLOCK_CYCLE.length],
    // 'web' rather than 'mobile': the mobile source rejects a mark outside the
    // geofence, and the test sends no coordinates.
    source: 'web',
  });

  const res = http.post(`${API}/time/clock`, body, { ...params, tags: { name: 'time/clock' } });

  clockTrend.add(res.timings.duration);
  rateLimited.add(res.status === 429);

  const code = errorCode(res);
  const inserted = res.status === 201;
  // 409 CLOCK_DUPLICATE and 422 CLOCK_SEQUENCE_INVALID are the API refusing an
  // impossible attendance record, which is the correct behaviour when several
  // VUs clock the same employee at once. They count as a valid outcome here.
  const rejectedByRule = code === 'CLOCK_DUPLICATE' || code === 'CLOCK_SEQUENCE_INVALID';

  if (inserted) acceptedWrites.add(1);
  legitimateResponse.add(inserted || rejectedByRule);

  check(res, {
    'time/clock: insertada o rechazada por regla de negocio': () => inserted || rejectedByRule,
    'time/clock: la respuesta trae cuerpo util': (r) => {
      const payload = safeJson(r);
      if (payload === null) return false;
      // A successful write returns the entry inside `{ data }`; a rejection
      // returns the error envelope of AllExceptionsFilter, which always
      // carries a machine readable `code`.
      return inserted ? payload.data !== undefined : typeof payload.code === 'string';
    },
  });
}

/** Reads the entries and computed day of the authenticated collaborator. */
function readToday(params) {
  const res = http.get(`${API}/time/clock/today`, { ...params, tags: { name: 'time/clock/today' } });

  todayTrend.add(res.timings.duration);
  rateLimited.add(res.status === 429);
  legitimateResponse.add(res.status === 200);

  check(res, {
    'time/clock/today: status 200': (r) => r.status === 200,
    'time/clock/today: trae data con entries': (r) => {
      const payload = safeJson(r);
      return payload !== null && payload.data != null && Array.isArray(payload.data.entries);
    },
  });
}

/** Reads the `code` of the error envelope, or null when the call succeeded. */
function errorCode(res) {
  const payload = safeJson(res);
  return payload && typeof payload.code === 'string' ? payload.code : null;
}

/** A timeout or a non-JSON error page must fail the check, never the script. */
function safeJson(res) {
  try {
    return res.json();
  } catch (error) {
    return null;
  }
}
