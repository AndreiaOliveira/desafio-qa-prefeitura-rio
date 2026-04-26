import { test, expect } from '@playwright/test';
import { ENDPOINTS } from '../../../utils/constants';

/**
 * Testes do endpoint POST /api/v1/services/:id/favorite.
 *
 * Estrategia de test data isolation:
 *
 * Este endpoint modifica estado no servidor (adiciona favoritos a uma lista
 * em memoria). Como a API nao expoe endpoint GET /favorites para verificar,
 * nao podemos limpar estado entre testes.
 *
 * Em vez de limpar, **isolamos por dado**: cada teste usa um service_id
 * diferente (s002, s003), garantindo que a execucao de um teste nao afeta
 * o estado observavel pelo outro. Os IDs sao escolhidos da lista de servicos
 * conhecidos em utils/constants.ts.
 *
 * Essa abordagem funciona porque:
 *  1. A API aceita qualquer ID valido (nao ha logica de unicidade global).
 *  2. Cada teste valida apenas seu proprio efeito (service_id retornado).
 *  3. Nao dependemos de "estado limpo" - dependemos de "estado distinto".
 *
 * Em projetos com rollback transacional ou endpoint de cleanup, a abordagem
 * mais comum eh afterEach() resetando estado. Aqui o design da API torna
 * isolation por dado a alternativa mais pragmatica.
 */

test.describe('POST /api/v1/services/:id/favorite', () => {
  test('retorna 200 com a mensagem esperada', async ({ request }) => {
    const response = await request.post(ENDPOINTS.favorite('s002'));

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.message).toBe('added to favorites');
    expect(body.service_id).toBe('s002');
  });

  test('é idempotente: segunda chamada com mesmo id também retorna 200', async ({ request }) => {
 
    await request.post(ENDPOINTS.favorite('s003'));
    const secondResponse = await request.post(ENDPOINTS.favorite('s003'));

    expect(secondResponse.status()).toBe(200);

    const body = await secondResponse.json();
    expect(body.service_id).toBe('s003');
  });
});
