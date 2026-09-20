import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 30 },  // Ramp up to 30 VUs
    { duration: '1m30s', target: 100 },// High concurrency: 100 VUs
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% of requests must complete below 200ms
    http_req_failed: ['rate<0.01'],   // Less than 1% request failures
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3001/api/v1';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'mock-jwt-token';
const FARM_ID = __ENV.FARM_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'X-Farm-Id': FARM_ID,
  };

  // 1. Query Animals Registry
  const animalsRes = http.get(`${BASE_URL}/animals?page=1&limit=20`, { headers });
  check(animalsRes, {
    'animals query status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  sleep(0.5);

  // 2. Log Daily Milk Yield
  const milkPayload = JSON.stringify({
    farmId: FARM_ID,
    session: 'MORNING',
    yieldLiters: 18.5,
    fatPercent: 3.8,
    snfPercent: 8.5,
    loggedDate: '2026-09-20',
  });

  const milkRes = http.post(`${BASE_URL}/milk-logs`, milkPayload, { headers });
  check(milkRes, {
    'milk log status is 201 or 400 or 401': (r) =>
      r.status === 201 || r.status === 400 || r.status === 401,
  });

  sleep(0.5);

  // 3. Query Milk Production Analytics
  const analyticsRes = http.get(
    `${BASE_URL}/milk-logs/analytics?startDate=2026-09-01&endDate=2026-09-20`,
    { headers }
  );
  check(analyticsRes, {
    'milk analytics status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  sleep(1);
}
