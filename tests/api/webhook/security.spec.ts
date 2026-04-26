import { test, expect } from '@playwright/test';
import { ENDPOINTS } from '../../../utils/constants';
import { signWebhookBody } from '../../../utils/hmac';

/**
 * Testes de segurança do endpoint POST /api/v1/webhooks/catalog
 *
 * Este é o bug mais crítico do sistema (severidade alta por impacto em
 * segurança). O webhook lê o header X-Signature-256 mas nunca valida
 * a assinatura, aceitando qualquer requisição.
 *
 * Cobre:
 *  - Happy path (com token, via middleware global): é uma rota pública
 *  - BUG-004a: requisição sem assinatura deveria ser 401, retorna 200
 *  - BUG-004b: assinatura arbitrária inválida deveria ser 401, retorna 200
 *  - BUG-004c: assinatura assinada com secret errado deveria ser 401,
 *             retorna 200 (confirma que não há validação alguma)
 *  - Teste de contrato pós-correção: com assinatura válida, deve ser 200
 *
 * Ver docs/bugs/BUG-004.md.
 */

test.describe('POST /api/v1/webhooks/catalog (segurança HMAC)', () => {

  const body = JSON.stringify({ event: 'catalog.updated', service_id: 's001' });

  test.fail('recusa requisição sem o header X-Signature-256 (BUG-004a)', async ({ request }) => {
 
    const response = await request.post(ENDPOINTS.webhook, {
      headers: { 'Content-Type': 'application/json' },
      data: body,
    });

    expect(response.status(), 'requisição sem assinatura deve ser 401').toBe(401);
  });

  test.fail('recusa requisição com assinatura inválida (BUG-004b)', async ({ request }) => {
  
    const response = await request.post(ENDPOINTS.webhook, {
      headers: {
        'Content-Type': 'application/json',
        'X-Signature-256': 'sha256=abc123',
      },
      data: body,
    });

    expect(response.status(), 'assinatura inválida deve ser 401').toBe(401);
  });

  test.fail('recusa requisição assinada com secret incorreto (BUG-004c)', async ({ request }) => {
  
    const wrongSecret = 'this-is-not-the-real-secret';
    const signature = signWebhookBody(body, wrongSecret);

    const response = await request.post(ENDPOINTS.webhook, {
      headers: {
        'Content-Type': 'application/json',
        'X-Signature-256': signature,
      },
      data: body,
    });

    expect(response.status(), 'assinatura com secret errado deve ser 401').toBe(401);
  });

  test('aceita requisição com assinatura HMAC-SHA256 válida', async ({ request }) => {
 
    const signature = signWebhookBody(body);

    const response = await request.post(ENDPOINTS.webhook, {
      headers: {
        'Content-Type': 'application/json',
        'X-Signature-256': signature,
      },
      data: body,
    });

    expect(response.status(), 'assinatura válida deve ser aceita').toBe(200);

    const responseBody = await response.json();
    expect(responseBody.status).toBe('accepted');
  });
});
