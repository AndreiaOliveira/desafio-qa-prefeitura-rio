import { test, expect } from '@playwright/test';
import { ENDPOINTS } from '../../../utils/constants';
import { assertIsService } from '../../../utils/schema';


test.describe('POST /api/v1/services/search', () => {
  test('retorna apenas serviços correspondentes à palavra-chave informada', async ({ request }) => {
    const response = await request.post(ENDPOINTS.search, {
      data: { query: 'vacina' },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.query).toBe('vacina');
    expect(body.total).toBe(1);
    expect(body.results).toHaveLength(1);
    assertIsService(body.results[0]);
    expect(body.results[0].id).toBe('s002');
  });

  test('retorna lista vazia quando nenhum serviço corresponde à query', async ({ request }) => {
    const response = await request.post(ENDPOINTS.search, {
      data: { query: 'zzznonexistentzzz' },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.total).toBe(0);
    
    expect(body.results === null || body.results?.length === 0).toBe(true);
  });

  test('recusa JSON malformado com 400', async ({ request }) => {
    const response = await request.post(ENDPOINTS.search, {
      data: 'this is not json',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBe('invalid JSON body');
  });

  test.fail('recusa query vazia com 400 (BUG-002a)', async ({ request }) => {
 
    const response = await request.post(ENDPOINTS.search, {
      data: { query: '' },
    });

    expect(response.status(), 'query vazia deve ser rejeitada').toBe(400);
  });

  test.fail('recusa ausência do campo query com 400 (BUG-002b)', async ({ request }) => {
   
    const response = await request.post(ENDPOINTS.search, {
      data: {},
    });

    expect(response.status(), 'body sem campo query deve ser rejeitado').toBe(400);
  });
});
