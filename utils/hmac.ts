import { createHmac } from 'node:crypto';
import { WEBHOOK_SECRET } from '../playwright.config';

/**
 * Gera a assinatura HMAC-SHA256 esperada pelo endpoint de webhook.
 *
 * Espelha a função validateHMAC do lado do servidor (api/main.go, linha 287).
 * O header enviado é `X-Signature-256: sha256=<hex>`.
 */
export function signWebhookBody(body: string, secret: string = WEBHOOK_SECRET): string {
  const mac = createHmac('sha256', secret);
  mac.update(body);
  return `sha256=${mac.digest('hex')}`;
}
