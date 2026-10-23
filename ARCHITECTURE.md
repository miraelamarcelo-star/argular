# 3EATCRU MASTER ARCHITECTURE

**Platform First · Apps Second**

Documento-mestre de arquitetura para projetos 3eatcru
Versão: 2.0 | Status: Referência arquitetural | Data: 13 de setembro de 2026

---

## 1. Propósito

Este documento define a arquitetura-mestre que deverá servir como padrão estrutural para projetos do ecossistema 3eatcru.

A arquitetura prioriza:

- uma plataforma/OS independente;
- extensibilidade por aplicativos via contratos;
- separação entre Control Plane e Runtime Plane;
- suporte dual Web/Native por adaptadores de infraestrutura;
- operação local-first com sincronização confiável;
- isolamento por tenant, sessão e identidade.

O objetivo é evitar que regras específicas de negócio contaminem o núcleo da plataforma e garantir que a evolução de novos aplicativos não obrigue alterações estruturais no OS.

---

## 2. Princípio fundamental

> **PLATFORM FIRST · APPS SECOND**

O OS/Platform funciona sem os aplicativos. Os aplicativos dependem do OS por meio de contratos e SDKs. O Core não conhece regras específicas de negócio.

Esta é a **Regra de Ouro** da arquitetura. Toda decisão estrutural futura deve ser testada contra ela.

---

## 3. Visão mestre do ecossistema

```text
                        3EATCRU ECOSYSTEM
                               │
              ┌────────────────┴────────────────┐
              │                                 │
          HQ OS                            CLIENT OS
       Control Plane                     Runtime Plane
              │                                 │
          Central                          App Runtime
              │                                 │
              │                    ┌────────────┼────────────┐
              │                    │            │            │
              │                  APP A        APP B        APP C
              │
              └──────────── Ecosystem Services ────────────┐
                                                           │
                                                     WEB / NATIVE
                                                           │
                                          ┌────────────────┴────────────────┐
                                          │                                 │
                                        WEB                              NATIVE
                                          │                                 │
                                     API / HTTP                    IndexedDB / SQLite
                                          │                                 │
                                          └───────────── SYNC ──────────────┘
```

---

## 4. Princípios arquiteturais obrigatórios

- **Independência do Core** — o Platform Core deve inicializar, compilar e operar sem conhecer aplicativos de negócio.
- **Inversão de dependência** — o Core depende de contratos; implementações concretas ficam atrás de adapters/providers.
- **App Runtime** — aplicativos entram na plataforma por manifestos, ciclo de vida, permissões e contratos, não por imports diretos no Shell.
- **Infraestrutura substituível** — Web/API, IndexedDB, SQLite, drivers e outros mecanismos devem ser implementações substituíveis.
- **Local-First/Offline-First** — operações nativas não podem depender da disponibilidade contínua da rede.
- **Persistência real** — estado crítico não deve depender de signals, memória do processo ou localStorage como banco principal.
- **Separação de autoridade** — HQ OS, Client OS, Central, Marketplace Public e aplicativos possuem responsabilidades distintas.
- **Segurança por fronteira** — tenant, sessão, permissões e dados devem ser isolados por identidade e contexto.
- **Observabilidade real** — diagnósticos e health checks devem medir sistemas reais e não declarar saúde por simulação.
- **Compatibilidade controlada** — versões do OS e dos apps devem possuir contratos e regras explícitas de compatibilidade.

---

## 5. Plataforma / Client OS

O Client OS é o ambiente operacional do cliente. Ele fornece os serviços universais necessários para executar aplicativos, armazenar dados, operar dispositivos e continuar funcionando em condições offline.

| Camada | Responsabilidade | Não deve conter |
|---|---|---|
| Kernel / Runtime | Lifecycle, eventos, sessão, erros, segurança, contexto | Regras de vendas, CRM, estoque |
| Shell | Desktop, janelas, taskbar, notificações, configurações | Componentes específicos de POS/CRM |
| Database / Storage | Persistência, transações, migrations, backup, health | Modelos internos de negócio |
| App Runtime | Registry, lifecycle, permissions, manifests, capabilities | Imports estáticos de apps |
| Device / Hardware | Identidade do dispositivo, periféricos, adapters | Lógica de vendas |
| Sync | Outbox, retry, idempotência, conflitos, conectividade | Regras do domínio de cada app |
| Printing | Fila de impressão, jobs, profiles e adapters | Formação de regras comerciais |
| Updates | Versionamento, compatibilidade, download, validação e rollback | Atualização específica de catálogo de um app |

