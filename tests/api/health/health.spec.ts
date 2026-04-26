import { test, expect } from '@playwright/test';
import { ENDPOINTS, TOTAL_SERVICES } from '../../../utils/constants';



test.describe('GET /health', () => {
  test('retorna 200 com a estrutura esperada', async ({ request }) => {
    const response = await request.get(ENDPOINTS.health);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.services).toBe(TOTAL_SERVICES);
    expect(typeof body.version).toBe('string');
    expect(typeof body.timestamp).toBe('string');

    
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow();
  });

  test('responde dentro do SLA de 500ms mesmo em cold start', async ({ request }) => {
    const start = Date.now();
    const response = await request.get(ENDPOINTS.health);
    const elapsed = Date.now() - start;

    expect(response.status()).toBe(200);
    expect(elapsed, 'health check deve responder em < 500ms').toBeLessThan(500);
  });
});
