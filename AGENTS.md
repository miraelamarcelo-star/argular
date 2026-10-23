# App Evolution & Rules

Este repositório segue estritamente o blueprint arquitetural definido em **[ARCHITECTURE.md](/ARCHITECTURE.md)**, que especifica a separação de autoridade de três níveis (Central/HQ, 3eatcru OS e Public Space).

## Regras de Ouro (Expandidas pela Arquitetura 3eatcru)
1. **OS não conhece Apps.** Usuários e empresas são entidades independentes.
2. **HQ OS ≠ Client OS (Dual-OS Architecture).** O ecossistema possui dois sistemas operacionais distintos. O **HQ OS (Control Plane)** administra a plataforma (tenants, billing, catálogo, monitoramento), enquanto o **Client OS (Runtime Plane)** roda no ambiente do cliente (PDV, CRM, offline-first).
3. **App depende do OS.** O Client OS provê infraestrutura; os Apps implementam domínio.
4. Nenhuma grande refatoração sem teste entre etapas.
5. Componentes grandes devem ser quebrados.
6. Atualizar AGENTS.md na evolução do app.
7. Documente as mudanças de estado global no fluxo de dados.
8. **Separação Estrita de Clientes:** Web (Online), Windows/Android (Offline-first com Sync).
9. **Separação de Identidade:** Auth do Client OS (Empresa/Cliente) ≠ Auth do HQ OS (Admin 3eatcru).
10. **Setup não é Login:** Setup é onboarding/provisioning.
11. **Domínio Puro:** A camada de Domínio não conhece Angular, API, SQLite ou Browser. Ela conhece apenas regras de negócio.
12. **Interface Visual OS:** O cliente Web deve refletir visualmente um Desktop (Windows/ChromeOS style), com área de trabalho, janelas e barra de tarefas.

---

## Histórico Consolidado de Evolução

As fases anteriores de evolução do sistema (**Fase 0** à **Fase 80**) foram arquivadas no arquivo dedicado **[AGENTS_HISTORY.md](/AGENTS_HISTORY.md)** para otimização de contexto e performance de leitura da IA. 

O histórico arquivado engloba toda a concepção da fundação de contratos, infraestrutura do Kernel do OS, Spoolers de Impressão, simulador físico de hardware, SDK de comunicação, controle de segurança (anti-IDOR/blindagem), portal de governança Central HQ OS, portal de onboarding, marketplace público, suporte a multi-filiais, enrijecimento do POS/Inventário, a criação do Navegador Web Inteligente, o gerenciamento de janelas em cascata e grade, telemetria em tempo real, automação com mensageria e integrações transacionais reativas.

---

## AI Logic Context & Architecture Flow (Quick Reference)

Ao invés de adicionar logs sequenciais ou "fases" longas, utilize esta tabela central de fluxo lógico para documentar de forma rápida **o que funciona** e **o que deve ser evitado (anti-patterns)** na evolução da arquitetura. Atualize esta tabela conforme o sistema evolui para evitar a repetição de erros.

