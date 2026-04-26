/**
 * Constantes compartilhadas entre os testes.
 *
 * Centralizar IDs conhecidos, mensagens de erro esperadas e endpoints em
 * um único lugar evita "string mágica" espalhada pelos specs e torna trivial
 * atualizar quando a API muda.
 */

export const KNOWN_SERVICE_IDS = [
  's001', 's002', 's003', 's004', 's005', 's006',
  's007', 's008', 's009', 's010', 's011',
] as const;

export const TOTAL_SERVICES = KNOWN_SERVICE_IDS.length;

export const NON_EXISTENT_SERVICE_ID = 'no-such-service-12345';

export const ENDPOINTS = {
  health: '/health',
  servicesList: '/api/v1/services',
  serviceDetail: (id: string) => `/api/v1/services/${id}`,
  search: '/api/v1/services/search',
  recommendations: (id: string) => `/api/v1/services/${id}/recommendations`,
  favorite: (id: string) => `/api/v1/services/${id}/favorite`,
  webhook: '/api/v1/webhooks/catalog',
} as const;

export const ERROR_MESSAGES = {
  missingAuth: 'missing authorization header',
  invalidToken: 'invalid token',
  serviceNotFound: 'service not found',
  invalidJSON: 'invalid JSON body',
} as const;
