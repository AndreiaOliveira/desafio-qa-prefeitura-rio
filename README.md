# Desafio QA Sênior - Prefeitura do Rio

Suite de testes automatizados desenvolvida para o desafio técnico de Engenheiro(a) de Qualidade Sênior - Automação da Prefeitura do Rio.

A API alvo é um catálogo de serviços públicos em Go (Gin) com 11 serviços em memória, exposto na porta 8080. O código da API e instruções de execução estão em https://github.com/prefeitura-rio/desafio-qa-senior.

## Resultado

62 testes em ~1 segundo, cobrindo happy paths, validações, autenticação, segurança HMAC e cenários adversários. Todos os 6 bugs foram identificados, documentados e cobertos por testes que falham hoje e passam quando o bug for corrigido. Mais 5 variantes adicionais do BUG-001 foram descobertas durante exploração adversaria, e 1 bug adicional (BUG-006) foi descoberto via contract testing - não estava na lista oficial.

---

## Sumário

- Estratégia
- Como executar
- CI/CD
- Stack e justificativas
- Bugs identificados
- Contract testing
- Estrutura do projeto
- Performance (k6)
- Insights e descobertas
- Decisões de design
- Roadmap
- Acessibilidade e inclusão

---

## Estratégia

A suite foi pensada em tres camadas concentricas, priorizando por risco e impacto ao cidadão:

1. Nucleo funcional: todo endpoint tem ao menos um happy path validando contrato (status, schema, semântica). É a primeira linha de defesa contra regressões.
2. Casos negativos e validação: cada parâmetro de entrada tem teste de borda (vazio, ausente, malformado, gigante). Aqui estão a maioria dos bugs plantados.
3. Segurança e adversário: payloads maliciosos (SQL-like, XSS, path traversal, unicode homoglyph), abuso de método HTTP, edge cases de autenticação. Esta camada descobriu 5 variantes adicionais do BUG-001 que não estavam na lista oficial.
4. Resiliência (versão light): comportamento sob cliente adverso (timeout, connection close, concorrência). Versão embrionaria em 3 testes; Toxiproxy é a evolução natural documentada no roadmap.

A priorização seguiu severidade documentada em docs/bugs:

| Severidade | O que protege | Bugs |
|---|---|---|
| Crítica | Integridade do dado, segurança | BUG-004 (HMAC bypass) |
| Alta | Funcionalidade essencial | BUG-001 (crash 500), BUG-005 (auth ausente) |
| Média | UX e completude | BUG-002 (validação), BUG-003 (paginação), BUG-006 (null em vez de array) |

### Estratégia para bugs conhecidos: test.fail

Os bugs plantados são tratados com test.fail() do Playwright. A escolha tem tres motivações:

- CI fica verde mesmo com bugs presentes, não polui sinal de regressão real.
- Detecta correção automáticamente: quando o bug for corrigido, o teste passa a falhar (porque test.fail espera falha), avisando que a marcação precisa ser removida e virar test() regular.
- Documenta o estado real do sistema sem mascarar os problemas.

Cada teste de bug tem comentario explicando o estado atual, comportamento esperado, link para a documentação do bug em docs/bugs/ e comando de reprodução manual com curl.

---

## Como executar

### Pré-requisitos

- Node.js 20+
- Docker e Docker Compose
- k6 (apenas se quiser rodar testes de performance)

### Passo 0 - Subir a API (obrigatório antes dos testes)

A API alvo não está neste repositório (é código de terceiros mantido pela Prefeitura). Você precisa cloná-la em uma pasta paralela:

    # A partir do diretório onde você clonou este repo
    cd ..
    git clone https://github.com/prefeitura-rio/desafio-qa-senior.git
    cd desafio-qa-senior/api
    docker compose up -d

    # Validar que a API subiu corretamente
    curl -s http://localhost:8080/health
    # Saída esperada: {"services":11,"status":"ok",...}

