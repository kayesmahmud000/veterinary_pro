import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 30 },  // Ramp up to 30 VUs
    { duration: '1m30s', target: 100 },// Stress load: 100 VUs
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of sync requests must complete below 500ms
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
  };

  // 1. Pull Incremental Delta Changes
  const pullPayload = JSON.stringify({
    farmId: FARM_ID,
    lastPulledAt: Date.now() - 3600000, // 1 hour ago
  });

  const pullRes = http.post(`${BASE_URL}/sync/pull`, pullPayload, { headers });
  check(pullRes, {
    'sync pull status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  sleep(0.5);

  // 2. Push Batch Mutations
  const uniqueId = `${__VU}-${__ITER}-${Date.now()}`;
  const pushPayload = JSON.stringify({
    farmId: FARM_ID,
    lastPulledAt: Date.now() - 3600000,
    changes: {
      animals: {
        created: [
          {
            id: `a0eebc99-0000-0000-0000-${String(__VU).padStart(6, '0')}${String(__ITER).padStart(6, '0')}`,
            farmId: FARM_ID,
            tagNumber: `SYNC-${uniqueId}`,
            species: 'COW',
            gender: 'FEMALE',
            status: 'ACTIVE',
            syncVersion: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        updated: [],
        deleted: [],
      },
    },
  });

  const pushRes = http.post(`${BASE_URL}/sync/push`, pushPayload, { headers });
  check(pushRes, {
    'sync push status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  sleep(0.5);

  // 3. Query Farm Sync Status
  const statusRes = http.get(`${BASE_URL}/sync/status/${FARM_ID}`, { headers });
  check(statusRes, {
    'sync status query is 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  sleep(1);
}
