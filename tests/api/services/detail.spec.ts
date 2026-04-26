import { test, expect } from '@playwright/test';
import { ENDPOINTS, ERROR_MESSAGES, NON_EXISTENT_SERVICE_ID } from '../../../utils/constants';
import { assertIsService } from '../../../utils/schema';



test.describe('GET /api/v1/services/:id', () => {
  test('retorna 200 e um objeto Service válido para id existente', async ({ request }) => {
    const response = await request.get(ENDPOINTS.serviceDetail('s001'));

    expect(response.status()).toBe(200);

    const body = await response.json();
    assertIsService(body);
    expect(body.id).toBe('s001');
  });

  test.fail('retorna 404 para id de serviço inexistente (BUG-001)', async ({ request }) => {

    const response = await request.get(ENDPOINTS.serviceDetail(NON_EXISTENT_SERVICE_ID));

    expect(response.status(), 'deve retornar 404 quando o serviço não existe').toBe(404);

    const body = await response.json();
    expect(body).toMatchObject({ error: ERROR_MESSAGES.serviceNotFound });
  });
});