Estrutura de diretórios sugerida após o clone:

    seu-workspace/
    |-- desafio-qa-prefeitura-rio/   <- este repositório (testes)
    `-- desafio-qa-senior/            <- repo da API (clonado acima)
        `-- api/
            |-- docker-compose.yml
            `-- main.go

A API ficara disponível em http://localhost:8080. **Sem isso, todos os testes vao falhar com `connect ECONNREFUSED`.**

### Troubleshooting: testes falhando com ECONNREFUSED

Se ao rodar `npm test` você ver erros como:

    apiRequestContext.get: connect ECONNREFUSED ::1:8080

A API não está rodando. Volte ao Passo 0 e confirme com `curl http://localhost:8080/health`.

### Rodar a suite completa

    npm install
    npm test

Saída esperada: 62 passed em ~2 segundos (45 funcionais + 17 contract).

### Scripts npm disponíveis

    npm test                    # roda toda a suite
    npm run test:list           # lista testes sem executar
    npm run test:ui             # abre o Playwright UI Mode (debug interativo)
    npm run test:security       # apenas suite de segurança
    npm run test:webhook        # apenas suite do webhook (HMAC)
    npm run report              # abre o relatório HTML da ultima execução
    npm run perf:smoke          # k6 smoke (~30s)
    npm run perf:load           # k6 load (~5min)
    npm run perf:stress         # k6 stress (~6min)
    npm run perf:spike          # k6 spike (~2min20s)

### Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| API_BASE_URL | http://localhost:8080 | URL base da API |
| API_TOKEN | qa-challenge-token | Token Bearer para endpoints protegidos |
| WEBHOOK_SECRET | webhook-secret-2024 | Segredo HMAC do webhook |

---

## CI/CD

O projeto inclui um workflow GitHub Actions (`.github/workflows/ci.yml`) que executa automáticamente em cada push e pull request para a branch main.

### O que o workflow faz

O workflow é dividido em dois jobs:

**Job 1: api-tests** (~3 minutos)

1. Faz checkout deste repositório (qa-tests).
2. Faz checkout do repositório upstream `prefeitura-rio/desafio-qa-senior` para ter acesso ao código da API.
3. Sobe a API via Docker Compose com healthcheck retry de 30 segundos.
4. Instala Node.js 20, dependências e Playwright (chromium).
5. Executa toda a suite de testes funcionais.
6. **Gera Markdown Step Summary** com tabela de resultados visível direto na aba Actions: total, passados, falhados, pulados, flaky, duração.
7. Pública como artifacts (retention 30 dias):
   - HTML report completo do Playwright
   - JSON com resultados estruturados (consumível por outros sistemas)
8. Executa cleanup do Docker mesmo se algo falhar.

**Job 2: perf-smoke** (~1 minuto, depende do job 1 passar)

1. Sobe a API novamente.
2. Instala k6 via repositório oficial.
3. Executa o cenário de smoke (1 VU por 30s) com thresholds de SLA.

### Por que esse desenho

- **Clonar o repo upstream da API** evita duplicar código de terceiros e garante que o teste sempre roda contra a versão mais atual da API.
- **Healthcheck com retry** em vez de `sleep` cego garante que o teste só começa quando a API está de fato disponível, eliminando falsos negativos por race condition.
- **Markdown Step Summary** torna o resultado visível sem precisar baixar artifacts ou ler logs - o avaliador ou o time consegue ver o status na hora de revisar a PR.
- **Artifacts com retention de 30 dias** permitem rastreabilidade histórica de qualquer execução.
- **Job de performance separado** com `needs:` faz com que o smoke só rode se os testes funcionais passarem - economiza tempo de runner em PRs com problemas estruturais.

### Critério de sucesso

- CI verde: API saudável, 62 testes passaram (45 funcionais + 17 contract), smoke k6 dentro dos thresholds.
- CI vermelho: qualquer um dos itens acima falhou (a tabela do Step Summary indica exatamente onde).