---

## 6. O que fica fora do Client OS

- POS e fechamento de venda
- CRM e fidelidade
- Estoque e WMS
- Financeiro operacional
- Mesas, comandas e KDS
- Clientes finais
- Produtos e catálogo comercial
- Regras específicas de restaurante, varejo ou serviços

Esses domínios pertencem a **aplicativos** que utilizam os serviços do OS.

---

## 7. App Runtime e contratos

```text
   APP
    │
    ▼
OS SDK / OS Contracts
    │
    ▼
3EATCRU OS  ──── Provider / Adapter ────► Infraestrutura
```

O Shell **não deve** importar componentes de cada aplicativo. O runtime deve resolver aplicativos por identidade, manifest, entry point e capacidades declaradas.

### 7.1 Manifest mínimo

```yaml
AppManifest:
  id: string
  name: string
  version: semver
  publisher: string
  entryPoint: url | path
  permissions: [string]
  capabilities: [string]
  dependencies: [{ id, versionRange }]
  osCompatibility: versionRange
  dataNamespace: string
  syncPolicy: per-entity
  settingsSchema: json-schema
  signature / integrity: hash
```

---

## 8. Camada de Contratos (Ports & Adapters)

Esta é a camada que torna o resto da arquitetura verificável. Todo acesso do OS a infraestrutura passa por **interfaces declaradas** em `os/contracts/`. Implementações concretas vivem em `os/adapters/`.

### 8.1 Estrutura de contratos

```text
os/contracts/
├── storage/      IStorage, ITransaction, IMigration, IQuery
├── network/      INetwork, IHttpClient, IConnectivityMonitor
├── auth/         IIdentity, ISession, ITenantContext, IPermission
├── device/       IDevice, IPeripheral, IDeviceIdentity
├── printing/     IPrintQueue, IPrintJob, IPrintAdapter
├── sync/         IOutbox, ISyncEngine, IConflictResolver, IReconciler
├── events/       IEventBus, IEventLog
├── diagnostics/  IHealthCheck, IMetrics, ILogger
└── updates/      IUpdateManager, ICompatibilityResolver
```

### 8.2 Estrutura de adapters

```text
os/adapters/
├── web/          IndexedDB, Fetch, WebAuth, WebUSB, WebPrint
├── native/       SQLite, HTTP nativo, OS auth, drivers, impressoras
└── test/         In-memory, mocks determinísticos
```

### 8.3 Regra de dependência

- **Permitido:** `Core → Contracts → Adapters → Infraestrutura`
- **Proibido:** `Core → Infraestrutura`
- **Proibido:** `App → Driver específico` ou `App → Banco próprio`
- **Proibido:** `App → Adapter` diretamente. O app só conhece `Contracts`.

### 8.4 Consequência prática

Trocar Web por Native **não altera o app** — apenas o adapter resolvido em runtime. Essa é a garantia verificável do item "Consigo trocar Web por Native sem mudar o app" no checklist.

---

## 9. Motor Dual: Web e Native

O mesmo OS roda em dois ambientes com contratos idênticos.

```text
                  3EATCRU OS (Core)
                         │
                os/contracts/ (ports)
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
     adapter/web                   adapter/native
          │                             │
   IndexedDB / Fetch              NativeDatabaseAdapter (Coordinator)
   WebAuth / WebPrint             ├── SqliteNativeAdapter (ACID binary SQL)
          │                       └── DevelopmentVirtualAdapter (KV Sandbox)
          └──────────────┬──────────────┘
                         ▼
                    SYNC ENGINE
                         │
                    Central / Servidor
```

Regras:

- O Core **nunca** importa `adapter/web` ou `adapter/native` diretamente. A resolução ocorre por **provider registry**.
- **Desacoplamento de Infraestrutura do SQLite**: O driver SQLite nativo é isolado de simulações secundárias:
  * **`SqliteNativeAdapter`**: Executa instruções puras SQL na ponte binária nativa com suporte a transações ACID reais (`BEGIN`, `COMMIT`, `ROLLBACK`).
  * **`DevelopmentVirtualAdapter`**: Gerencia sandbox em memória persistido via `localStorage` exclusivamente no ambiente de browser preview ou suites de testes onde o driver nativo é indisponível.
  * **`NativeDatabaseAdapter`**: Atua como coordenador dinâmico de drivers, roteando dinamicamente entre os adaptadores físico ou virtual em tempo de execução inspecionando as assinaturas de pontes no objeto global `window`.
