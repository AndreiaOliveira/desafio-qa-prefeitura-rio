# Bugs Encontrados

Resumo dos bugs identificados durante a exploração e testes da API do Catálogo de Serviços Públicos.

Confirmados tanto pelo **comportamento observado** em testes manuais, quanto pela **análise do código-fonte** (`api/main.go`), que contém comentários `// BUG-00X` marcando cada defeito intencional.

## Resumo

| ID | Severidade | Endpoint | Descrição | Detalhes |
|---|---|---|---|---|
| [BUG-001](bugs/BUG-001.md) | Alta | `GET /api/v1/services/:id` | Retorna 500 (nil pointer) em vez de 404 para ID inexistente | [ver](bugs/BUG-001.md) |
| [BUG-002](bugs/BUG-002.md) | Média | `POST /api/v1/services/search` | Query vazia retorna 200 com todos os serviços em vez de 400 | [ver](bugs/BUG-002.md) |
| [BUG-003](bugs/BUG-003.md) | Média | `GET /api/v1/services` | `total_pages` calculado com divisão inteira (floor) em vez de ceil | [ver](bugs/BUG-003.md) |
| [BUG-004](bugs/BUG-004.md) | Crítica | `POST /api/v1/webhooks/catalog` | Lê assinatura HMAC mas nunca valida | [ver](bugs/BUG-004.md) |
| [BUG-005](bugs/BUG-005.md) | Alta | `GET /api/v1/services/:id/recommendations` | Endpoint no grupo público, sem exigência de auth | [ver](bugs/BUG-005.md) |
| [BUG-006](bugs/BUG-006.md) | Média | `GET /api/v1/services/:id/recommendations` | Retorna `null` em vez de `[]` quando não há recomendações (achado, não plantado) | [ver](bugs/BUG-006.md) |

## Critério de severidade

- **Crítica** — Vulnerabilidade de segurança explorável, perda de dados, ou impossibilidade de uso do serviço
- **Alta** — Falha funcional que impacta diretamente o usuário ou permite acesso indevido
- **Média** — Comportamento incorreto que confunde o consumidor ou quebra contratos, mas tem workaround
- **Baixa** — Inconsistência cosmética, mensagem de erro confusa, documentação incorreta

## Observações não classificadas como bug

Comportamentos questionáveis que não estão marcados como BUG no código-fonte, mas são sugestões de melhoria para o time de desenvolvimento:

1. **Paginação aceita valores inválidos silenciosamente**
   `per_page=-1` ou `per_page=999999` são aceitos sem retornar 400 e sem aplicar limites documentados. Recomenda-se validar e responder com 400 Bad Request, ou aplicar teto máximo documentado (ex: `per_page <= 100`).

2. **Idempotência de favoritar não verificável**
   `POST /services/:id/favorite` sempre retorna `"added to favorites"`, mesmo em chamadas repetidas. Sem endpoint `GET /favorites`, não é possível verificar se há duplicação interna. Recomenda-se expor listagem ou retornar status diferenciado (`"already favorited"`) em chamadas repetidas.

3. **Rota inexistente retorna erro em formato diferente**
   Rotas não mapeadas retornam `Content-Type: text/plain` com `"404 page not found"` (comportamento default do Gin), enquanto a API em geral retorna JSON padronizado `{"error": "..."}`. Recomenda-se adicionar `NoRoute` handler para consistência.

4. **Mensagens de erro de autenticação ambíguas**
   Header `Authorization` ausente e `Authorization` sem prefixo `Bearer` retornam a mesma mensagem `"missing authorization header"`. Recomenda-se diferenciar para facilitar o diagnóstico do integrador (ex: `"invalid authorization format"` quando o header existe mas o formato é inválido).

## Variantes adicionais descobertas durante exploração

Cinco variantes do BUG-001 (HTTP 500 quando o handler tenta acessar um serviço que não existe) foram identificadas via testes adversariais e estão documentadas em [BUG-001.md](bugs/BUG-001.md#variantes-adicionais-descobertas):

- IDs com SQL-like injection
- Path traversal url-encoded
- IDs muito longos (5000+ chars)
- Unicode homoglyphs
- Whitespace puro

A correção do BUG-001 deve resolvê-las simultaneamente.

## Cobertura por testes

Todos os 5 bugs plantados têm pelo menos um teste em `tests/api/` que falha hoje e passa quando o bug for corrigido (`test.fail` do Playwright). As 4 observações acima ainda não têm cobertura — ficaram como recomendações para discussão com o time de desenvolvimento, dado que não está claro qual a intenção de design (ex: limite de `per_page` deve ser quanto?).
