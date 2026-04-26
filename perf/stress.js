import http from 'k6/http';
import { check } from 'k6';

/**
 * Stress test — encontra o ponto de degradação.
 *
 * Sobe a carga gradualmente até 300 VUs. Propósito: identificar onde o
 * sistema começa a responder mal (latência crescendo, erros aparecendo).
 * Ajuda a dimensionar recursos de produção e definir limites de
 * auto-scaling.
 *
 * Não esperamos passar todos os thresholds — esperamos entender o limiar.
 */

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 300 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:8080';
const TOKEN = __ENV.API_TOKEN || 'qa-challenge-token';

export default function () {
  const headers = { Authorization: `Bearer ${TOKEN}` };
  const response = http.get(`${BASE_URL}/api/v1/services`, { headers });
  check(response, { 'is 200': (r) => r.status === 200 });
}