- Adapters devem ser substituíveis em build-time **ou** runtime.
- Um app não pode declarar dependência de adapter específico. Se ele precisa de hardware, declara `capabilities` no manifest e o runtime resolve.

---

## 10. Local-First e Sync

O fluxo de persistência operacional deve permitir que o aplicativo continue trabalhando quando o servidor estiver indisponível.

### 10.1 Fluxo

```text
OPERAÇÃO
   │
   ▼
OS Database (transação local)
   │
   ▼
Outbox persistente  ── estados: pending / processing / failed / acknowledged
   │
   ▼
Sync Engine  ── idempotency keys, retry com backoff, detecção de conectividade
   │
   ▼
Central / Servidor
   │
   ▼
ACK  ── só então o item é removido da Outbox
```

### 10.2 Regras obrigatórias

- Outbox persistente em banco transacional. Nunca em memória, nunca só em localStorage.
- Toda operação carrega **idempotency key** estável.
- Retry com backoff exponencial e jitter.
- Item só é removido após **ACK** explícito do servidor.
- Detecção de conectividade é do Sync Engine, não do app.
- Reconciliação roda em background e não bloqueia UI.

### 10.3 Estratégia de conflito

O modelo adotado é **híbrido por tipo de dado**, com três classes:

| Classe | Exemplos | Estratégia |
|---|---|---|
| Operações append-only | venda, pagamento, log | Event log — nunca conflita, só ordena |
| Estado agregado | cadastro de produto, cliente | Last-write-wins por campo, com vetor de versão |
| Estado colaborativo | mesas, comandas, KDS | CRDT (LWW-Register / OR-Set) |

A escolha por entidade é declarada no **manifest do app** (campo `syncPolicy`), para que o domínio permaneça no app e o mecanismo permaneça no OS.

### 10.4 Fonte de verdade

- **Cliente é autoritativo** para operações que ele originou (venda, comanda).
- **Servidor é autoritativo** para dados de catálogo, preços, licenças e configuração de tenant.
- **Conflito entre os dois** é resolvido pela política da entidade, nunca por "última escrita global".
- O HQ OS **nunca** usa `OsStateService` do Client OS como fonte de verdade (anti-padrão).

---

## 11. HQ OS / Control Plane

O HQ OS pode ser um sistema operacional completo instalado no ambiente de servidor da 3eatcru. Ele não precisa estar dentro do Client OS. Sua finalidade é administrar o ecossistema e operar o Control Plane.

Componentes:

- Kernel / Shell / Database / Security
- Identity / Tenant Management / Account Management
- Billing / Licensing
- App Catalog / Deployment
- Telemetry / Monitoring
- Marketplace Management
- Developer Platform

**HQ OS e Client OS são plataformas relacionadas, mas independentes.** O Client OS não deve depender do HQ para executar operações locais básicas.

---

## 12. Central

Central é a camada de serviços/control plane que conecta a administração da plataforma aos ambientes operacionais.

```text
HQ OS ──── Central Services ──── Client OS / Web Runtime
```

Ela pode ser hospedada no mesmo servidor do HQ OS e de outros serviços, mas sua responsabilidade deve continuar separada.

Subdomínios da Central:

```text
central/
├── identity/    autenticação, tenants, sessão, permissões
├── sync/        replicação, ACK, resolução server-side
├── events/      barramento de eventos
├── registry/    catálogo de apps, versões, compatibilidade
├── licensing/   licenças, planos, entitlements
└── billing/     cobrança e faturamento
```

A separação é **arquitetural e de autoridade**; não exige necessariamente máquinas físicas diferentes.

---

## 13. Servidor unificado e Web

O servidor pode hospedar todo o ecossistema necessário para a experiência Web. Isso não significa que todos os componentes precisam compartilhar o mesmo núcleo de código ou as mesmas responsabilidades.

```text
                    SERVIDOR 3EATCRU
                           │
   ┌───────────┬───────────┼───────────┬───────────┐
   ▼           ▼           ▼           ▼           ▼
 HQ OS     Central    Client OS    Web Runtime   Databases
                        (Web)
                           │
                    App Services
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         Public Space  Marketplace   Public APIs
```

