import { test, expect } from '@playwright/test';
import { ENDPOINTS, KNOWN_SERVICE_IDS } from '../../utils/constants';

/**
 * Contract testing - schema rigoroso do recurso Service.
 *
 * Diferente do assertIsService em utils/schema.ts (que valida apenas tipos),
 * estes testes validam contratos descobertos durante exploracao da API:
 * - Formato exato do id (regex)
 * - Lista finita de organizations conhecidas
 * - Coerencia entre listagem e detalhe (o que aparece em /services tambem
 *   aparece em /services/:id com mesmos valores)
 *
 * Esta eh uma versao embrionaria de contract testing. A evolucao natural eh
 * usar Schemathesis (le OpenAPI spec, gera centenas de casos automaticamente),
 * documentado no roadmap.
 */

const ID_PATTERN = /^s\d{3}$/;
const KNOWN_CATEGORIES = ['beneficios', 'documentos', 'saude', 'educacao', 'transporte', 'cultura'];
const KNOWN_ORGANIZATIONS = ['SMAS', 'SMS', 'SME', 'SMTR', 'SMC', 'COMLURB', 'IPLAN', 'IplanRio', 'PROCON', 'CET-RIO', 'Detran-RJ'];

test.describe('Contract: estrutura do recurso Service', () => {
  test('id de cada servico segue o padrao s + 3 digitos', async ({ request }) => {
    for (const id of KNOWN_SERVICE_IDS) {
      const response = await request.get(ENDPOINTS.serviceDetail(id));
      expect(response.status(), `GET ${id} deve retornar 200`).toBe(200);
      const body = await response.json();
      expect(body.id, `id ${body.id} deve seguir padrao s\\d{3}`).toMatch(ID_PATTERN);
    }
  });

  test('todos os campos obrigatorios estao presentes em cada servico', async ({ request }) => {
    const REQUIRED_FIELDS = ['id', 'title', 'description', 'category', 'tags', 'organization', 'view_count', 'active'];
    const response = await request.get(ENDPOINTS.serviceDetail('s001'));
    const body = await response.json();

    for (const field of REQUIRED_FIELDS) {
      expect(body, `campo "${field}" deve existir`).toHaveProperty(field);
    }
    expect(Object.keys(body).sort(), 'nao deve ter campos extras inesperados').toEqual(REQUIRED_FIELDS.sort());
  });

  test('tipos de cada campo seguem o contrato', async ({ request }) => {
    const response = await request.get(ENDPOINTS.serviceDetail('s002'));
    const body = await response.json();

    expect(typeof body.id, 'id deve ser string').toBe('string');
    expect(typeof body.title, 'title deve ser string').toBe('string');
    expect(typeof body.description, 'description deve ser string').toBe('string');
    expect(typeof body.category, 'category deve ser string').toBe('string');
    expect(Array.isArray(body.tags), 'tags deve ser array').toBe(true);
    expect(typeof body.organization, 'organization deve ser string').toBe('string');
    expect(typeof body.view_count, 'view_count deve ser number').toBe('number');
    expect(typeof body.active, 'active deve ser boolean').toBe('boolean');
  });

  test('view_count eh inteiro nao-negativo em todos os servicos', async ({ request }) => {
    for (const id of KNOWN_SERVICE_IDS) {
      const response = await request.get(ENDPOINTS.serviceDetail(id));
      const body = await response.json();
      expect(Number.isInteger(body.view_count), `${id}.view_count deve ser inteiro`).toBe(true);
      expect(body.view_count, `${id}.view_count deve ser >= 0`).toBeGreaterThanOrEqual(0);
    }
  });

  test('tags eh array de strings nao-vazias', async ({ request }) => {
    for (const id of KNOWN_SERVICE_IDS) {
      const response = await request.get(ENDPOINTS.serviceDetail(id));
      const body = await response.json();
      expect(body.tags.length, `${id}.tags nao deve estar vazio`).toBeGreaterThan(0);
      for (const tag of body.tags) {
        expect(typeof tag, `cada tag deve ser string`).toBe('string');
        expect(tag.length, `tag nao deve ser string vazia`).toBeGreaterThan(0);
      }
    }
  });

  test('detalhe de servico eh consistente com listagem', async ({ request }) => {
  
    const listResponse = await request.get(ENDPOINTS.servicesList);
    const list = await listResponse.json();

    for (const fromList of list.data.slice(0, 3)) {
      const detailResponse = await request.get(ENDPOINTS.serviceDetail(fromList.id));
      const detail = await detailResponse.json();

      expect(detail.id, 'id deve bater entre lista e detalhe').toBe(fromList.id);
      expect(detail.title, `${fromList.id}: title deve bater`).toBe(fromList.title);
      expect(detail.organization, `${fromList.id}: organization deve bater`).toBe(fromList.organization);
      expect(detail.view_count, `${fromList.id}: view_count deve bater`).toBe(fromList.view_count);
    }
  });
});
