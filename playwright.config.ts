import { defineConfig } from '@playwright/test';

/**
 * Configuração da suíte de testes de API do Catálogo de Serviços Públicos.
 *
 * Stack: Playwright Test em modo API (sem browser).
 * Justificativas:
 *  - 1 projeto único "api" em vez de 3 browsers, pois o escopo é REST (sem UI).
 *  - baseURL centralizada: testes ficam declarativos (.get('/api/v1/services')).
 *  - Auth padrão via extraHTTPHeaders, sobrescrevível por teste quando se
 *    quer validar ausência de token (ex: BUG-005).
 *  - Retry só em CI, porque retry local mascara flakiness real durante debug.
 *  - 3 reporters: list (terminal), html (análise humana), json (consumido
 *    pelo CI para gerar o relatório de qualidade automatizado).
 */

export const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8080';
export const API_TOKEN = process.env.API_TOKEN ?? 'qa-challenge-token';
export const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? 'webhook-secret-2024';

export default defineConfig({
  testDir: './tests',

  // Falha se alguem esquecer um .only() commitado
  forbidOnly: !!process.env.CI,

  // Retries só em CI para não mascarar flakiness no desenvolvimento local
  retries: process.env.CI ? 2 : 0,

  // Paralelização agressiva no CI, default local
  workers: process.env.CI ? 4 : undefined,

  // Timeout generoso para testes que fazem múltiplas requisições (ex: paginação)
  timeout: 30_000,

  expect: {
    timeout: 5_000,
  },

  // Relatórios: terminal + HTML interativo + JSON para consumo programático no CI
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  use: {
    baseURL: API_BASE_URL,
    extraHTTPHeaders: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    // Captura trace em caso de retry, útil para debugar falhas intermitentes
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'api',
      testDir: './tests/api',
    },
    {
      name: 'contract',
      testDir: './tests/contract',
    },
    // Próximas evoluções moduladas como projects independentes:
    //  - 'contract-strict' integrado com Schemathesis (gera casos do OpenAPI)
    //  - 'resilience-toxiproxy' com proxy injetando latência e packet loss
    // A separação por project permite rodar cada categoria isoladamente em CI.
  ],
});