---

## 14. Marketplace Public

O Marketplace Public é a camada pública de descoberta de empresas e Business Spaces. **Ele não é a loja de aplicativos do OS.** A App Store do OS vive no HQ OS (App Catalog / Deployment / Licensing).

```text
EMPRESA ──► PUBLIC SPACE (published) ──► MARKETPLACE PUBLIC ──► usuário descobre ──► BUSINESS SPACE
```

---

## 15. Separação de autoridades

| Componente | Autoridade principal |
|---|---|
| HQ OS | Administração da plataforma e ecossistema |
| Central | Serviços de controle, comunicação, licenciamento e integração central |
| Client OS | Execução operacional local e infraestrutura dos apps |
| App | Regras específicas de negócio |
| Marketplace Public | Descoberta e apresentação pública de negócios |
| Public Space | Vitrine pública configurada pela empresa |

---

## 16. Regra de dependências

### Permitidas

```text
Apps ──► OS Contracts / SDK ──► OS Adapters ──► Infraestrutura concreta
HQ OS ──► serviços do Control Plane
Client OS ──► serviços necessários para operar
```

### Proibidas

```text
OS Core   ✗  POS / CRM / Finance / Estoque / Mesas
OS Shell  ✗  componentes de apps específicos
App       ✗  driver específico / banco próprio / sync próprio
HQ OS     ✗  estado interno do Client OS como fonte de verdade
App       ✗  adapter diretamente (só via Contracts)
```

---

## 17. Anti-padrões

- Importar componentes de apps diretamente no Shell do OS.
- Colocar entidades de domínio de negócio dentro do Core.
- Usar localStorage como banco operacional principal.
- Armazenar Outbox somente em memória.
- Remover item da fila após um delay sem confirmação do servidor.
- Diagnóstico que sempre retorna healthy sem verificar o subsistema.
- Atualização que apenas troca uma string de versão.
- Hardware representado apenas por signals pré-populados.
- Autenticação simulada apresentada como IAM real.
- APIs multi-tenant sem autorização baseada em identidade/contexto.
- HQ usando `OsStateService` do Client OS como fonte de verdade.
- Adicionar novos apps ao Core apenas para acelerar um protótipo.
- App acessar adapter diretamente, ignorando Contracts.
- Sync sem idempotency key.
- Conflito resolvido por "última escrita global" sem política declarada.

---

## 18. Segurança por fronteira

- **Tenant** é resolvido no Kernel, propagado via `ITenantContext`, e validado em Storage, Sync e Network.
- **Sessão** é responsabilidade do `ISession`; nenhum app manipula tokens diretamente.
- **Permissões** declaradas no manifest são validadas em runtime pelo App Runtime, não confiadas ao app.
- **Isolamento de dados** é garantido por `dataNamespace` por app + tenant no Storage.
- **Outbox** carrega tenant + app + idempotency key; operação de tenant A nunca é entregue em contexto de tenant B.
- **APIs** exigem autorização baseada em identidade + contexto, nunca apenas em headers.

---

## 19. Observabilidade real

Métricas obrigatórias por subsistema:

| Subsistema | Métricas |
|---|---|
| Storage | latência de transação, erros de migration, tamanho do banco |
| Outbox | profundidade, idade do item mais antigo, taxa de retry, taxa de falha |
| Sync | latência de ACK, conflitos resolvidos, reconciliações pendentes |
| Printing | fila, jobs falhos, tempo médio de impressão |
| Network | conectividade, latência, taxa de erro HTTP |
| Auth | sessões ativas, expirações, falhas de permissão |
| Updates | versões instaladas, rollbacks, incompatibilidades |

Health check que não consulta o subsistema é **anti-padrão** (ver seção 17).

---

## 20. Compatibilidade de versões

- OS e Apps usam **SemVer**.
- Manifest declara `osCompatibility` (range).
- Runtime recusa instalar app incompatível.
- Updates do OS seguem política: **minor e patch** são compatíveis com apps que declaram o major anterior; **major** pode quebrar e exige migração.
- Migrações de dados são versionadas e reversíveis quando possível.
- Rollback é requisito, não opcional.

---

## 21. Estrutura de referência