| Componente / Domínio | O que Funciona (Padrão Ouro / Melhor Arquitetura) | O que NÃO Funciona (Erros a Evitar) |
| :--- | :--- | :--- |
| **Persistência (Central Store)** | Escrita atômica com arquivos `.tmp` e `renameSync`. Geração de snapshots `.bak` na gravação. Preservação de tenants em prod baseada na flag `isDemo: true`. | Gravação direta no arquivo JSON (causa corrupção em falhas). Mutações GET. Expurgar tenants de clientes sem verificar `isDemo`. |
| **Integração OS vs Apps** | Apps apenas implementam domínio e consomem serviços do OS (`OsDatabase`, `PrinterService`, `Identity`). | Apps criando instâncias de IndexedDB, LocalStorage ou Auth próprios. |
| **HQ vs Client OS** | O HQ OS gerencia tenants, billing e OTA (Server-Authoritative). Client OS isola o estado por tenant (`OsStateService`). | Permitir que o Client OS altere limites de plano ou aprove licenças. IDOR em endpoints. |
| **Segurança & Credenciais** | Credenciais do HQ Admin lidas estritamente do ambiente (`HQ_ADMIN_PASSWORD` / `HQ_ADMIN_SECRET`). MFA TOTP obrigatório para HQ Admins configurados. | Fallbacks de senha estáticos/hardcoded em produção (`Adim1234`). Ignorar validação de código TOTP. |
| **Provisionamento & Webhooks** | Provisionamento em `POST /companies` gerando `bootstrapCredentials` dinâmicos. Webhooks validados com `PAYMENT_GATEWAY_SECRET`. | Atribuir PINs/senhas estáticos padrão (`1234`). Aceitar assinaturas simuladas de webhook em produção. |
| **Interface Visual (Desktop)** | Shell OS com `WindowManagerService`, mosaico/cascata, barra de tarefas e resolução lógica customizável. | Layouts de landing page no Client OS. Popups nativos do navegador (`window.alert`). |
| **Autenticação de Operador** | Validação de PIN via Server-side (`/api/v1/auth/operator-unlock`). Rate-limiting e validação de token Bearer da sessão. | Fallback com PINs hardcoded ou criptografia fraca exposta ao cliente. |
| **Roteamento de API & Analytics**| Prefixação automática idempotente (`/api/v1`) via interceptors. Endpoint dedicado `/hq/analytics/sales` protegido com `requireHqAdmin`. | Paths relativos ou URLs fixas nos componentes; usar rotas genéricas sem autorização HQ Admin. |
| **Marketplace / Público** | O servidor calcula preços autênticos via catálogo central (`master`). Transição de estados do pedido com reversão de estoque. | Cliente enviar o `totalPrice` no payload de checkout (vulnerabilidade de manipulação). |
| **Sincronismo Offline & Outbox** | Snapshots atômicos de idempotência (`sync.ts`). Outbox com 3 níveis de conectividade e Dead-Letter Queue (`dead_letter`) com backoff de 120s + jitter. | Loops sem fallback. Transações financeiras não-verificadas por ID único (duplicação). Retentativas infinitas sem DLQ. |
| **Versionamento OTA (SemVer)**| Parse estrito SemVer 2.0.0. Validação prévia de `minOsVersion` pelo `AppRuntimeService` antes do launch. | Comparações de versão baseadas em string simples (`v1 > v0.9`). |
| **Armazenamento / SQLite** | `NativeDatabaseAdapter` roteia entre `SqliteNativeAdapter` (puro SQL/ACID) e `DevelopmentVirtualAdapter` (KV simulator via localStorage) checando a ponte. | Vazar lógicas de browser para o driver nativo ou simulações acopladas que corrompem transações físicas. |
| **Cobrança / Dupla Entrada** | Faturamento pré-pago sem negativar caixa fictício, gerando faturas `PENDING`. Lançamentos de crédito (`CREDIT_ADDED`) e débito (`PLAN_CHARGE`) no Livro-Razão. | Realizar baixas de licença ou deduções de saldo sem faturas correspondentes ou sem fluxo duplo de lançamentos. |
| **APIs e Escalabilidade** | Paginação real (`page`/`pageSize`) de registros massivos (Vendas, Clientes, Produtos, Auditoria) envelopada com retrocompatibilidade total. | Carregar arrays infinitos na rede sem limites físicos de paginação ou quebrar chamadas legadas do frontend. |

---

## Arquitetura de Plataforma (3eatcru OS vs Futuros Apps)

O **3eatcru OS** não é um aplicativo monolítico nem um PDV isolado. Ele é o **Sistema Operacional/Plataforma** que fornece toda a infraestrutura e regras comuns que futuros aplicativos de negócios (Restaurante, Varejo, WMS, etc.) devem obrigatoriamente consumir através de contratos e APIs unificadas.

```text
                    3EATCRU OS (Plataforma & Padrão)
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
       INFRAESTRUTURA & APIs                    CONTRATOS & REGRAS
              │                                     │
              ├── Identity (Auth/Session)           ├── Segurança & RBAC
              ├── Device (Identity/Integrity)       ├── Permissões por Nível
              ├── Company (Multi-tenant/Info)       ├── Storage Contract (Remote/Sync)
              ├── Configuration (Hierárquico)       ├── UI/UX Padrão (Desktop UI)
              ├── Printing (Bobinas/Fila)           ├── Sync Protocol (Offline Outbox)
              ├── Network (Status/Detect)           ├── Licensing (Licenças)
              ├── Update (Hot updates/Notes)        ├── Audit (Rastreabilidade)
              ├── Public Space (Presença Digital)   └── Module/Plugin Contracts
              └── Module System (Plugins)
                                 │
                                 ▼
              ┌─────────────────────────────────────┐
              │            FUTUROS APPS             │
              │   (Implementam apenas o Domínio)    │
              │                                     │
              │ Vendas (Módulos de Venda específicos)│
              │ Restaurante (Mesas, Comandas, etc.)  │
              │ Varejo (Grades, Etiquetas, etc.)     │
              │ WMS (Inventário, Endereçamento)     │
              │ CRM (Lead, Funil, Fidelidade)       │
              └─────────────────────────────────────┘
```

