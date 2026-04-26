import { test, expect } from '@playwright/test';
import { ENDPOINTS } from '../../../utils/constants';

/**
 * Testes de resiliência da API.
 *
 * Validam o comportamento da API sob condições de cliente adversas:
 * - Cliente que desiste da requisição antes de receber resposta (timeout)
 * - Conexões curtas sem keep-alive (típico de redes móveis)
 * - Picos de concorrência localizados
 *
 * Esta é uma versão embrionária do diferencial "testes de resiliência".
 * A evolução natural é integrar Toxiproxy como proxy entre cliente e API,
 * permitindo simular latência real, packet loss, slow read, slow write,
 * e conexões dropadas no meio do payload. Isso está documentado no roadmap.
 *
 * O foco aqui é garantir que a API:
 * 1. Não entra em estado inconsistente quando o cliente abandona requests.
 * 2. Mantém latência aceitável mesmo sem reúso de conexão TCP.
 * 3. Não trava ou degrada catastroficamente sob carga concorrente moderada.
 */

test.describe('Resiliência: comportamento sob condições de cliente adversas', () => {
  test('API permanece saudável após cliente abandonar requisição (timeout 1ms)', async ({ request }) => {
     
    let timedOut = false;
    try {
      await request.get(ENDPOINTS.servicesList, { timeout: 1 });
    } catch (err) {
      timedOut = true;
    }
    expect(timedOut, 'a requisição deve ter timeout no cliente, não na API').toBe(true);

    // Tentativa 2: confirmar que a API ainda responde para o próximo cliente
    const healthResponse = await request.get(ENDPOINTS.health);
    expect(healthResponse.status(), 'API deve continuar saudável após timeout do cliente anterior').toBe(200);

    const listResponse = await request.get(ENDPOINTS.servicesList);
    expect(listResponse.status(), 'endpoint principal deve continuar respondendo normalmente').toBe(200);
  });

  test('API atende requisições com Connection: close sem degradação significativa', async ({ playwright }) => {
   
    const ITERATIONS = 10;
    const latencies: number[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const ctx = await playwright.request.newContext({
        baseURL: process.env.API_BASE_URL || 'http://localhost:8080',
        extraHTTPHeaders: { 'Connection': 'close' },
      });
      const start = Date.now();
      const response = await ctx.get(ENDPOINTS.health);
      const elapsed = Date.now() - start;
      expect(response.status(), `iteração ${i + 1}: endpoint /health deve retornar 200`).toBe(200);
      latencies.push(elapsed);
      await ctx.dispose();
    }

    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const max = Math.max(...latencies);

    
    expect(avg, `latência média com Connection: close (${avg.toFixed(1)}ms) deve ser razoável`).toBeLessThan(500);
    expect(max, `latência máxima (${max}ms) não deve indicar travamento`).toBeLessThan(2000);
  });

  test('API processa 50 requisições concorrentes sem falhas', async ({ request }) => {
  
    const CONCURRENT = 50;

    const requests = Array.from({ length: CONCURRENT }, () =>
      request.get(ENDPOINTS.servicesList)
    );
    const responses = await Promise.all(requests);

    const failed = responses.filter(r => r.status() !== 200);
    expect(
      failed.length,
      `nenhuma das ${CONCURRENT} requisições concorrentes deve falhar (falharam ${failed.length})`
    ).toBe(0);

    
    const samplesToCheck = responses.slice(0, 5);
    for (const response of samplesToCheck) {
      const body = await response.json();
      expect(body, 'resposta deve conter campo data mesmo sob concorrência').toHaveProperty('data');
    }
  });
});
