import { expect } from '@playwright/test';

/**
 * Validadores leves de estrutura de resposta.
 *
 * Optou-se por asserções explícitas em vez de uma lib de schema (zod, ajv)
 * para manter o stack mínimo e porque o dataset é pequeno e estável.
 * Em caso de evolução do catálogo, vale considerar migrar para contract
 * testing com Schemathesis (plano no README).
 */

export type Service = {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  organization: string;
  view_count: number;
  active: boolean;
};

export function assertIsService(obj: unknown): asserts obj is Service {
  expect(obj, 'service must be an object').toBeInstanceOf(Object);
  const s = obj as Record<string, unknown>;
  expect(typeof s.id, 'id must be string').toBe('string');
  expect(typeof s.title, 'title must be string').toBe('string');
  expect(typeof s.description, 'description must be string').toBe('string');
  expect(typeof s.category, 'category must be string').toBe('string');
  expect(Array.isArray(s.tags), 'tags must be array').toBe(true);
  expect(typeof s.organization, 'organization must be string').toBe('string');
  expect(typeof s.view_count, 'view_count must be number').toBe('number');
  expect(typeof s.active, 'active must be boolean').toBe('boolean');
}

export function assertIsPaginatedResponse(
  obj: unknown
): asserts obj is {
  data: Service[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
} {
  expect(obj, 'response must be object').toBeInstanceOf(Object);
  const r = obj as Record<string, unknown>;
  expect(Array.isArray(r.data), 'data must be array').toBe(true);
  expect(typeof r.total, 'total must be number').toBe('number');
  expect(typeof r.page, 'page must be number').toBe('number');
  expect(typeof r.per_page, 'per_page must be number').toBe('number');
  expect(typeof r.total_pages, 'total_pages must be number').toBe('number');
}
