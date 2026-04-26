import { test, expect, request as playwrightRequest } from '@playwright/test';
import { API_BASE_URL } from '../../../playwright.config';
import { ENDPOINTS, ERROR_MESSAGES } from '../../../utils/constants';



type EndpointCase = {
  name: string;
  method: 'GET' | 'POST';
  path: string;
};

const PROTECTED_ENDPOINTS: EndpointCase[] = [
  { name: 'favorite a service', method: 'POST', path: ENDPOINTS.favorite('s001') },
  // BUG-005: o endpoint de recommendations deveria estar aqui mas está
  // público. O teste em auth.spec.ts já cobre esse caso com test.fail.
  // Quando o bug for corrigido, adicionar:
  // { name: 'get recommendations', method: 'GET', path: ENDPOINTS.recommendations('s001') },
];

test.describe('Matriz de autenticação nos endpoints protegidos', () => {
  for (const endpoint of PROTECTED_ENDPOINTS) {
    test(`${endpoint.method} ${endpoint.path} retorna 401 na ausência do header Authorization`, async () => {
      const anonymousContext = await playwrightRequest.newContext({
        baseURL: API_BASE_URL,
        extraHTTPHeaders: {},
      });

      const response = await anonymousContext.fetch(endpoint.path, {
        method: endpoint.method,
      });
      const status = response.status();
      const body = await response.json();
      await anonymousContext.dispose();

      expect(status, `${endpoint.name}: sem auth deve ser 401`).toBe(401);
      expect(body.error).toBe(ERROR_MESSAGES.missingAuth);
    });

    test(`${endpoint.method} ${endpoint.path} retorna 401 com token inválido`, async () => {
      const invalidContext = await playwrightRequest.newContext({
        baseURL: API_BASE_URL,
        extraHTTPHeaders: { Authorization: 'Bearer fake-token-xyz' },
      });

      const response = await invalidContext.fetch(endpoint.path, {
        method: endpoint.method,
      });
      const status = response.status();
      const body = await response.json();
      await invalidContext.dispose();

      expect(status, `${endpoint.name}: token inválido deve ser 401`).toBe(401);
      expect(body.error).toBe(ERROR_MESSAGES.invalidToken);
    });
  }
});
