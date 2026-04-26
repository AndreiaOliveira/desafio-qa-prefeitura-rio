import { test, expect, request as playwrightRequest } from '@playwright/test';
import { API_BASE_URL } from '../../../playwright.config';
import { ENDPOINTS, ERROR_MESSAGES } from '../../../utils/constants';


test.describe('GET /api/v1/services/:id/recommendations (autenticação)', () => {
  test('retorna 200 com token válido', async ({ request }) => {
    const response = await request.get(ENDPOINTS.recommendations('s001'));

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.service_id).toBe('s001');
    expect(Array.isArray(body.recommendations)).toBe(true);
  });

  test.fail('recusa requisição sem o header Authorization (BUG-005a)', async () => {
    const unauthenticatedContext = await playwrightRequest.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: {},
    });

    const response = await unauthenticatedContext.get(ENDPOINTS.recommendations('s001'));
    const status = response.status();
    const body = await response.json();
    await unauthenticatedContext.dispose();

    expect(status, 'requisição sem auth deve ser 401').toBe(401);
    expect(body.error).toBe(ERROR_MESSAGES.missingAuth);
  });

  test.fail('recusa requisição com token inválido (BUG-005b)', async () => {
    const invalidTokenContext = await playwrightRequest.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: {
        Authorization: 'Bearer token-invalido-12345',
      },
    });

    const response = await invalidTokenContext.get(ENDPOINTS.recommendations('s001'));
    const status = response.status();
    const body = await response.json();
    await invalidTokenContext.dispose();

    expect(status, 'requisição com token inválido deve ser 401').toBe(401);
    expect(body.error).toBe(ERROR_MESSAGES.invalidToken);
  });
});
