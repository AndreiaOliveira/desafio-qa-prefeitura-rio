import { test, expect } from '@playwright/test';
import { ENDPOINTS, KNOWN_SERVICE_IDS } from '../../utils/constants';

/**
 * Contract testing - resposta de GET /api/v1/services/:id/recommendations.
 *
 * Diferente da listagem (que retorna {data, total, ...}), este endpoint usa
 * wrapping diferente: {recommendations, service_id}. Validar essa diferenca
 * eh importante porque consumidores podem assumir wrapping uniforme entre
 * endpoints e tomar decisoes erradas (ex: ler r.data esperando ver recs).
 *
 * Validacoes:
 *  - Estrutura: {recommendations: Service[], service_id: string}
 *  - service_id retornado bate com o id solicitado
 *  - Cada item de recommendations segue o schema completo de Service
 *  - service_id nao aparece dentro das proprias recommendations (nao recomenda
 *    o servico para si mesmo)
 */

const REQUIRED_SERVICE_FIELDS = ['id', 'title', 'description', 'category', 'tags', 'organization', 'view_count', 'active'];
const ID_PATTERN = /^s\d{3}$/;

test.describe('Contract: estrutura de GET /services/:id/recommendations', () => {
  test.fail('recommendations deve ser array vazio quando nao ha recomendacoes (BUG-006 - achado)', async ({ request }) => {
    /**
     * Achado durante desenvolvimento desta suite (nao estava na lista dos 5
     * bugs plantados). Quando o servico nao tem recomendacoes, a API retorna:
     *
     *   { "recommendations": null, "service_id": "s005" }
     *
     * O esperado pelo contrato eh:
     *
     *   { "recommendations": [], "service_id": "s005" }
     *
     * Reproducao manual:
     *   curl http://localhost:8080/api/v1/services/s005/recommendations
     *
     * Impacto: consumidores (frontend, mobile) que iteram sobre
     * recommendations.map() ou recommendations.length crasham com TypeError
     * ao receber null. O fix forca defensividade em todos os clientes,
     * fricção evitavel se o contrato fosse uniforme.
     *
     * Ver docs/bugs/BUG-006.md.
     */
    const response = await request.get(ENDPOINTS.recommendations('s005'));
    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(
      Array.isArray(body.recommendations),
      'recommendations deveria ser array (mesmo vazio), nunca null'
    ).toBe(true);
  });

  test('resposta tem wrapping {recommendations, service_id}', async ({ request }) => {
    const response = await request.get(ENDPOINTS.recommendations('s001'));
    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body, 'resposta deve ter campo recommendations').toHaveProperty('recommendations');
    expect(body, 'resposta deve ter campo service_id').toHaveProperty('service_id');
    expect(Array.isArray(body.recommendations), 'recommendations deve ser array').toBe(true);
    expect(typeof body.service_id, 'service_id deve ser string').toBe('string');
  });

  test('service_id retornado bate com o id requisitado', async ({ request }) => {
    const ids = ['s001', 's005', 's011'];
    for (const id of ids) {
      const response = await request.get(ENDPOINTS.recommendations(id));
      const body = await response.json();
      expect(body.service_id, `service_id deve refletir o id requisitado (${id})`).toBe(id);
    }
  });

  test('cada recommendation segue o schema completo de Service', async ({ request }) => {
    const response = await request.get(ENDPOINTS.recommendations('s001'));
    const body = await response.json();

    expect(body.recommendations.length, 'deve retornar ao menos uma recomendacao').toBeGreaterThan(0);

    for (const rec of body.recommendations) {
      for (const field of REQUIRED_SERVICE_FIELDS) {
        expect(rec, `cada recommendation deve ter campo ${field}`).toHaveProperty(field);
      }
      expect(rec.id, `recommendation.id deve seguir padrao s\\d{3}`).toMatch(ID_PATTERN);
      expect(typeof rec.title, 'rec.title deve ser string').toBe('string');
      expect(Array.isArray(rec.tags), 'rec.tags deve ser array').toBe(true);
      expect(typeof rec.view_count, 'rec.view_count deve ser number').toBe('number');
    }
  });

  test('servico nao recomenda a si mesmo (quando ha recomendacoes)', async ({ request }) => {
    /**
     * Um servico nunca deve aparecer em sua propria lista de recomendacoes.
     * Eh um contrato logico: recomendacao implica diversidade. Detectar isso
     * via teste evita um tipo classico de bug onde a logica de filtro esquece
     * de excluir o item de origem.
     *
     * Tratamento defensivo: alguns servicos retornam recommendations como
     * null em vez de array vazio (ver BUG-006 em docs/bugs/). Esse teste
     * usa apenas servicos que sabidamente tem recomendacoes.
     */
    for (const id of ['s001', 's011']) {
      const response = await request.get(ENDPOINTS.recommendations(id));
      const body = await response.json();
      // Skip defensivo se a API retornar null (achado em BUG-006)
      if (!Array.isArray(body.recommendations)) continue;
      const selfRecommendation = body.recommendations.find((r: { id: string }) => r.id === id);
      expect(
        selfRecommendation,
        `servico ${id} nao deve aparecer em suas proprias recomendacoes`
      ).toBeUndefined();
    }
  });

  test('todos os ids recomendados existem no catalogo', async ({ request }) => {
    /**
     * Verifica integridade referencial: nenhuma recommendation aponta para
     * um id "fantasma" que nao existe na listagem real. Isso pega bugs onde
     * o algoritmo de recomendacao usa uma lista cacheada/desatualizada.
     */
    const knownIdsSet = new Set<string>(KNOWN_SERVICE_IDS);
    const response = await request.get(ENDPOINTS.recommendations('s001'));
    const body = await response.json();

    // Defensivo: BUG-006 documenta casos onde recommendations vem como null
    if (!Array.isArray(body.recommendations)) {
      throw new Error('recommendations deveria ser array, recebido: ' + typeof body.recommendations);
    }
    for (const rec of body.recommendations) {
      expect(
        knownIdsSet.has(rec.id),
        `id recomendado ${rec.id} deve existir na lista de servicos conhecidos`
      ).toBe(true);
    }
  });
});