### Evidências de execução local

A pasta `perf-results/` contém os logs completos das 4 execuções k6 (smoke, load, stress, spike) realizadas durante o desenvolvimento. São 16,2 milhões de requisições processadas com zero falhas, executadas em MacBook Air com a API in-memory rodando localmente. Os arquivos servem como evidência do que está documentado na seção Performance.

---

## Stack e justificativas

### Por que Playwright Test?

A escolha por Playwright Test se baseia em:

- TypeScript de primeira classe: schemas tipados, refactor seguro, autocomplete em útilitarios compartilhados como assertIsService.
- Paralelismo nativo por arquivo com workers configuráveis. Os 42 testes rodam em ~900 ms com 4 workers; rodando serialmente seria ~3 s.
- Fixtures e contextos isolados: cada teste recebe um request context independente, permitindo testar matriz de autenticação sem poluição entre cenários.
- Tracing built-in: trace on-first-retry captura request/response completo de testes que falharam, acelerando triagem.
- Reporters múltiplos simultâneos: list (terminal), html (debug local), json (CI). Sem plugins.
- Mesmo runner para API e UI: se amanha a Prefeitura precisar de E2E web, a equipe não precisa aprender outra ferramenta.


### Por que k6 para performance?

- API CLI declarativa (JavaScript).
- Thresholds nativos como gates de CI.
- Output estruturado fácil de plugar em Grafana/Datadog.
- Curva de aprendizado pequena para quem já escreve Playwright.

---

## Bugs identificados

### Os 6 bugs identificados

| ID | Endpoint | Sintoma | Severidade | Origem |
|---|---|---|---|---|
| BUG-001 | GET /api/v1/services/:id | Retorna 500 em vez de 404 para id inexistente | Alta | Plantado |
| BUG-002 | POST /api/v1/services/search | Aceita query vazia ou ausente, retorna 200 com lista completa | Média | Plantado |
| BUG-003 | GET /api/v1/services | total_pages calculado com floor em vez de ceil | Média | Plantado |
| BUG-004 | POST /api/v1/webhooks/catalog | Validação HMAC nunca é executada | Crítica | Plantado |
| BUG-005 | GET /api/v1/services/:id/recommendations | Endpoint registrado fora do middleware de autenticação | Alta | Plantado |
| BUG-006 | GET /api/v1/services/:id/recommendations | Retorna null em vez de array vazio quando não ha recomendações | Média | **Achado** (contract testing) |

Detalhes completos com reprodução, impacto e hipótese de correção em docs/bugs/ (um arquivo por bug).

### Variantes adicionais descobertas (BUG-001 estendido)

Durante exploração com payloads adversários, descobri que o crash do BUG-001 não se limita a ids inexistentes simples. Ele se manifesta também em:

- IDs com SQL-like injection
- Path traversal url-encoded
- IDs muito longos (5000 chars)
- Unicode homoglyphs
- Whitespace puro

Curiosamente, alguns payloads passam ilesos (XSS literal, path traversal unix), provavelmente porque o roteador Gin os rejeita antes de chegar ao handler. Esse comportamento inconsistente é mais perigoso do que o bug original: da uma falsa sensação de que algumas defesas funcionam.

Esses cenários estão em tests/api/security/negative-cases.spec.ts como test.fail.

### Observações além dos bugs plantados

Documentadas em docs/bugs.md como observações conscientes:

- Endpoint POST /favorite aparenta duplicar entradas internamente (sem listagem para confirmar).
- Erros de rota retornam text/plain em alguns casos quando o esperado seria JSON estruturado.
- Ausência de rate limiting em endpoints públicos como /health (testado com 50 requisições rapidas, latência estável). Risco operacional em produção.

### Achado adicional: BUG-006 (descoberto via contract testing)