```text
src/
├── os/
│   ├── kernel/
│   ├── shell/
│   ├── storage/
│   ├── database/
│   ├── app-runtime/
│   ├── device/
│   ├── hardware/
│   ├── printing/
│   ├── sync/
│   ├── configuration/
│   ├── diagnostics/
│   ├── updates/
│   ├── security/
│   ├── contracts/
│   │   ├── storage/
│   │   ├── network/
│   │   ├── auth/
│   │   ├── device/
│   │   ├── printing/
│   │   ├── sync/
│   │   ├── events/
│   │   ├── diagnostics/
│   │   └── updates/
│   └── adapters/
│       ├── web/
│       ├── native/
│       └── test/
│
├── apps/
│   ├── pos/
│   ├── inventory/
│   ├── crm/
│   ├── finance/
│   └── ...
│
└── central/
    └── public/
```

A implementação concreta pode variar por stack, mas a dependência arquitetural deve permanecer equivalente.

---

## 22. Checklist obrigatório para novos projetos

- [ ] Consigo iniciar o Core sem instalar nenhum app?
- [ ] Consigo remover um app sem alterar o Core?
- [ ] Consigo criar um novo app sem editar o Window Manager?
- [ ] Consigo trocar Web por Native sem mudar o app?
- [ ] O app usa somente contratos/SDK do OS?
- [ ] O app acessa adapter diretamente? (deve ser **não**)
- [ ] O banco do OS é persistente e transacional?
- [ ] A Outbox sobrevive a reinicialização?
- [ ] Toda operação de sync tem idempotency key?
- [ ] Existe política de conflito declarada por entidade?
- [ ] Existe isolamento de tenant em Storage, Sync e APIs?
- [ ] Existe separação entre Control Plane e Runtime Plane?
- [ ] O diagnóstico mede sistemas reais?
- [ ] Existe matriz de compatibilidade OS ↔ App?
- [ ] Existe rollback de update?

---

## 23. Estratégia de evolução

- **FASE A — FUNDAÇÃO:** OS Contracts, Database, Adapters, Runtime, Lifecycle.
- **FASE B — INFRAESTRUTURA:** Storage, Sync, Device, Hardware, Printing, Diagnostics, Updates.
- **FASE C — PRIMEIRO APP:** Construir um app exclusivamente sobre o SDK/contratos do OS.
- **FASE D — SEGUNDO APP:** Provar que o segundo app não exige mudanças no Core.
- **FASE E — HQ OS / CONTROL PLANE:** Consolidar administração, contas, licenças, telemetria e distribuição.
- **FASE F — ECOSSISTEMA:** Marketplace Public, catálogo de apps, developer platform e serviços adicionais.

---

## 24. Critério de sucesso da arquitetura

A arquitetura está correta quando:

1. Um terceiro aplicativo pode ser desenvolvido, instalado, executado, atualizado e removido usando apenas os contratos oferecidos pela plataforma, sem que o Core precise conhecer seu domínio.
2. O mesmo aplicativo pode rodar em Web e Native através dos adapters da plataforma, mantendo seu domínio e seus fluxos de negócio independentes da infraestrutura.
3. Um conflito de sincronização é resolvido por política declarada, sem intervenção manual e sem perda de operação confirmada.
4. Um update de OS pode ser revertido sem corromper o banco.

---

## 25. Declaração final

Esta arquitetura estabelece uma **plataforma primeiro e aplicativos depois**.

O OS é infraestrutura; os apps são capacidades de negócio. O HQ OS administra o ecossistema; o Client OS executa o ecossistema; a Central provê serviços de controle e integração; o Marketplace Public apresenta negócios ao público.

O padrão deve ser reutilizado como referência arquitetural em novos projetos 3eatcru, permitindo que cada projeto altere seus aplicativos e domínios sem reinventar a fundação.

---

## 26. Plano de Correção e Remixagem de Fundação

Em resposta direta à auditoria técnica rigorosa realizada, o ecossistema entra na fase de **Remixagem da Fundação**. Todos os desvios arquiteturais, acoplamentos de componentes e inconsistências identificadas estão sendo tratados sob o roteiro estruturado detalhado no documento complementar:

👉 **[Plano de Correção Arquitetural (AUDIT_CORRECTION_PLAN.md)](/AUDIT_CORRECTION_PLAN.md)**

Nenhum novo recurso de negócio será criado até que todas as 8 fases de conformidade do kernel do sistema operacional estejam consolidadas.

---

**Fim do documento.**
