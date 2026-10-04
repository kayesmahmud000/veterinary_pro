import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 VUs
    { duration: '1m', target: 50 },   // Ramp up to 50 VUs
    { duration: '30s', target: 0 },   // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<250'], // 95% of requests must complete below 250ms
    http_req_failed: ['rate<0.01'],   // Less than 1% request failures
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3001/api/v1';

export default function () {
  const uniqueId = `${__VU}-${__ITER}-${Date.now()}`;
  const registerPayload = JSON.stringify({
    email: `loadtest_${uniqueId}@vetralink.pro`,
    password: 'P@ssword12345!',
    name: `Load Test User ${uniqueId}`,
    role: 'FARMER',
    phone: `+1202555${String(__ITER).padStart(4, '0')}`,
  });

  const headers = { 'Content-Type': 'application/json' };

  // 1. User Registration
  const regRes = http.post(`${BASE_URL}/auth/register`, registerPayload, { headers });
  check(regRes, {
    'register status is 201 or 409': (r) => r.status === 201 || r.status === 409,
  });

  sleep(0.5);

  // 2. User Login
  const loginPayload = JSON.stringify({
    email: `loadtest_${uniqueId}@vetralink.pro`,
    password: 'P@ssword12345!',
  });

  const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, { headers });
  const loginCheck = check(loginRes, {
    'login status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  if (loginRes.status === 200) {
    const body = loginRes.json();
    const token = body.data ? body.data.accessToken : null;
    const refreshToken = body.data ? body.data.refreshToken : null;

    if (refreshToken) {
      // 3. Refresh Token Exchange (Single-use rotation)
      const refreshPayload = JSON.stringify({ refreshToken });
      const refreshRes = http.post(`${BASE_URL}/auth/refresh`, refreshPayload, { headers });
      check(refreshRes, {
        'token refresh status is 200': (r) => r.status === 200,
      });
    }
  }

  sleep(1);
}
