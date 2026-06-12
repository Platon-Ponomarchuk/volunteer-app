import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    smoke_10: {
      executor: 'constant-vus',
      vus: 10,
      duration: '1m',
      exec: 'main',
    },
    load_50: {
      executor: 'constant-vus',
      vus: 50,
      duration: '1m',
      startTime: '1m10s',
      exec: 'main',
    },
    load_100: {
      executor: 'constant-vus',
      vus: 100,
      duration: '1m',
      startTime: '2m20s',
      exec: 'main',
    },
    load_200: {
      executor: 'constant-vus',
      vus: 200,
      duration: '1m',
      startTime: '3m30s',
      exec: 'main',
    },
    load_500: {
      executor: 'constant-vus',
      vus: 500,
      duration: '1m',
      startTime: '4m40s',
      exec: 'main',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';
const EMAIL = __ENV.TEST_EMAIL || 'volunteer@test.ru';
const PASSWORD = __ENV.TEST_PASSWORD || '123456';

export function main() {
  const login = http.post(
    `${BASE_URL}/auth`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  check(login, {
    'login responded': (res) => res.status === 200,
    'login ok': (res) => {
      try {
        return res.json('status') === 'OK' && Boolean(res.json('token'));
      } catch {
        return false;
      }
    },
  });

  const token = login.json('token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const events = http.get(`${BASE_URL}/events?status=published&_limit=20`, { headers: authHeaders });

  check(events, {
    'events loaded': (res) => res.status === 200,
  });

  sleep(1);
}
