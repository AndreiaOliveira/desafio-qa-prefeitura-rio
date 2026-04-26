import { test, expect } from '@playwright/test';
import { ENDPOINTS, KNOWN_SERVICE_IDS, TOTAL_SERVICES } from '../../../utils/constants';
import { assertIsPaginatedResponse, assertIsService } from '../../../utils/schema';



test.describe('GET /api/v1/services (paginação)', () => {
  test('retorna a primeira página com 10 itens e metadados corretos', async ({ request }) => {
    const response = await request.get(ENDPOINTS.servicesList);

    expect(response.status()).toBe(200);

    const body = await response.json();
    assertIsPaginatedResponse(body);
    expect(body.total).toBe(TOTAL_SERVICES);
    expect(body.page).toBe(1);
    expect(body.per_page).toBe(10);
    expect(body.data).toHaveLength(10);

    
    const returnedIds = body.data.map((s) => s.id);
    expect(returnedIds).toEqual(KNOWN_SERVICE_IDS.slice(0, 10));
  });

  test('retorna o 11º serviço na página 2', async ({ request }) => {
    const response = await request.get(`${ENDPOINTS.servicesList}?page=2`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    assertIsPaginatedResponse(body);
    expect(body.page).toBe(2);
    expect(body.data).toHaveLength(1);
    assertIsService(body.data[0]);
    expect(body.data[0].id).toBe('s011');
    expect(body.data[0].title).toContain('Bolsa Família');
  });

  test.fail('total_pages reflete o número correto de páginas (BUG-003)', async ({ request }) => {
  
    const response = await request.get(ENDPOINTS.servicesList);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.total).toBe(TOTAL_SERVICES);
    expect(body.total_pages, 'com 11 itens e per_page=10, total_pages deve ser 2').toBe(2);
  });
});