### Como os Futuros Apps Consomem o OS:
1. **Autenticação & Identidade**: Apps futuros **não** criam fluxos de login ou sessions. Eles consomem `OS Identity`, `OS Session` e `OS Permissions` do núcleo do sistema.
2. **Armazenamento & Sync**: Apps futuros **não** definem o banco de dados diretamente. Eles implementam o `OS Storage Contract`. O runtime do OS decide se os dados persistirão em banco remoto direto (modo Web Online) ou banco local SQLite com fila de sincronismo offline (modo Desktop/Android Offline-First).
3. **Impressão Comercial**: Apps futuros **não** controlam drivers nem conexões de hardware. Eles acionam `OS.print(job)` através do `PrinterService` unificado da plataforma, que gerencia perfis de impressão e bobinas.
4. **Presença Digital**: Apps futuros utilizam a infraestrutura de `Public Space` fornecida pelo OS para expor dados, catálogos e cardápios online automaticamente, sem reinventar o sistema de sites.

---

## Fluxo de Dados e Estado Global
- **Window Manager**: Controla janelas abertas, z-index e estado de minimização na UI do Web OS.
- **Estado de Usuário/Empresa**: Armazena a sessão ativa, saldo, filial logada e permissões de operador.
- **Catálogo de Apps**: Lista de apps disponíveis.
- **Apps Instalados**: Estado local refletindo instalações da empresa atual.

---

## Regras da Plataforma de Apps (APP PLATFORM RULE)

The 3eatcru ecosystem distinguishes:

1. **App Catalog**: Defines commercial availability and lifecycle.
2. **App Entitlement**: Defines whether a tenant is authorized to use an app.
3. **App Installation**: Defines whether the app is installed in the Client OS.
4. **App Registry**: Defines which app implementations the OS knows how to load.
5. **App Runtime**: Defines how an authorized and installed app executes.

The Client OS must never invent pricing, licensing, entitlement, or catalog state.

The HQ Central is authoritative for catalog, licensing, publication lifecycle, and entitlement.

The Client OS is authoritative for local installation state, runtime lifecycle, local storage, hardware, and offline execution.

The App itself must never be authoritative for permissions, tenant isolation, licensing, or OS capabilities.

---

## 🛑 FASE ATUAL: Remixagem de Fundação (Feature Freeze)

Em resposta à auditoria rigorosa de acoplamento do ecossistema, o projeto encontra-se em **Feature Freeze (Congelamento de Funcionalidades)**. 

**Diretrizes obrigatórias para os próximos passos de evolução:**
1. **Não adicionar novas funcionalidades** ou novos aplicativos de negócios.
2. Seguir estritamente o roteiro de 8 fases definido em: **[Plano de Correção Arquitetural (AUDIT_CORRECTION_PLAN.md)](/AUDIT_CORRECTION_PLAN.md)**.
3. Todas as alterações devem focar exclusivamente na remoção de acoplamento entre o Core do OS e os Apps, garantindo que o kernel compile e execute de forma soberana e independente.

