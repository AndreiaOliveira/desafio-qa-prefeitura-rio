import http from 'k6/http';
import { check, group } from 'k6';

/**
 * Load test — carga normal sustentada.
 *
 * Simula ~50 cidadãos simultâneos consultando o catálogo por 5 minutos.
 * Estimativa conservadora dado o porte do município (Rio ~6.7M habitantes,
 * DAU projetado de 50-100k num portal de serviços públicos bem adotado).
 *
 * Thresholds baseados em diretrizes de UX web do Google (User-Centric
 * Performance Metrics) adaptadas pra APIs transacionais.
 */

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '4m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    checks: ['rate>0.95'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:8080';
const TOKEN = __ENV.API_TOKEN || 'qa-challenge-token';
const SERVICE_IDS = ['s001', 's002', 's003', 's004', 's005', 's006', 's007', 's008', 's009', 's010', 's011'];

export default function () {
  const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

  group('catalog browsing', () => {
    const list = http.get(`${BASE_URL}/api/v1/services`);
    check(list, { 'list is 200': (r) => r.status === 200 });

    const randomId = SERVICE_IDS[Math.floor(Math.random() * SERVICE_IDS.length)];
    const detail = http.get(`${BASE_URL}/api/v1/services/${randomId}`);
    check(detail, { 'detail is 200': (r) => r.status === 200 });
  });

  group('catalog search', () => {
    const search = http.post(
      `${BASE_URL}/api/v1/services/search`,
      JSON.stringify({ query: 'saude' }),
      { headers },
    );
    check(search, { 'search is 200': (r) => r.status === 200 });
  });
}
