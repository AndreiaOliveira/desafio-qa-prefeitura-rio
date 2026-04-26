# Exploração da API — Catálogo de Serviços Públicos

**Data da exploração:** 23/04/2026
**Versão da API:** 1.0.0
**Método:** cURL manual + leitura do código-fonte (`api/main.go`)

## Ambiente

- **URL base:** `http://localhost:8080`
- **Auth:** `Authorization: Bearer qa-challenge-token`
- **Webhook secret:** `webhook-secret-2024` (HMAC-SHA256 em header `X-Signature-256`)
- **Stack da API:** Go 1.24 + Gin + armazenamento em memória (sem banco)
- **Subida:** `docker compose up -d` (1 serviço: `catalog-api`)

## Endpoints mapeados

| Método | Rota | Auth | Observações |
|---|---|---|---|
| GET | `/health` | Não | Retorna `{services, status, timestamp, version}` |
| GET | `/api/v1/services` | Não (público por design) | Paginado: `page`, `per_page` |
| GET | `/api/v1/services/:id` | Não (público por design) | 500 em ID inexistente (BUG-001) |
| POST | `/api/v1/services/search` | Não | Body: `{"query":"..."}`. Query vazia retorna tudo (BUG-002) |
| GET | `/api/v1/services/:id/recommendations` | Não (mas deveria — BUG-005) | |
| POST | `/api/v1/services/:id/favorite` | Sim | 401 sem auth |
| POST | `/api/v1/webhooks/catalog` | HMAC (não valida — BUG-004) | |

## Dataset

11 serviços públicos reais da Prefeitura do Rio (IDs s001 a s011).
Exemplos: Cartão Rio, Vacinação Gratuita, Matrícula Escolar, Bolsa Família.
Campos: id, title, description, category, tags, organization, view_count, active.

## Bugs encontrados

Confirmados por comportamento e por comentários no código em api/main.go:

1. BUG-001 (linha 201) — Detalhe de serviço inexistente retorna 500 em vez de 404
2. BUG-002 (linha 217) — Busca com query vazia retorna 200 com tudo em vez de 400
3. BUG-003 (linha 162) — total_pages usa divisão inteira (floor) em vez de ceil
4. BUG-004 (linha 265) — Webhook lê HMAC mas nunca valida
5. BUG-005 (linha 242) — Recommendations no grupo público (deveria exigir auth)

Detalhes em docs/bugs/.

## Sugestoes de Melhorias

- per_page negativo ou absurdo aceito silenciosamente, sem 400 nem documentação de limite
- Favoritar é aparentemente idempotente mas não há endpoint para verificar
- 404 de rota inexistente retorna text/plain em vez do JSON padronizado
- Mensagem de erro para Authorization sem Bearer idêntica a sem Authorization