**Progresso Realizado:**
- **Fase 2, 3 & 4 (Desacoplamento, Contracts & Runtime State Machine):** Refatoração e consolidação de todos os aplicativos de negócio (`CRM`, `Tables`, `Inventory`, `POS`, `WhatsApp`, `iFood`, `Telegram`, `Finance`) para consumo padronizado do `OsContext` via `OsSdkService`, eliminando qualquer injeção do núcleo interno do OS (`OsStateService`, `OsEventBusService`, `OperatorLockService`). Introdução do InjectionToken `OS_DATABASE_ADAPTER` para desacoplar implementações de storage. O `OsWindowCompositorComponent` opera através de carregamento dinâmico via `ngComponentOutlet` sincronizado com a máquina de estados reativa (`AppLoadingState`: `unloaded`, `loading`, `loaded`, `failed`) do `AppRegistryService`.
- **Fase 5 (Separação Visual HQ ➔ Client OS):** Isolamento total do `OsShellComponent` de componentes administrativos do HQ OS, mantendo a experiência do desktop do cliente limpa e soberana.
- **Fase 6 (Enrijecimento de Segurança):** Parametrização das credenciais de administração central via variáveis de ambiente (`HQ_ADMIN_EMAIL`, `HQ_ADMIN_PASSWORD`, `HQ_ADMIN_SECRET`), documentadas em `.env.example`. Blindagem do endpoint `/api/v1/auth/operator-unlock` com validação de token Bearer da sessão do terminal, verificação criptográfica de JWT e proteção Anti-IDOR tenant/operador.
- **Fase 7 (Persistência & Resiliência de Armazenamento):** Garantia de atomicidade rigorosa na persistência do estado central e nos registros de idempotência (`state.ts`), utilizando arquivos `.tmp` e `renameSync` para prevenir corrupção de dados em reinicializações inesperadas.
- **Fase 8 (Sanitização de Dados):** Remoção de dados simulados (coordenadas, distâncias e avaliações artificiais) no marketplace (`public-space.ts`) e eliminação de respostas estáticas fictícias em `web-search.ts`, garantindo que o servidor retorne erros HTTP limpos e declarativos (503/502) quando recursos externos não estiverem parametrizados.
- **Fase 9 (Estabilização da Auditoria V10 & Blindagem de Storage):** Implementação do export de backup real em formato JSON (`Blob`) no `IndexedDbDatabaseAdapter`, exclusão atômica por cursor no `clear()`, isolamento e filtragem de contexto por filial (`branchId`) em endpoints de Vendas, Mesas, Transações Financeiras, Produtos e Clientes, além de estabilização com 100% dos testes unitários e de pureza do OS aprovados.
- **Fase 10 (Hardening de Segurança, Sessões Auditadas de Suporte & Dead-Letter Queue):** Enrijecimento estrito de runtime (`JWT_SECRET` e `HQ_ADMIN_PASSWORD` obrigatórios em produção no boot), introdução de endpoints auditados de impersonação de suporte (`/api/v1/auth/impersonate` e `/api/v1/auth/impersonate/exit` com emissão de logs `SUPPORT_SESSION_STARTED` / `SUPPORT_SESSION_ENDED`), evolução da conectividade do Outbox em 3 níveis (`networkOnline`, `serverReachable`, `syncHealthy`), implementação de transição para Dead-Letter Queue (`status: 'dead_letter'`) após limite de retentativas com teto de backoff exponencial de 120s com jitter, e criação da suite de testes de isolamento multi-tenant (`security-tenant-isolation.spec.ts`).
- **Conclusão Integral do Plano de Correção Arquitetural (Fases A a H):**
  - **Fase A (Segurança de Fronteira)**: Autenticação com TOTP RFC 6238 sem fallbacks em produção, rate-limiting, HMAC timingSafeEqual em webhooks de pagamento e credenciais dinâmicas.
  - **Fase B (Purificação do SDK)**: Desacoplamento de todos os aplicativos de negócio (CRM, Tables, Inventory, POS, WhatsApp, iFood, Telegram, Finance) para consumo exclusivo do `OsContext` via `OsSdkService`.
  - **Fase C (Unificação de Estado)**: Autoridade única de tenant centralizada no `IdentityService` e isolamento estrito entre sessões do HQ e do Client OS.
  - **Fase D (Maturidade do App Runtime)**: Máquina de estados desacoplada (`AppLoadingState`) e orquestração assíncrona de ciclo de vida com `ngComponentOutlet`.
  - **Fase E (Sanitização DTO & Zod)**: Schemas estritos para validação de payloads nas rotas com `validateBody`.
  - **Fase F (Resolução de Storage)**: Renomeação semântica para `PlatformDatabaseAdapter`, abstração do storage sob `IOsDatabaseAdapter` e suites de isolamento multi-tenant.
  - **Fase G (Infraestrutura Relacional Central)**: Drizzle ORM + SQLite (`central_platform.db`) com journaling WAL, transações ACID e sincronização atômica contínua.
  - **Fase H (Adoção Cloud & Remote Sync)**: Contratos `ICloudSyncAdapter`, serviço `CloudSyncAdapter` e resolução dinâmica do motor de armazenamento no `PlatformDatabaseAdapter` (Desktop Native SQLite, Browser IndexedDB e SSR/Headless Virtual Memory).
- **Consolidação do Baseline Arquitetural (Auditoria Sênior Remix 2)**:
  - **Bloco 1 (Persistência Central SQLite-First)**: SQLite (`central_platform.db`) é a autoridade e fonte de verdade primária única no boot do servidor. O arquivo `central_store.json` opera estritamente como export/backup secundário. Exclusões de registros contam com conciliação e espelhamento real via `DELETE`.
  - **Bloco 2 (Sincronização & Concorrência)**: Unidade de Trabalho transacional com exclusão mútua por tenant (`acquireTenantLock`), validação estrita com schemas Zod para todas as mutações e Dead-Letter Queue resiliente.
  - **Bloco 3 (Segurança & Credenciais)**: Rate-limiting por IP real (`getClientIp`), eliminação de fallbacks estáticos em produção e TOTP RFC 6238 obrigatório para administradores HQ.
  - **Bloco 4 (Governança & SemVer)**: Motor canônico SemVer 2.0.0 unificado (`parseSemVer`, `compareSemVer`, `satisfiesSemVer`), ciclo de vida de apps com máquina de estados finita e releases imutáveis com checksum SHA-256.
  - **Bloco 5 (Observabilidade & Baseline)**: Endpoints `/health`, `/health/liveness`, `/health/readiness` e documento definitivo `ARCHITECTURE_BASELINE.md`.