Durante a construção da suite de contract testing, descobri um bug que não estava na lista oficial de bugs plantados. O endpoint `GET /services/:id/recommendations` retorna `recommendations: null` em vez de array vazio quando o serviço não tem recomendações associadas (caso de s005).

Por que isso importa:

- **Crash de cliente**: código JS que faz `.map()` ou `.length` em null lanca TypeError. Quebra renderização em produção.
- **Inconsistência interna**: `GET /services` retorna `data: []` quando filtros não casam, mas `/recommendations` retorna `null` no caso analogo.
- **Tipo de defeito que happy path não pega**: status é 200, payload existe, parser não quebra, teste tradicional passa. É um exemplo perfeito do valor de contract testing.

Documentado em [docs/bugs/BUG-006.md](docs/bugs/BUG-006.md). Coberto por teste automatizado em `tests/contract/recommendations-schema.spec.ts`.

---

## Contract testing

A suite inclui um conjunto separado de **17 testes de contract** em `tests/contract/`, configurados como project independente no `playwright.config.ts`. Os testes podem ser rodados isoladamente:

    npm test -- --project=contract

### O que valida

- **Schema do recurso Service**: padrão de id (regex), campos obrigatórios, tipos, view_count não-negativo, tags não-vazias, consistência entre listagem e detalhe.
- **Paginação**: tipos numéricos inteiros, valores não-negativos, total real bate com declarado, ausência de duplicatas entre páginas, e a invariante matemática `total_pages = ceil(total / per_page)` (que falha pelo BUG-003).
- **Recommendations**: wrapping `{recommendations, service_id}`, schema completo de cada item, serviço não recomenda a si mesmo, ids recomendados existem no catálogo, e ausência de retorno null em listas vazias (que falha pelo BUG-006).

### Como evolui

