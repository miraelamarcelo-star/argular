# 3EATCRU OS — Baseline Arquitetural Definitivo

Este documento define a autoridade arquitetural inegociável do ecossistema **3eatcru OS**, eliminando ambiguidades entre documentos legados e estabelecendo as regras da plataforma.

---

## 1. Princípios Fundamentais do Ecossistema

1. **Dual-OS Architecture**:
   - **HQ OS (Control Plane / Central)**: Painel administrativo de controle, catálogo mestre de aplicativos, faturamento contábil, telemetria global, monitoramento de saúde e gestão de tenants.
   - **Client OS (Runtime Plane / Terminal)**: Sistema operacional local desktop-style rodando no terminal/dispositivo do cliente (PDV, Mesas, CRM, WMS, Hardware).
2. **Local-First & Offline-First**:
   - O Client OS é soberano para operações diárias de negócio mesmo sem conectividade com a nuvem.
   - O armazenamento local opera via `PlatformDatabaseAdapter` (SQLite nativo no Desktop/Electron/Android, IndexedDB transacional no Browser).
   - O tráfego de sincronização opera assincronamente através de **Outbox Idempotente** com controle de concorrência por tenant (Locks de Unidade de Trabalho), teto de backoff exponencial e Dead-Letter Queue (`dead_letter`).
3. **Persistência Central Relacional (SQLite-First)**:
   - A autoridade primária de dados do servidor central reside exclusivamente no banco de dados SQLite (`central_platform.db`) com journaling **WAL** (Write-Ahead Logging) e chaves estrangeiras ativadas.
   - `central_store.json` é mantido estritamente como snapshot/backup de exportação secundário e nunca como fonte de verdade no boot.
4. **Segurança de Fronteira e Credenciais**:
   - Credenciais de administração central e segredos de assinatura (`JWT_SECRET`, `HQ_ADMIN_PASSWORD`, `HQ_ADMIN_MFA_SECRET`, `PAYMENT_GATEWAY_SECRET`) são lidos obrigatoriamente do ambiente (`process.env`).
   - MFA (TOTP RFC 6238) é estritamente obrigatório em ambiente de produção para administradores do HQ.
   - Endpoints de autenticação e onboarding possuem rate-limiting por IP real de rede (`getClientIp`).
5. **Governança Estrita de Aplicativos**:
   - Ciclo de vida com máquina de estados finita: `DRAFT` ➔ `IN_REVIEW` ➔ `APPROVED` ➔ `PUBLISHED` ➔ `SUSPENDED` ➔ `RETIRED`.
   - Releases de aplicativos são imutáveis e protegidas por validação de integridade criptográfica **SHA-256**.
6. **Motor SemVer 2.0.0 Unificado**:
   - Validação e comparação de versões de plataforma e aplicativos utilizam o mesmo motor canônico de parsing (`parseSemVer`), comparação (`compareSemVer`) e satisfatibilidade de versão (`satisfiesSemVer`).

---

## 2. Mapa de Autoridade de Dados

```text
                  HQ CENTRAL (Control Plane)
             ┌─────────────────────────────────┐
             │ SQLite (central_platform.db)    │ ◄── [Fonte de Verdade Central]
             │  - Tenants, Users, Plans        │
             │  - App Catalog & Releases       │
             │  - Master Sales, Customers      │
             │  - Idempotency & Audit Logs     │
             └────────────────┬────────────────┘
                              │
                    [HTTPS REST / Outbox Sync]
                    (Idempotency-Key + Bearer)
                              │
                              ▼
                  CLIENT OS (Runtime Plane)
             ┌─────────────────────────────────┐
             │ Local Database Adapter          │ ◄── [Soberania de Operação Local]
             │  - SQLite (Native) / IndexedDB  │
             │  - Offline Outbox Queue         │
             │  - App State & Local Cache      │
             └─────────────────────────────────┘
```

---

## 3. Matriz de Componentes e Responsabilidades

| Componente | Localização | Papel & Responsabilidade |
| :--- | :--- | :--- |
| **CentralDatabaseEngine** | `src/server/db/central-db.ts` | Gerencia conexões SQLite ACID, migrações, seed automático e persistência/hidratação bidirecional do estado central. |
| **Sync Engine** | `src/server/routes/sync.ts` & `src/app/core/sync/sync.service.ts` | Processamento transacional de lotes com lock de concorrência por tenant, validação Zod e Dead-Letter Queue. |
| **App Runtime** | `src/app/core/app-runtime/app-runtime.service.ts` | Provedor do `OsContext` para os aplicativos, isolando o kernel do OS e provendo APIs de hardware, banco e rede. |
| **App Registry** | `src/app/core/app-runtime/app-registry.service.ts` | Registro e máquina de estados de carregamento assíncrono dos aplicativos (`AppLoadingState`). |
| **HQ Apps Router** | `src/server/routes/hq-apps.ts` | Governança de catálogo, transições válidas de ciclo de vida e releases com checksum SHA-256. |
| **SemVer Engine** | `src/server/semver.ts` & `src/app/core/semver.ts` | Especificação canônica de versionamento SemVer 2.0.0 com pre-release e build metadata. |
| **Security & Auth** | `src/server/config.ts`, `auth.ts`, `middleware.ts` | JWT, TOTP RFC 6238, rate limiting por IP, sanitização Zod e impersonação auditada de suporte. |

---

## 4. Conformidade de Verificação e Health Checks

- `/health`: Status geral do sistema e contagem de entidades.
- `/health/liveness`: Verificação de vivacidade do processo Node.js/Express.
- `/health/readiness`: Verificação da integridade do banco de dados SQLite (`SELECT 1`).
