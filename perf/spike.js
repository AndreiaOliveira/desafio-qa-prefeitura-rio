import http from 'k6/http';
import { check } from 'k6';

/**
 * Spike test — comportamento sob tráfego súbito.
 *
 * Cenário real: matéria em veículo popular sobre "Cartão Rio" viraliza,
 * tráfego salta de ~10 VUs para ~500 VUs em poucos segundos, depois
 * volta ao normal. Mede se a API sobrevive e se recupera — ou se precisa
 * de rate limiting, cache ou CDN na frente.
 */

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '10s', target: 500 },
    { duration: '1m', target: 500 },
    { duration: '10s', target: 10 },
    { duration: '30s', target: 10 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<3000'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:8080';
const TOKEN = __ENV.API_TOKEN || 'qa-challenge-token';

export default function () {
  const headers = { Authorization: `Bearer ${TOKEN}` };
  const res = http.get(`${BASE_URL}/api/v1/services/s001`, { headers });
  check(res, { 'is 200': (r) => r.status === 200 });
}
