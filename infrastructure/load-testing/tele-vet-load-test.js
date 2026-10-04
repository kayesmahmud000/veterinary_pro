import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 VUs
    { duration: '1m', target: 50 },   // Hold 50 VUs
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% of requests must complete below 200ms
    http_req_failed: ['rate<0.005'],  // Less than 0.5% request failures
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

  // 1. Triage Queue Inspection
  const triageRes = http.get(`${BASE_URL}/consultations/triage?status=SUBMITTED`, { headers });
  check(triageRes, {
    'triage queue status is 200 or 401 or 403': (r) =>
      r.status === 200 || r.status === 401 || r.status === 403,
  });

  sleep(0.5);

  // 2. Submit Consultation Intake
  const consultPayload = JSON.stringify({
    farmId: FARM_ID,
    chiefComplaint: 'Cow exhibiting sudden drop in milk yield, lethargy, and mild pyrexia (103.5 F).',
    type: 'ASYNC_TICKET',
    mediaUrls: [],
  });

  const intakeRes = http.post(`${BASE_URL}/consultations`, consultPayload, { headers });
  check(intakeRes, {
    'intake status is 201 or 400 or 401': (r) =>
      r.status === 201 || r.status === 400 || r.status === 401,
  });

  sleep(0.5);

  // 3. Public Prescription Verification Endpoint (Unauthenticated / Public)
  const testPrescriptionId = 'c0a80101-0000-0000-0000-000000000001';
  const verifyRes = http.get(`${BASE_URL}/verify/prescription/${testPrescriptionId}`);
  check(verifyRes, {
    'verify status is 200 or 404': (r) => r.status === 200 || r.status === 404,
  });

  sleep(1);
}
