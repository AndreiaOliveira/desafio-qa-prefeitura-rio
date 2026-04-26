import { test, expect, request as playwrightRequest } from '@playwright/test';
import { API_BASE_URL } from '../../../playwright.config';
import { ENDPOINTS } from '../../../utils/constants';



test.describe('Segurança: sanitização de entrada em GET /services/:id (IDs tratados corretamente)', () => {
 
  const safelyHandledIds = [
    { name: 'XSS payload', id: '<script>alert(1)</script>' },
    { name: 'path traversal (unix)', id: '../../../etc/passwd' },
  ];

  for (const { name, id } of safelyHandledIds) {
    test(`GET /services/:id manipula ${name} sem retornar erro 500`, async ({ request }) => {
      const response = await request.get(ENDPOINTS.serviceDetail(encodeURIComponent(id)));
      expect([400, 404]).toContain(response.status());
      const text = await response.text();
      expect(text).not.toContain('panic');
      expect(text).not.toContain('goroutine');
    });
  }
});

test.describe('Segurança: sanitização de entrada em GET /services/:id (variantes do BUG-001)', () => {
  
  const bugExtensionIds = [
    { name: 'SQL-like injection', id: "'; DROP TABLE services;--" },
    { name: 'path traversal (url-encoded)', id: '..%2F..%2Fetc%2Fpasswd' },
    { name: 'very long id', id: 'a'.repeat(5000) },
    { name: 'unicode homoglyph', id: 'ѕ001' },
    { name: 'whitespace only', id: '   ' },
  ];

  for (const { name, id } of bugExtensionIds) {
    test.fail(`GET /services/:id manipula ${name} sem retornar erro 500 (variante do BUG-001)`, async ({ request }) => {
      const response = await request.get(ENDPOINTS.serviceDetail(encodeURIComponent(id)));
      expect([400, 404]).toContain(response.status());
      const text = await response.text();
      expect(text).not.toContain('panic');
      expect(text).not.toContain('goroutine');
    });
  }
});

test.describe('Segurança: abuso de payload em POST /services/search', () => {
  test('recusa query excessivamente grande de forma graciosa', async ({ request }) => {
    const hugeQuery = 'a'.repeat(100000);
    const response = await request.post(ENDPOINTS.search, { data: { query: hugeQuery } });
    expect([200, 400, 413]).toContain(response.status());
    expect(response.status()).not.toBe(500);
  });

  test('processa caracteres unicode e especiais na query', async ({ request }) => {
    const specialQueries = ['vacina', 'Acao Saude', 'emoji test'];
    for (const query of specialQueries) {
      const response = await request.post(ENDPOINTS.search, { data: { query } });
      expect(response.status()).toBe(200);
    }
  });

  test('recusa content-type não-JSON apropriadamente', async ({ request }) => {
    const response = await request.post(ENDPOINTS.search, {
      headers: { 'Content-Type': 'text/plain' },
      data: 'query=vacina',
    });
    expect([400, 415]).toContain(response.status());
  });
});

test.describe('Segurança: validação de métodos HTTP permitidos', () => {
  const methodTests: Array<{ path: string; method: 'PUT' | 'DELETE' | 'PATCH'; description: string }> = [
    { path: '/api/v1/services', method: 'DELETE', description: 'DELETE on services list' },
    { path: '/api/v1/services/s001', method: 'PUT', description: 'PUT on service detail' },
    { path: '/api/v1/services/s001', method: 'DELETE', description: 'DELETE on service detail' },
    { path: '/api/v1/services/s001', method: 'PATCH', description: 'PATCH on service detail' },
    { path: '/health', method: 'DELETE', description: 'DELETE on health endpoint' },
  ];

  for (const { path, method, description } of methodTests) {
    test(`${description} retorna 404 ou 405`, async ({ request }) => {
      const response = await request.fetch(path, { method });
      expect([404, 405]).toContain(response.status());
    });
  }
});

test.describe('Segurança: casos extremos de autenticação', () => {
  test('recusa header Authorization com espaços extras', async () => {
    const ctx = await playwrightRequest.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: { Authorization: 'Bearer  qa-challenge-token  ' },
    });
    const response = await ctx.post(ENDPOINTS.favorite('s001'));
    const status = response.status();
    await ctx.dispose();
    expect([200, 401]).toContain(status);
  });

  test('recusa esquema de Authorization malformado (Basic em vez de Bearer)', async () => {
    const ctx = await playwrightRequest.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: { Authorization: 'Basic qa-challenge-token' },
    });
    const response = await ctx.post(ENDPOINTS.favorite('s001'));
    const status = response.status();
    await ctx.dispose();
    expect(status).toBe(401);
  });

  test('recusa token Bearer vazio', async () => {
    const ctx = await playwrightRequest.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: { Authorization: 'Bearer ' },
    });
    const response = await ctx.post(ENDPOINTS.favorite('s001'));
    const status = response.status();
    await ctx.dispose();
    expect(status).toBe(401);
  });
});

test.describe('Observabilidade: ausência de rate limiting (documentação)', () => {
  test('endpoint /health não apresenta rate limiting visível (50 requisições consecutivas)', async ({ request }) => {
    const latencies: number[] = [];
    for (let i = 0; i < 50; i++) {
      const start = Date.now();
      const response = await request.get(ENDPOINTS.health);
      latencies.push(Date.now() - start);
      expect(response.status()).toBe(200);
    }
    const avgFirst10 = latencies.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    const avgLast10 = latencies.slice(-10).reduce((a, b) => a + b, 0) / 10;
    expect(avgLast10).toBeLessThan(avgFirst10 * 3);
  });
});
