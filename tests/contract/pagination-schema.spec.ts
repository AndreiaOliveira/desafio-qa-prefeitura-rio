import { test, expect } from '@playwright/test';
import { ENDPOINTS, TOTAL_SERVICES } from '../../utils/constants';

/**
 * Contract testing - resposta paginada de GET /api/v1/services.
 *
 * Validacoes feitas:
 *  - Estrutura: {data, total, page, per_page, total_pages}
 *  - Tipos: todos numericos sao inteiros nao-negativos
 *  - Coerencia matematica: total_pages = ceil(total / per_page)
 *  - Coerencia entre paginas: union(data de todas paginas) == total
 *
 * Nota importante: o teste da relacao matematica esta marcado test.fail()
 * porque a API hoje calcula total_pages com floor (BUG-003). Quando o bug
 * for corrigido, esse teste passa a falhar (porque test.fail espera falha)
 * e o time saberah que pode remover a marcacao.
 *
 * Isso ilustra que contract testing nao testa apenas estruturas - testa
 * tambem invariantes logicas que o consumidor da API depende para funcionar.
 */

test.describe('Contract: paginacao de GET /services', () => {
  test('resposta tem todos os campos de paginacao com tipos corretos', async ({ request }) => {
    const response = await request.get(ENDPOINTS.servicesList);
    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(Array.isArray(body.data), 'data deve ser array').toBe(true);
    expect(Number.isInteger(body.total), 'total deve ser inteiro').toBe(true);
    expect(Number.isInteger(body.page), 'page deve ser inteiro').toBe(true);
    expect(Number.isInteger(body.per_page), 'per_page deve ser inteiro').toBe(true);
    expect(Number.isInteger(body.total_pages), 'total_pages deve ser inteiro').toBe(true);
  });

  test('campos de paginacao sao todos nao-negativos', async ({ request }) => {
    const response = await request.get(ENDPOINTS.servicesList);
    const body = await response.json();

    expect(body.total, 'total >= 0').toBeGreaterThanOrEqual(0);
    expect(body.page, 'page >= 1').toBeGreaterThanOrEqual(1);
    expect(body.per_page, 'per_page >= 1').toBeGreaterThanOrEqual(1);
    expect(body.total_pages, 'total_pages >= 0').toBeGreaterThanOrEqual(0);
  });

  test('total reflete a contagem real do catalogo', async ({ request }) => {
    const response = await request.get(ENDPOINTS.servicesList);
    const body = await response.json();
    expect(body.total, `total deve ser ${TOTAL_SERVICES}`).toBe(TOTAL_SERVICES);
  });

  test.fail('total_pages = ceil(total / per_page) - invariante matematica (BUG-003)', async ({ request }) => {
   
    const response = await request.get(ENDPOINTS.servicesList);
    const body = await response.json();

    const expected = Math.ceil(body.total / body.per_page);
    expect(
      body.total_pages,
      `total_pages deveria ser ${expected} (= ceil(${body.total} / ${body.per_page})), recebido ${body.total_pages}`
    ).toBe(expected);
  });

  test('paginacao retorna todos os servicos quando varremos todas as paginas', async ({ request }) => {
 
    const collectedIds = new Set<string>();
    let realTotal = 0;

    for (let page = 1; page <= 3; page++) {
      const response = await request.get(`${ENDPOINTS.servicesList}?page=${page}`);
      const body = await response.json();
      realTotal = body.total;
      for (const service of body.data) {
        expect(collectedIds.has(service.id), `id ${service.id} duplicado entre paginas`).toBe(false);
        collectedIds.add(service.id);
      }
      if (body.data.length === 0) break;
    }

    expect(collectedIds.size, 'numero de ids unicos coletados deve bater com total declarado').toBe(realTotal);
  });
});
