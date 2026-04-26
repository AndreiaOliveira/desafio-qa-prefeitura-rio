import http from 'k6/http';
import { check } from 'k6';

/**
 * Smoke test — baseline de performance sem pressão.
 *
 * Objetivo: confirmar que a API responde corretamente com 1 usuário
 * virtual. Se este teste falhar, nada mais importa — há um problema
 * funcional ou de disponibilidade.
 *
 * Executado a cada commit no CI. Duração: 30 segundos.
 */

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    checks: ['rate>0.99'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:8080';
const TOKEN = __ENV.API_TOKEN || 'qa-challenge-token';

export default function () {
  const headers = { Authorization: `Bearer ${TOKEN}` };

  const health = http.get(`${BASE_URL}/health`);
  check(health, { 'health is 200': (r) => r.status === 200 });

  const list = http.get(`${BASE_URL}/api/v1/services`, { headers });
  check(list, {
    'list is 200': (r) => r.status === 200,
    'list has 11 services': (r) => r.json('total') === 11,
  });
}