A versão atual valida contratos descobertos durante exploração manual. A evolução natural é integrar [Schemathesis](https://schemathesis.readthedocs.io/), que le um spec OpenAPI e gera centenas de casos de teste automáticamente, incluindo combinações de input que humanos não pensam. Documentado no roadmap.

---

## Estrutura do projeto

    qa-tests/
    |-- tests/api/
    |   |-- services/
    |   |   |-- detail.spec.ts          BUG-001 + happy path
    |   |   |-- pagination.spec.ts      BUG-003 + paginação valida
    |   |   `-- auth-matrix.spec.ts     matriz auth nos endpoints protegidos
    |   |-- search/
    |   |   `-- validation.spec.ts      BUG-002 + validação de input
    |   |-- webhook/
    |   |   `-- security.spec.ts        BUG-004 + assinatura HMAC valida
    |   |-- recommendations/
    |   |   `-- auth.spec.ts            BUG-005 + auth valida
    |   |-- favorite/
    |   |   `-- favorite.spec.ts        idempotência observável
    |   |-- health/
    |   |   `-- health.spec.ts          contrato + SLA
    |   |-- security/
    |   |   `-- negative-cases.spec.ts  payloads adversários, method enforcement, rate limiting
    |   `-- resilience/
    |       `-- resilience.spec.ts      timeouts, connection close, concorrência (versão light, ver roadmap)
    |-- tests/contract/                  contract testing (project Playwright separado)
    |   |-- services-schema.spec.ts      schema rigoroso de Service
    |   |-- pagination-schema.spec.ts    contratos de paginação + invariantes
    |   `-- recommendations-schema.spec.ts wrapping, service_id, BUG-006 (achado)
    |-- útils/
    |   |-- constants.ts                ENDPOINTS, IDs, mensagens
    |   |-- hmac.ts                     assinatura SHA-256 do webhook
    |   `-- schema.ts                   asserts tipados
    |-- perf/
    |   |-- smoke.js                    1 VU, 30 s
    |   |-- load.js                     50 VUs, 5 min
    |   |-- stress.js                   100 a 300 VUs
    |   `-- spike.js                    10 a 500 a 10 VUs
    |-- docs/
    |   |-- api-exploration.md          mapeamento exploratório inicial
    |   |-- bugs.md                     resumo executivo
    |   `-- bugs/                       relatório detalhado por bug
    |-- playwright.config.ts
    `-- README.md

---

## Performance (k6)

Os 4 cenários cobrem dimensões diferentes do comportamento sob carga:

| Cenário | VUs | Duração | Pergunta que responde |
|---|---|---|---|
| smoke | 1 | 30 s | A API responde sem pressao? |
| load | 50 sustentados | 5 min | Como se comporta em carga normal? |
| stress | 100 a 300 | 6 min | Onde começa a degradar? |
| spike | 10 a 500 a 10 | 2 min 20 s | Sobrevive a tráfego subito? |

### Como rodar

    k6 run perf/smoke.js     # ~30 s
    k6 run perf/load.js      # ~5 min
    k6 run perf/stress.js    # ~6 min
    k6 run perf/spike.js     # ~2 min 20 s

    # customizar URL ou token
    k6 run -e API_BASE_URL=http://staging perf/load.js

### Justificativa dos thresholds

Os thresholds do smoke e load (p(95) < 500ms, p(99) < 1000ms) seguem as User-Centric Performance Metrics do Google, adaptadas para APIs transacionais. A premissa é que respostas acima de 1 s afetam percepção de fluidez do usuário final, e tráfego significativo acima de 500 ms começa a comprometer Time To Interactive em telas que dependem da API.

Os thresholds de stress (p(95) < 2000ms, failed < 5%) e spike (p(95) < 3000ms, failed < 10%) são deliberadamente mais permissivos. O proposito desses cenários não é passar limpo, é encontrar o ponto onde o sistema começa a degradar, para informar dimensionamento de produção e configuração de auto-scaling.

### Volume de carga: por que 50 VUs?

O Rio tem ~6,7 milhões de habitantes. Para um portal de catálogo de serviços públicos com adoção razoável, uma estimativa conservadora de DAU é 50 a 100 mil. Distribuido ao longo do dia com pico em horario comercial, isso projeta ~50 usuários simultâneos sustentados como carga normal.

### Resultados executados

Os 4 cenários foram executados localmente em MacBook Air M2 com Docker. Resumo:

| Cenário | VUs | Duração | Total req | Throughput | p(95) | Falhas |
|---|---|---|---|---|---|---|
| Smoke | 1 | 30s | 75.806 | 2.5k req/s | 427us | 0% |
| Load | 50 | 5min | 5.659.413 | 18.8k req/s | 5.15ms | 0% |
| Stress | 100 a 300 | 7min | 7.249.857 | 17.2k req/s | 21.75ms | 0% |
| Spike | 10 a 500 a 10 | 2min20s | 3.223.814 | 23k req/s | 27.74ms | 0% |

Total: 16.2 milhões de requisições processadas, zero falhas em todos os cenários.

### Leitura crítica dos resultados

Os números acima são excelentes em valor absoluto, mas precisam ser lidos com contexto:

- A API é in-memory (sem banco, sem cache externo, sem rede entre serviços). Em produção, com banco real e latência de rede, esses tempos seráo ordens de magnitude maiores. Os cenários stress e spike são mais informativos do que o smoke para dimensionamento real.

- Os thresholds atuais (smoke/load com p(95) < 500ms, stress < 2000ms, spike < 3000ms) são folgados demais para esta implementação específica: a API responde em microssegundos. Os testes passam, mas não exercitam o sistema o suficiente para encontrar o ponto de quebra real.

- Em uma próxima iteração, com a API conectada a um banco real, os thresholds devem ser recalibrados com base em medição baseline (rodar o load uma vez, observar o p(95) real, definir threshold em p(95) * 1.2 a 1.5).

- O fato da API aguentar 500 VUs simultâneos no laptop sem degradação sugere que o limite de hardware ainda não foi atingido. Em produção com hardware decente, o ponto de quebra provavelmente está bem acima disso.

Esta leitura faz parte do que considero entregar testes de performance de verdade: não basta o teste passar, precisa estar exercitando o sistema o suficiente para gerar sinal útil. Os 4 cenários estão prontos para serem reaproveitados quando a API tiver banco e rede reais.

---

## Insights e descobertas

Esta seção consolida o que aprendi durante a construção da suite e a execução dos cenários de carga. São observações estruturais que vao além da lista de bugs plantados.

### Da automação da API

1. **Inconsistência defensiva**: alguns payloads adversários (XSS literal, path traversal unix) são rejeitados pelo router antes do handler, enquanto outros (SQL-like, unicode homoglyph) chegam ao código vulnerável e crasham. Isso é mais perigoso que ter zero defesa, pois cria falsa sensação de proteção em revisoes superficiais.

2. **Controle de acesso por registro caso-a-caso**: o BUG-005 (endpoint de recommendations no grupo público) revela que a separação entre rotas autenticadas e não-autenticadas é feita endpoint por endpoint, em vez de aplicada por convenção clara (ex: middleware por path prefix). Esse padrão é frágil, é o tipo de bug que vai ser introduzido de novo no futuro mesmo após correção.

3. **Mensagens de erro de auth não diferenciam ausência vs malformação**: header Authorization ausente e header com formato errado (Basic em vez de Bearer) retornam a mesma mensagem "missing authorization header". Isso dificulta o trabalho do integrador, que não sabe se o problema é "esqueci o header" ou "formato está errado".

4. **Idempotência declarada mas não verificável**: POST /favorite retorna sempre "added to favorites", mesmo em chamadas repetidas com o mesmo id. Sem endpoint GET /favorites, não da para confirmar se a API duplica internamente. Isso é divida técnica de observabilidade, a operação aparenta funcionar mas não pode ser auditada.

5. **total_pages quebrado revelou uma função invisível**: o BUG-003 só foi detectável porque o teste compara total_pages com a quantidade real de páginas existentes. Sem esse cruzamento, o bug passaria, e os usuários nunca veriam o serviço s011 (Bolsa Família) se o frontend respeitar o contrato. É o tipo de defeito silencioso onde a falta de teste se traduz em exclusão social literal: o serviço está no catálogo, mas não chega ao cidadão.

### Da performance (k6)

1. **Latência absoluta vs cauda**: no cenário load (50 VUs sustentados), o p(95) foi 5ms, mas o max foi 244ms, uma cauda 50x maior que a mediana. Em sistemas de catálogo público com pico horario, é essa cauda que o cidadão "azarado" sente. Vale considerar p(99) ou p(99.9) como threshold complementar em iterações futuras, especialmente para validar comportamento sob redes moveis instáveis.

2. **Escalabilidade quase linear ate 500 VUs**: o throughput foi 2.5k req/s com 1 VU, 18.8k com 50 VUs, e 23k com 500 VUs. O ganho marginal cai bastante de 50 para 500 VUs (apenas 22% mais throughput com 10x mais VUs), sugerindo que o limite começa em algum lugar nessa faixa. Para mapear o ponto exato, valeria adicionar cenários intermediários (75, 100, 150, 200 VUs).

3. **Zero falhas em 16,2 milhões de requisições** é resultado da implementação Go in-memory sem I/O externo. É exatamente o cenário que esconde problemas reais: se o teste passa nessas condições, ele provavelmente não vai detectar regressão quando a API ganhar banco. A suite k6 deveria ser re-executada e os thresholds recalibrados toda vez que uma camada nova for adicionada a arquitetura: banco, cache, autenticação real, rate limiter.

4. **Comportamento estável em testes longos**: nos cenários load (5min) e stress (7min) não houve crescimento descontrolado de latência ou degradação progressiva. Isso sugere ausência de memory leaks obvios e estabilidade interna. Util para ops, embora a confirmação demande métricas diretas de container (memória, GC pauses), que não foram coletadas neste exercicio.

5. **Health endpoint sob 50 requisições rapidas**: o teste de "ausência de rate limiting" no /health rodou 50 req consecutivas em ~80ms. Em produção, isso significa que não ha proteção contra abuso desse endpoint, um atacante pode usa-lo para causar pressão sem custar autenticação. Não é bug do desafio, mas é risco operacional documentado.

---

## Decisões de design

### Comentarios explicativos no código

Cada teste de bug tem comentario explicando o estado atual, comportamento esperado após correção, comando de reprodução manual com curl e link para a documentação detalhada do bug. A intenção é que um membro novo da equipe consiga entender em 30 segundos o que cada teste protege.

### Helpers em útils/

- constants.ts centraliza IDs conhecidos, URLs de endpoint e mensagens de erro. Mudanca unica se a API renomear "service not found" para outra coisa.
- hmac.ts encapsula a assinatura SHA-256 do webhook (Node crypto nativo, zero dependência externa). Garante que cada teste assina com a mesma lógica que a API espera.
- schema.ts tem assertIsService e assertIsPaginatedResponse com type guards. Validação de schema sem dependência externa.

### Configuração do playwright.config.ts

- Token Bearer e Content-Type ficam em extraHTTPHeaders globalmente, não poluem cada teste.
- retries: 2 no CI captura instabilidades de rede sem mascarar falhas reais (que precisam falhar 3x).
- trace: on-first-retry evita custo de tracing em runs verdes mas captura dados quando algo falha.
- Dois projects independentes ("api" e "contract") permitem rodar cada categoria isoladamente em CI: testes funcionais, schema rigoroso, ou ambos. Espaco preparado para adicionar contract-strict (Schemathesis) e resilience-toxiproxy quando evoluirem do roadmap.

### Test data management e isolation

A suite segue 4 estratégias complementares de isolation, escolhidas conforme a natureza de cada teste:

**1. Isolamento por fixture do Playwright (default)**

Cada teste recebe automáticamente uma fixture `request` que cria um contexto HTTP novo no escopo de teste. Headers de auth, cookies e estado de conexão são isolados. Isso vem "de graca" pelo runner.

**2. Contexto HTTP custom para cenários de auth**

Em `tests/api/services/auth-matrix.spec.ts` e nos testes de recommendations sem token, criamos contextos HTTP explícitos com `playwright.request.newContext()` removendo headers de auth. Isso garante que o teste de "401 sem auth" não herda credenciais do contexto global.

**3. Isolation por dado (data partitioning)**

Para endpoints que mutam estado (POST /favorite), cada teste usa um service_id diferente (s002 no primeiro, s003 no segundo). Como a API não expoe endpoint para limpar favoritos, isolation acontece pelo próprio dado: testes não se sobrepoem porque operam em recursos diferentes.

**4. Idempotência por design**

Endpoints de leitura (GET /services, /search, /health, /recommendations) são naturalmente idempotentes. Multiplos testes podem ler em qualquer ordem sem afetar uns aos outros. Não precisam de isolation além do que a fixture já oferece.

### Por que não usamos beforeEach() de cleanup

A escolha foi consciente. A API in-memory atual não expoe endpoint para resetar estado (não ha DELETE /favorites, por exemplo). Adicionar `beforeEach()` que tenta "limpar" sem ter endpoint adequado seria teatro de qualidade: parece que isola, mas na verdade não faz nada efetivo.

Em projeto real com banco transacional, a abordagem natural seria:
- `beforeEach()` abre transação
- `afterEach()` faz rollback
- Cada teste começa com estado limpo

Como não temos essa garantia, a alternativa mais honesta foi documentar a estratégia atual (data partitioning) e deixar claro no roadmap que o passo seguinte é um endpoint administrativo de reset (ou banco com transações).

---

## Roadmap

Próximos passos que faria com mais tempo, em ordem de retorno por esforco:

### 1. Contract testing com Schemathesis

Hoje os testes validam contrato endpoint a endpoint, manualmente. Schemathesis le um spec OpenAPI e gera centenas de casos automáticamente, incluindo combinações que humanos esquecem. Adicionar como projeto separado no playwright.config.ts ou como step independente no CI.

### 2. Resilience testing avancado com Toxiproxy

Ja existe uma suite embrionaria em `tests/api/resilience/` cobrindo timeout do cliente, conexões sem keep-alive e concorrência localizada (3 testes, todos verdes). A evolução natural é integrar Toxiproxy como proxy entre cliente e API, permitindo simular latência injetada, packet loss, slow read, slow write e drop de conexão no meio do payload. Crítico em contexto público onde fração significativa do tráfego vem de redes moveis instáveis. Implementação: subir toxiproxy via docker-compose, apontar a suite atual para a porta proxiada, adicionar projeto Playwright específico para cenários degradados.

### 3. Mutation testing

Rodar Stryker.js sobre a base de testes. Mede se a suite realmente detecta mudanças no código alvo, ou se está só passando por cima. É a métrica honesta de qualidade de cobertura: testes verdes não significam código testado.

### 4. Observabilidade no CI

Métricas do Playwright (duração por teste, taxa de retry) para um Prometheus / Grafana. Detectar testes flaky antes que viram problema cultural.

---

## Acessibilidade e inclusão

Um portal de serviços públicos do Rio penso que é acessado por toda a população: pessoas com fibra de 500 Mb/s e celular novo, mas também por quem tem 3G instável em comunidade de baixa renda, leitor de tela, ou aparelho antigo com pouca memória.

### Dimensões analogas cobertas pela suite de teste

| Dimensão | Por que importa para inclusão | Como está coberto |
|---|---|---|
| **Contratos previsíveis** | Cliente com app antigo não consegue lidar com mudanças surpresa de schema. Quebrar contrato implicito quebra UX silenciosamente. | 17 testes de contract em `tests/contract/` |
| **Tratamento gracioso de erro** | Stack trace ou erro 500 sem corpo confunde usuário que já tem dificuldade. Pior em rede movel: re-tenta sem precisar. | `tests/api/security/negative-cases.spec.ts` valida ausência de panic |
| **Latência p99 e cauda** | p(95) é "usuário típico"; p(99) é "usuário com pior conexão". Em política pública, a cauda não é nicho - é o cidadão mais vulnerável. | k6 load define p(99) < 1000ms além do p(95) |
| **Resiliência a rede ruim** | Conexoes moveis caem, perdem pacotes, fecham TCP a cada request. API tem que aguentar. | 3 testes em `tests/api/resilience/` (timeout, connection close, concorrência) |
| **Disponibilidade sob carga** | Pico de tráfego (campanha, noticia) não pode derrubar o serviço para quem mais precisa. | k6 stress + spike, 500 VUs sem falhas |

### Coberto agora vs roadmap

| Item | Coberto | Roadmap |
|---|---|---|
| Contratos validados via type guards e regex | sim | Schemathesis com OpenAPI gera centenas de casos automáticamente |
| Latência p(95) e p(99) com thresholds | sim | Adicionar p(99.9) e cenários com latência injetada (Toxiproxy) |
| Erros sem stack trace | sim | Validar ausência de PII em logs e mensagens |
| Resiliência: timeout, connection close, concorrência | sim (light) | Toxiproxy completo com slow read, packet loss, drop de conexão |
| Tamanho de payload por endpoint | não | Threshold: alertar se response > 50KB ou > 500ms parsing |
| Logs estruturados acessíveis para SRE | não | Validar formato JSON nos logs (parseável por tooling de operação) |


---