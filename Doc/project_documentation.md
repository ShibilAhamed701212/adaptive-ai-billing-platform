# PROJECT ARCHITECTURE, CODE FLOW & WORKFLOW DOCUMENTATION

## Adaptive AI-Powered Multi-Tenant Billing Platform

> **Project:** `adaptive-ai-billing-platform` v1.0.0
> **Stack:** TypeScript Monorepo — React 19 (Vite) + Express 4 + MongoDB (Mongoose 8) + Zod
> **Architecture:** Multi-Tenant SaaS with AI Copilot capabilities

---

## 1. Complete Project Folder Tree

```text
BIlling Application/
├── .env.example                          # Environment variable template (secrets redacted)
├── .gitignore                            # Git exclusion rules
├── docker-compose.yml                    # Docker services (MongoDB 7.0 + Redis 7.2)
├── package.json                          # Root monorepo manifest (npm workspaces)
├── package-lock.json                     # Deterministic dependency lock
│
├── Doc/
│   ├── Adaptive_AI_Billing_MERN_SRS_System_Design.docx
│   └── Technical PRD + System Design Document.md
│
├── shared/                               # @billing/shared — Cross-cutting type library
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                      # Barrel export for all shared types
│       └── types/
│           ├── ai.ts                     # AI copilot & anomaly alert interfaces
│           ├── api.ts                    # Generic API response & dashboard types
│           ├── auth.ts                   # User, Organization, TenantContext types
│           ├── customer.ts              # Customer interface
│           ├── invoice.ts               # Invoice, InvoiceItem, TaxBreakdown, InvoiceTotals
│           ├── metadata.ts              # CustomFieldDefinition, BusinessRule, BillingModelPreset
│           ├── payment.ts               # Payment interface
│           └── product.ts              # Product interface
│
├── backend/                              # @billing/backend — Express REST API
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts                     # Bootstrap entry: connectDB → createApp → listen
│       ├── app.ts                        # Express factory: middleware + all 15 route modules
│       ├── seed.ts                       # Database seeder: demo org, users, products, invoices
│       │
│       ├── config/
│       │   ├── db.ts                     # Mongoose connection manager
│       │   └── env.ts                    # Centralized ENV config (dotenv)
│       │
│       ├── core/
│       │   ├── audit/
│       │   │   └── audit.service.ts      # AuditLog model + logAuditEvent() helper
│       │   ├── middleware/
│       │   │   ├── error.middleware.ts    # Global error handler (Zod/Mongoose/Duplicate/Custom)
│       │   │   ├── rate-limiter.middleware.ts  # In-memory token-bucket rate limiter
│       │   │   └── validate.middleware.ts      # Zod schema validation middleware factory
│       │   ├── schemas/
│       │   │   ├── auth.schema.ts        # Register & Login Zod schemas
│       │   │   ├── customer.schema.ts    # Create/Update customer Zod schemas
│       │   │   ├── invoice.schema.ts     # Create/Update/Preview/Status invoice schemas
│       │   │   ├── payment.schema.ts     # Record/Refund payment Zod schemas
│       │   │   └── product.schema.ts     # Create/Update product Zod schemas
│       │   └── tenancy/
│       │       └── tenant.middleware.ts   # JWT auth + tenantMiddleware + requireRole
│       │
│       ├── models/
│       │   ├── ApprovalQueue.model.ts    # Approval workflow queue
│       │   ├── BusinessRule.model.ts     # Dynamic business rules (event → condition → action)
│       │   ├── CreditNote.model.ts       # Credit notes against invoices
│       │   ├── CustomField.model.ts      # Per-tenant custom field definitions
│       │   ├── Customer.model.ts         # Multi-tenant customer records
│       │   ├── Invoice.model.ts          # Full invoice with items, tax breakdown, snapshots
│       │   ├── InvoiceTemplate.model.ts  # Customizable invoice layout templates
│       │   ├── Organization.model.ts     # Tenant organization with billing model & settings
│       │   ├── Payment.model.ts          # Payment records linked to invoices
│       │   ├── Product.model.ts          # Product catalog with pricing tiers
│       │   ├── RecurringProfile.model.ts # Recurring/subscription invoice profiles
│       │   └── User.model.ts            # Multi-tenant users with roles
│       │
│       ├── billing-engine/
│       │   ├── billing-models/
│       │   │   └── presets.ts            # Industry-specific billing model presets
│       │   ├── calculators/
│       │   │   ├── invoice-calculator.ts      # Deterministic invoice calculation engine
│       │   │   └── invoice-calculator.test.ts # Unit tests for calculation engine
│       │   └── tax-engine/
│       │       └── tax-calculator.ts     # GST/VAT/Sales Tax calculator with IGST/CGST/SGST
│       │
│       ├── dynamic-engine/
│       │   ├── custom-fields/
│       │   │   └── field-validator.ts    # Runtime custom field validation
│       │   └── rules/
│       │       └── rule-evaluator.ts     # Business rule evaluation engine
│       │
│       ├── ai/
│       │   ├── finance-agent/
│       │   │   └── ask-business.ts       # NLP-style business intelligence query agent
│       │   └── invoice-agent/
│       │       └── invoice-copilot.ts    # Natural-language invoice draft generator
│       │
│       ├── jobs/
│       │   └── recurring-invoice.job.ts  # Recurring invoice generation engine
│       │
│       └── modules/                      # Feature modules (controller + routes each)
│           ├── ai/
│           │   ├── ai.controller.ts      # 6 AI endpoints (copilot, ask, OCR, reminders, templates, onboarding)
│           │   └── ai.routes.ts
│           ├── approvals/
│           │   ├── approval.controller.ts # Approval queue CRUD + approve/reject workflows
│           │   └── approval.routes.ts
│           ├── audit/
│           │   ├── audit.controller.ts    # Paginated audit log listing
│           │   └── audit.routes.ts
│           ├── auth/
│           │   ├── auth.controller.ts     # Register, Login, GetMe
│           │   └── auth.routes.ts
│           ├── credit-notes/
│           │   ├── credit-note.controller.ts # Credit note lifecycle
│           │   └── credit-note.routes.ts
│           ├── customers/
│           │   ├── customer.controller.ts # CRUD + custom field validation
│           │   └── customer.routes.ts
│           ├── dynamic/
│           │   ├── dynamic.controller.ts  # Custom fields + business rules + presets
│           │   └── dynamic.routes.ts
│           ├── invoices/
│           │   ├── invoice.controller.ts  # Full invoice lifecycle (CRUD, preview, status)
│           │   └── invoice.routes.ts
│           ├── organizations/
│           │   ├── organization.controller.ts # Org profile, settings, billing model switch
│           │   └── organization.routes.ts
│           ├── payments/
│           │   ├── payment.controller.ts  # Record payments, refunds, balance reconciliation
│           │   └── payment.routes.ts
│           ├── products/
│           │   ├── product.controller.ts  # Product catalog CRUD
│           │   └── product.routes.ts
│           ├── recurring/
│           │   ├── recurring.controller.ts # Recurring profiles + manual trigger
│           │   └── recurring.routes.ts
│           ├── reports/
│           │   ├── report.controller.ts   # Dashboard, revenue, AR aging, statements, top customers
│           │   └── report.routes.ts
│           ├── templates/
│           │   ├── template.controller.ts # Invoice template CRUD
│           │   └── template.routes.ts
│           └── users/
│               ├── user.controller.ts     # Team member CRUD
│               └── user.routes.ts
│
└── frontend/                             # @billing/frontend — React 19 SPA (Vite)
    ├── index.html                        # HTML shell with Google Fonts
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vite.config.ts                    # Vite config with API proxy to :5000
    └── src/
        ├── main.tsx                      # ReactDOM.createRoot entry
        ├── App.tsx                       # Root component: AuthProvider + RouterShell
        ├── index.css                     # Global CSS design system
        │
        ├── api/
        │   └── client.ts                # Centralized fetch wrapper with JWT injection
        │
        ├── context/
        │   └── AuthContext.tsx           # React Context for auth state + localStorage persistence
        │
        ├── components/
        │   ├── ai-copilot/
        │   │   └── AiCopilotDrawer.tsx   # Slide-out AI assistant (invoice drafting + business Q&A)
        │   ├── dynamic-forms/
        │   │   └── DynamicFieldRenderer.tsx # Renders custom fields dynamically from metadata
        │   └── layout/
        │       ├── AppLayout.tsx         # Main layout shell (sidebar + navbar + content)
        │       ├── Navbar.tsx            # Top navigation bar
        │       └── Sidebar.tsx           # Left sidebar navigation
        │
        └── pages/
            ├── auth/
            │   ├── LoginPage.tsx         # Login form
            │   └── RegisterPage.tsx      # Registration + org creation + billing model selection
            ├── customers/
            │   └── CustomersPage.tsx     # Customer list + create/edit modal
            ├── dashboard/
            │   └── DashboardPage.tsx     # AI daily brief, KPI cards, cashflow chart, anomalies
            ├── invoices/
            │   ├── CreateInvoicePage.tsx  # Invoice builder with live preview + copilot draft support
            │   ├── InvoiceDetailPage.tsx  # Invoice detail view + payment recording + status management
            │   └── InvoicesListPage.tsx   # Invoice listing with filters
            ├── onboarding/
            │   └── OnboardingPage.tsx    # AI-assisted onboarding wizard
            ├── products/
            │   └── ProductsPage.tsx      # Product catalog management
            └── settings/
                └── SettingsPage.tsx      # Organization settings, team, custom fields, business rules, templates
```

---

## 2. Folder-by-Folder Explanation

### Root Directory
The project root is an **npm workspaces monorepo** orchestrating three packages: `shared`, `backend`, and `frontend`. Docker Compose provides local MongoDB and Redis instances.

### `shared/`
**Purpose:** Cross-cutting TypeScript type library (`@billing/shared`)
**Contains:** Pure TypeScript interfaces and type definitions used by both backend and frontend
**Architecture Layer:** Shared contract / DTO definitions
**Key Types:** `User`, `Organization`, `TenantContext`, `Invoice`, `InvoiceItem`, `TaxBreakdown`, `Customer`, `Product`, `Payment`, `CustomFieldDefinition`, `BusinessRule`, `BillingModelPreset`, `InvoiceCopilotDraft`, `AnomalyAlert`, `DashboardSummary`, `ApiResponse`

### `backend/src/config/`
**Purpose:** Application bootstrap configuration
**Contains:** Database connection (`db.ts`) and environment variable centralization (`env.ts`)
**Connects to:** Used by `server.ts` and every module that needs ENV or DB

### `backend/src/core/`
**Purpose:** Cross-cutting infrastructure concerns
**Contains:** Middleware (error handling, rate limiting, validation), authentication/tenant isolation, audit logging, and Zod validation schemas
**Architecture Layer:** Framework/infrastructure layer — sits between routes and controllers

### `backend/src/models/`
**Purpose:** Mongoose ODM schema and model definitions
**Contains:** 12 Mongoose models representing all domain entities
**Architecture Layer:** Data access layer — direct interface to MongoDB

### `backend/src/billing-engine/`
**Purpose:** Deterministic financial calculation engine
**Contains:** Invoice calculator (line items, discounts, pricing tiers), tax calculator (GST IGST/CGST/SGST, VAT, Sales Tax), and industry-specific billing model presets
**Architecture Layer:** Domain/business logic — pure computation, no I/O

### `backend/src/dynamic-engine/`
**Purpose:** Runtime schema extension and business rule automation
**Contains:** Custom field validator (validates user-defined fields against metadata) and business rule evaluator (condition → action engine)
**Architecture Layer:** Domain logic — enables tenant-specific customization without code changes

### `backend/src/ai/`
**Purpose:** AI-powered intelligent features
**Contains:** Finance agent (NLP business queries against real data) and Invoice copilot (natural-language to invoice draft conversion)
**Architecture Layer:** Intelligence/AI layer — deterministic heuristic agents (not LLM-dependent)

### `backend/src/jobs/`
**Purpose:** Background/scheduled task processing
**Contains:** Recurring invoice generation job (calculates next run dates, generates invoices from profiles)
**Architecture Layer:** Job/worker layer

### `backend/src/modules/`
**Purpose:** Feature-organized REST API modules
**Contains:** 15 domain modules, each with a controller and route file
**Architecture Layer:** Application/presentation layer — handles HTTP requests, delegates to business logic

### `frontend/src/api/`
**Purpose:** Centralized HTTP client
**Contains:** `client.ts` — a `fetch` wrapper that injects JWT tokens and handles 401 auto-logout
**Architecture Layer:** Data access layer (frontend)

### `frontend/src/context/`
**Purpose:** Global application state via React Context
**Contains:** `AuthContext.tsx` — manages user session, organization data, and localStorage persistence

### `frontend/src/components/`
**Purpose:** Reusable UI components
**Contains:** Layout (AppLayout, Sidebar, Navbar), AI Copilot drawer, Dynamic field renderer

### `frontend/src/pages/`
**Purpose:** Page-level route components
**Contains:** 7 page groups covering all user-facing features (auth, dashboard, invoices, customers, products, settings, onboarding)

---

## 3. File-by-File Analysis

### Backend Entry Points

---

#### `backend/src/server.ts`
**Purpose:** Application bootstrap entry point
**Contains:** `bootstrap()` async function
**Inputs:** Environment variables via `ENV`
**Outputs:** Running HTTP server on configured port
**Dependencies:** `./app` (createApp), `./config/db` (connectDB), `./config/env` (ENV)
**Important Logic:** Connects to MongoDB first, then creates Express app and starts listening. Registers SIGTERM/SIGINT handlers for graceful shutdown.
**Role in System:** The very first file executed. Entry point for `tsx watch` in development.

---

#### `backend/src/app.ts`
**Purpose:** Express application factory — assembles all middleware and routes
**Contains:** `createApp()` function
**Inputs:** None
**Outputs:** Configured Express application
**Dependencies:** All 15 route modules, all 3 global middleware
**Important Logic:** 
- Applies global middleware in order: CORS → JSON parser (10MB limit) → URL-encoded parser → Morgan logger → Rate limiter
- Registers a health check endpoint at `GET /api/v1/health`
- Mounts 15 route modules under `/api/v1/` prefix
- Registers 404 handler and global error handler as final middleware
**Role in System:** Central application composition — the "wiring" file that connects everything

---

#### `backend/src/config/env.ts`
**Purpose:** Centralized environment variable access
**Contains:** `ENV` constant object
**Variables Managed:**
| Variable | Purpose | Read By |
|---|---|---|
| `PORT` | Server listen port (default: 5000) | `server.ts` |
| `NODE_ENV` | Environment mode | `error.middleware.ts`, `db.ts` |
| `MONGODB_URI` | MongoDB connection string | `db.ts`, `seed.ts` |
| `JWT_SECRET` | JWT signing secret | `tenant.middleware.ts`, `auth.controller.ts` |
| `JWT_EXPIRES_IN` | Token expiry (default: 7d) | `auth.controller.ts` |
| `CLIENT_URL` | Frontend URL for CORS | `env.ts` (declared but CORS uses `origin: true`) |
| `OPENAI_API_KEY` | OpenAI API key (optional) | `env.ts` (declared, not consumed) |
| `GEMINI_API_KEY` | Gemini API key (optional) | `env.ts` (declared, not consumed) |

---

### Core Middleware

---

#### `backend/src/core/middleware/error.middleware.ts`
**Purpose:** Global Express error handler — final middleware in the chain
**Contains:** `errorHandler()` function
**Important Logic:** Classifies errors into 5 categories:
1. **Zod validation errors** → 400 with field-level details
2. **Mongoose validation errors** → 400 with path/kind details
3. **Mongoose CastError** (invalid ObjectId) → 400
4. **MongoDB duplicate key** (E11000) → 409 with key pattern
5. **Custom application errors** → uses `err.statusCode` or defaults to 500
- Logs errors with tenant context for observability
- Includes stack traces only in development mode

---

#### `backend/src/core/middleware/rate-limiter.middleware.ts`
**Purpose:** In-memory token-bucket rate limiter
**Contains:** `rateLimiter()` middleware, internal bucket map
**Important Logic:** 
- 200 requests per minute per key
- Key is tenant-scoped if authenticated, else IP-scoped
- Token refill is continuous (sliding window)
- Sets `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers
- Periodic cleanup of stale entries every 5 minutes

---

#### `backend/src/core/middleware/validate.middleware.ts`
**Purpose:** Zod schema validation middleware factory
**Contains:** `validate(schema)` for `req.body`, `validateQuery(schema)` for `req.query`
**Important Logic:** Parses and replaces request body/query with Zod-coerced output, stripping unknown fields. Returns structured 400 errors on failure.

---

#### `backend/src/core/tenancy/tenant.middleware.ts`
**Purpose:** JWT authentication and multi-tenant context injection
**Contains:** `tenantMiddleware()` and `requireRole(allowedRoles)`
**Important Logic:**
1. Extracts Bearer token from `Authorization` header
2. Verifies JWT using `ENV.JWT_SECRET`
3. Decodes `TenantContext` (organizationId, userId, role, email) and attaches to `req.tenant`
4. `requireRole()` checks `req.tenant.role` against allowed roles array → 403 if denied
**Role in System:** **Every authenticated route** passes through `tenantMiddleware`. All data queries are then scoped by `req.tenant.organizationId`, achieving tenant isolation.

---

### Models (Database Layer)

All models follow the same pattern: Mongoose Schema with `timestamps: true`, tenant scoping via `organizationId` with index, and compound unique indexes where appropriate.

| Model | Collection | Key Fields | Unique Indexes | References |
|---|---|---|---|---|
| `User` | users | email, name, role, passwordHash | (organizationId, email) | → Organization |
| `Organization` | organizations | name, slug, billingModel, settings | slug | — |
| `Customer` | customers | name, email, billingAddress, creditLimit, outstandingBalance, customFields | — | → Organization |
| `Product` | products | name, sku, type, unitPrice, taxRate, pricingTiers, customFields | (organizationId, sku) | → Organization |
| `Invoice` | invoices | invoiceNumber, customerId, customerSnapshot, items[], taxBreakdown[], grandTotal, amountDue, status, aiRiskScore | (organizationId, invoiceNumber) | → Organization, Customer, User |
| `Payment` | payments | invoiceId, customerId, amount, paymentMethod, status | — | → Organization, Invoice, Customer |
| `CreditNote` | creditnotes | creditNoteNumber, originalInvoiceId, items[], totalAmount, status | (organizationId, creditNoteNumber) | → Organization, Invoice, Customer |
| `RecurringProfile` | recurringprofiles | customerId, items[], frequency, nextRunDate, status, maxOccurrences | — | → Organization, Customer, User |
| `InvoiceTemplate` | invoicetemplates | templateName, layout, brandColors, fontFamily, isDefault | (organizationId, templateName) | → Organization |
| `ApprovalQueue` | approvalqueues | entityType, entityId, requestedBy, status, reviewedBy | — | → Organization, User |
| `BusinessRule` | businessrules | ruleName, event, condition, action, isActive | — | → Organization |
| `CustomField` | customfielddefinitions | targetEntity, fieldName, label, fieldType, options, required | (organizationId, targetEntity, fieldName) | → Organization |
| `AuditLog` | auditlogs | userId, userEmail, action, entityType, entityId, details | (organizationId, createdAt) | → Organization, User |

---

### Billing Engine

---

#### `backend/src/billing-engine/calculators/invoice-calculator.ts`
**Purpose:** Deterministic, stateless invoice calculation engine
**Contains:** `calculateInvoice()`, `resolveTierPrice()`
**Inputs:** Array of `RawInvoiceItemInput` + `CalculationOptions` (taxSystem, states, discount)
**Outputs:** `{ items: InvoiceItem[], totals: InvoiceTotals }`
**Important Logic:**
1. Resolves unit price via volume-based pricing tiers
2. Calculates per-line: base amount → discount → taxable amount → tax (via tax engine)
3. Aggregates: subtotal, item discounts, invoice-level discount, taxable amount, tax breakdown (by type + rate), grand total
4. All amounts rounded to 2 decimal places to avoid floating-point errors
**Used By:** `invoice.controller.ts` (create, update, preview), `recurring-invoice.job.ts`, `seed.ts`

---

#### `backend/src/billing-engine/tax-engine/tax-calculator.ts`
**Purpose:** Multi-jurisdiction tax calculation
**Contains:** `calculateLineTaxes()`
**Important Logic:**
- **GST (India):** Determines intra-state vs inter-state by comparing origin/destination states
  - Intra-state: splits into **CGST** (half rate) + **SGST** (half rate)
  - Inter-state: applies **IGST** (full rate)
- **VAT:** Single VAT line
- **SALES_TAX:** Single sales tax line
- **NONE:** Zero tax
**Used By:** `invoice-calculator.ts`

---

#### `backend/src/billing-engine/billing-models/presets.ts`
**Purpose:** Industry-specific billing configuration templates
**Contains:** `BILLING_MODEL_PRESETS` record with 5 presets: retail, subscription, rental, logistics, professional_services
**Important Logic:** Each preset defines: default tax system, enabled modules, and suggested custom fields that auto-inject during registration or model switch
**Used By:** `auth.controller.ts` (registration), `organization.controller.ts` (model switch), `dynamic.controller.ts` (presets API), `ai.controller.ts` (onboarding suggestion)

---

### Dynamic Engine

---

#### `backend/src/dynamic-engine/custom-fields/field-validator.ts`
**Purpose:** Runtime validation of tenant-defined custom fields
**Contains:** `validateCustomFields(definitions, data)`
**Important Logic:** Iterates field definitions, validates: required check, type coercion (number, boolean), select option membership, regex pattern matching for text fields
**Used By:** `customer.controller.ts`, `product.controller.ts`, `invoice.controller.ts`

---

#### `backend/src/dynamic-engine/rules/rule-evaluator.ts`
**Purpose:** Event-driven business rule evaluation engine
**Contains:** `evaluateBusinessRules(rules, event, context)`
**Important Logic:**
1. Filters active rules matching the given event
2. Evaluates condition against context (supports: invoiceSubtotal, itemCount, customerState, customFields.*)
3. Operators: equals, not_equals, greater_than, less_than, contains, in
4. Actions: apply_discount, add_surcharge, require_approval, set_field
5. Returns aggregated effects: modified discount %, surcharge amount, approval requirement, injected fields
**Used By:** `invoice.controller.ts` (create, preview)

---

### AI Layer

---

#### `backend/src/ai/invoice-agent/invoice-copilot.ts`
**Purpose:** Natural language → structured invoice draft conversion
**Contains:** `parseInvoicePromptWithTools(organizationId, prompt)`
**Important Logic:**
1. Fetches tenant's active customers and products from DB
2. Fuzzy-matches customer by name/company in prompt text
3. Identifies products by name/SKU match, extracts quantities via regex patterns
4. Detects price overrides (e.g., "at ₹500 each")
5. Falls back to ad-hoc line items if no catalog match
6. Extracts due date offset from prompt (e.g., "due in 7 days")
**Used By:** `ai.controller.ts` → `draftInvoiceCopilot()`

---

#### `backend/src/ai/finance-agent/ask-business.ts`
**Purpose:** Natural language business intelligence query processor
**Contains:** `processAskBusinessQuery(organizationId, query)`
**Important Logic:**
1. Fetches all invoices, payments, and customers for the tenant
2. Computes aggregates: total revenue, collected, outstanding, overdue
3. Keyword-matches query type: revenue/sales, overdue/unpaid, customer/client
4. Returns structured answer with chart data (labels + datasets), sources used, and suggested follow-up queries
**Used By:** `ai.controller.ts` → `askBusiness()`

---

### Frontend Architecture

---

#### `frontend/src/api/client.ts`
**Purpose:** Centralized API client with auth token injection
**Contains:** `apiRequest<T>(endpoint, options)`
**Important Logic:**
- Reads JWT from `localStorage.billing_auth_token`
- Prepends `/api/v1` base URL (proxied to backend via Vite)
- On 401 response: clears all localStorage auth data
- On network failure: returns structured error object instead of throwing
**Used By:** Every page and the AuthContext

---

#### `frontend/src/context/AuthContext.tsx`
**Purpose:** Global authentication state management
**Contains:** `AuthProvider` component, `useAuth()` hook
**State:** `user`, `organization`, `token`, `isLoading`
**Important Logic:**
- Initializes state from localStorage (hydration on refresh)
- `login()`: sets state + persists to localStorage
- `logout()`: clears everything + redirects to `/login`
- `refreshProfile()`: calls `GET /api/v1/auth/me` to validate token on mount
- `updateOrganization()`: updates org state in-place (used after settings changes)

---

#### `frontend/src/App.tsx`
**Purpose:** Root application component with client-side routing
**Contains:** `App` (AuthProvider wrapper), `RouterShell` (path-based router)
**Important Logic:**
- Uses `window.history.pushState` for SPA navigation (no router library)
- Conditional rendering: unauthenticated → Login/Register; authenticated → AppLayout + pages
- Routes: `/dashboard`, `/invoices`, `/invoices/create`, `/invoices/:id`, `/customers`, `/products`, `/settings`, `/onboarding`
- Passes `copilotDraft` state from AI Copilot drawer to CreateInvoicePage

---

## 4. Complete Architecture

```text
┌──────────────────────────────────────────────────────────────────┐
│                        BROWSER (React 19)                        │
│  ┌─────────────┐  ┌──────────┐  ┌─────────────────────────────┐ │
│  │ AuthContext  │  │ API      │  │ Pages                       │ │
│  │ (JWT +      │  │ Client   │  │ Dashboard · Invoices ·      │ │
│  │  localStorage)│ │ (fetch)  │  │ Customers · Products ·     │ │
│  └──────┬──────┘  └────┬─────┘  │ Settings · Onboarding      │ │
│         │              │        └─────────────────────────────┘ │
│         │              │        ┌─────────────────────────────┐ │
│         │              │        │ Components                  │ │
│         │              │        │ AppLayout · Sidebar ·       │ │
│         │              │        │ AiCopilotDrawer ·           │ │
│         │              │        │ DynamicFieldRenderer        │ │
│         │              │        └─────────────────────────────┘ │
└─────────┼──────────────┼────────────────────────────────────────┘
          │              │
          │    Vite Dev Proxy (/api → localhost:5000)
          │              │
┌─────────┼──────────────┼────────────────────────────────────────┐
│         │    EXPRESS SERVER (Port 5000)                          │
│         ▼              ▼                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              GLOBAL MIDDLEWARE CHAIN                      │   │
│  │  CORS → JSON Parser → URL Parser → Morgan → Rate Limiter│   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │                                       │
│  ┌──────────────────────▼───────────────────────────────────┐   │
│  │                   ROUTE MODULES (15)                      │   │
│  │  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────────┐  │   │
│  │  │  Auth   │ │ Invoices │ │Customers│ │  Products    │  │   │
│  │  │(public) │ │(tenant)  │ │(tenant) │ │  (tenant)    │  │   │
│  │  └────┬────┘ └────┬─────┘ └────┬────┘ └──────┬───────┘  │   │
│  │       │           │            │              │          │   │
│  │  ┌────┴───┐  ┌────┴────┐ ┌────┴────┐  ┌──────┴───────┐  │   │
│  │  │Payments│  │Credit   │ │Recurring│  │  Reports     │  │   │
│  │  │(tenant)│  │Notes    │ │(tenant) │  │  (tenant)    │  │   │
│  │  └────┬───┘  └────┬────┘ └────┬────┘  └──────┬───────┘  │   │
│  │       │           │           │               │          │   │
│  │  ┌────┴───┐  ┌────┴────┐ ┌────┴────┐  ┌──────┴───────┐  │   │
│  │  │  AI    │  │Templates│ │Approvals│  │  Dynamic     │  │   │
│  │  │(mixed) │  │(tenant) │ │(tenant) │  │  (mixed)     │  │   │
│  │  └────┬───┘  └────┬────┘ └────┬────┘  └──────┬───────┘  │   │
│  │       │           │           │               │          │   │
│  │  ┌────┴───┐  ┌────┴────┐ ┌────┴─────────┐    │          │   │
│  │  │ Users  │  │  Audit  │ │Organizations │    │          │   │
│  │  │(tenant)│  │(tenant) │ │(tenant)      │    │          │   │
│  │  └────────┘  └─────────┘ └──────────────┘    │          │   │
│  └──────────────────────────────────────────────┘           │   │
│                         │                                       │
│  ┌──────────────────────▼──────────────────────────────────┐    │
│  │           PER-ROUTE MIDDLEWARE CHAIN                      │   │
│  │  tenantMiddleware → requireRole → validate(zodSchema)    │   │
│  └──────────────────────┬──────────────────────────────────┘    │
│                         │                                       │
│  ┌──────────────────────▼──────────────────────────────────┐    │
│  │                CONTROLLERS (Business Logic)              │   │
│  │  ┌─────────────┐ ┌──────────────┐ ┌─────────────────┐   │   │
│  │  │ Billing     │ │ Dynamic      │ │ AI              │   │   │
│  │  │ Engine      │ │ Engine       │ │ Agents          │   │   │
│  │  │(calculator) │ │(field valid.)│ │(copilot, query) │   │   │
│  │  │(tax engine) │ │(rule eval.)  │ │(OCR, reminders) │   │   │
│  │  └──────┬──────┘ └──────┬───────┘ └────────┬────────┘   │   │
│  └─────────┼───────────────┼──────────────────┘            │   │
│            │               │                                    │
│  ┌─────────▼───────────────▼───────────────────────────────┐    │
│  │              MONGOOSE MODELS (12 Collections)            │   │
│  └──────────────────────┬──────────────────────────────────┘    │
│                         │                                       │
└─────────────────────────┼───────────────────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │     MongoDB 7.0       │
              │  (adaptive_billing)   │
              └───────────────────────┘
```

### Authentication & Authorization
- **Method:** Stateless JWT (7-day expiry)
- **Token payload:** `{ organizationId, userId, role, email }`
- **Storage:** `localStorage` on frontend
- **Middleware:** `tenantMiddleware` (JWT verify) + `requireRole([...])` (RBAC)
- **Roles:** `admin`, `manager`, `accountant`, `sales`, `viewer`

### Multi-Tenancy
- **Strategy:** Shared database, row-level isolation
- **Mechanism:** Every model has `organizationId` field (indexed); every query filters by `req.tenant.organizationId`
- **Registration:** Creates Organization + Admin User atomically

### Validation
- **Request validation:** Zod schemas via `validate()` middleware
- **Custom field validation:** Dynamic `validateCustomFields()` against per-tenant field definitions
- **Database validation:** Mongoose schema-level validation

### Error Handling
- **Frontend:** `apiRequest()` catches network errors, returns structured error objects
- **Backend:** Global `errorHandler` middleware classifies and formats all errors
- **Audit trail:** `logAuditEvent()` called in every write operation

---

## 5. Complete Code Flow

### Example: User Creates an Invoice

```text
User fills invoice form in browser
        ↓
CreateInvoicePage.tsx → handleCreateInvoice()
        ↓
apiRequest('/invoices', { method: 'POST', body: JSON.stringify(invoiceData) })
        ↓
frontend/src/api/client.ts → fetch('/api/v1/invoices', { headers: { Authorization: 'Bearer <JWT>' } })
        ↓
Vite Proxy rewrites /api → http://localhost:5000/api
        ↓
EXPRESS SERVER receives POST /api/v1/invoices
        ↓
GLOBAL MIDDLEWARE: cors → json parser → morgan → rateLimiter
        ↓
invoice.routes.ts → router.use(tenantMiddleware)
        ↓
tenant.middleware.ts → tenantMiddleware(): verifies JWT, extracts TenantContext → req.tenant
        ↓
invoice.routes.ts → router.post('/', validate(createInvoiceSchema), createInvoice)
        ↓
validate.middleware.ts → validate(createInvoiceSchema): parses req.body with Zod
        ↓
invoice.controller.ts → createInvoice(req, res, next)
        ↓
1. Fetches Organization & Customer from DB (scoped by organizationId)
2. CustomFieldModel.find() → validateCustomFields(fieldDefs, customFields)
3. BusinessRuleModel.find() → evaluateBusinessRules(rules, 'beforeInvoiceCalculate', context)
4. calculateInvoice(items, options) → processes items, resolves tiers, computes taxes
5. Generates sequential invoiceNumber: ORG_PREFIX-YEAR-SEQ
6. Atomically increments org.settings.nextInvoiceNumber
7. Heuristic AI risk scoring (based on customer.outstandingBalance and grandTotal)
8. InvoiceModel.create({ ...fullInvoiceDocument })
9. CustomerModel.findByIdAndUpdate → $inc outstandingBalance (if sent/approved)
10. logAuditEvent({ action: 'CREATE_INVOICE', ... })
        ↓
res.status(201).json({ success: true, data: invoice, ruleEffects })
        ↓
apiRequest() returns response to CreateInvoicePage
        ↓
navigate('/invoices/' + invoice._id) → renders InvoiceDetailPage
```

---

## 6. Feature-by-Feature Workflow

### REGISTRATION

```text
User fills RegisterPage.tsx form
        ↓
handleRegister() → apiRequest('/auth/register', { method: 'POST', body })
        ↓
POST /api/v1/auth
        ↓
validate(registerSchema) → auth.controller.ts → register()
        ↓
1. OrganizationModel.create({ name, slug, billingModel })
2. BILLING_MODEL_PRESETS[model].suggestedCustomFields → CustomFieldModel.create(each)
3. bcrypt.genSalt(10) → bcrypt.hash(password) → UserModel.create({ role: 'admin' })
4. jwt.sign({ organizationId, userId, role, email }) → token
5. logAuditEvent('REGISTER_ORGANIZATION')
        ↓
Response: { token, user, organization }
        ↓
AuthContext.login(token, user, organization) → localStorage persistence
        ↓
RouterShell renders DashboardPage
```

### LOGIN

```text
User fills LoginPage.tsx form
        ↓
handleLogin() → apiRequest('/auth/login', { method: 'POST', body: { email, password } })
        ↓
POST /api/v1/auth/login
        ↓
validate(loginSchema) → auth.controller.ts → login()
        ↓
1. UserModel.findOne({ email }) → bcrypt.compare(password, passwordHash)
2. OrganizationModel.findById(user.organizationId)
3. jwt.sign({ organizationId, userId, role, email }) → token
        ↓
Response: { token, user, organization }
        ↓
AuthContext.login() → localStorage → RouterShell → DashboardPage
```

### CREATE CUSTOMER

```text
User clicks "Add Customer" on CustomersPage.tsx
        ↓
handleSave() → apiRequest('/customers', { method: 'POST', body })
        ↓
POST /api/v1/customers
        ↓
tenantMiddleware → validate(createCustomerSchema) → customer.controller.ts → createCustomer()
        ↓
1. CustomFieldModel.find() → validateCustomFields(fieldDefs, customFields)
2. CustomerModel.create({ organizationId, ...data })
3. logAuditEvent('CREATE_CUSTOMER')
        ↓
Response: { success: true, data: customer }
        ↓
Customer list refreshes
```

### CREATE PRODUCT

```text
User clicks "Add Product" on ProductsPage.tsx
        ↓
handleSave() → apiRequest('/products', { method: 'POST', body })
        ↓
POST /api/v1/products
        ↓
tenantMiddleware → validate(createProductSchema) → product.controller.ts → createProduct()
        ↓
1. ProductModel.findOne({ sku }) → duplicate SKU check
2. CustomFieldModel.find() → validateCustomFields()
3. ProductModel.create({ organizationId, ...data })
4. logAuditEvent('CREATE_PRODUCT')
        ↓
Response: { success: true, data: product }
```

### RECORD PAYMENT

```text
User opens InvoiceDetailPage.tsx → fills payment form → "Record Payment"
        ↓
handleRecordPayment() → apiRequest('/payments', { method: 'POST', body })
        ↓
POST /api/v1/payments
        ↓
tenantMiddleware → requireRole(['admin','manager','accountant']) → validate(recordPaymentSchema)
        ↓
payment.controller.ts → recordPayment()
        ↓
1. InvoiceModel.findOne({ _id: invoiceId, organizationId })
2. PaymentModel.create({ organizationId, invoiceId, customerId, amount, ... })
3. Invoice: amountPaid += amount, amountDue = max(0, grandTotal - updatedPaid)
4. Invoice: status = (amountDue === 0) ? 'paid' : 'partially_paid'
5. Invoice: push to paymentHistory[]
6. CustomerModel: $inc outstandingBalance by -paymentAmount
7. logAuditEvent('RECORD_PAYMENT')
        ↓
Response: { payment, invoice: { amountPaid, amountDue, status } }
        ↓
InvoiceDetailPage re-fetches and re-renders
```

### AI COPILOT DRAFT INVOICE

```text
User opens AiCopilotDrawer → types "Create invoice for Apex Global for 2 cloud servers"
        ↓
handleDraftInvoice() → apiRequest('/ai/copilot/draft-invoice', { method: 'POST', body: { prompt } })
        ↓
POST /api/v1/ai/copilot/draft-invoice
        ↓
tenantMiddleware → ai.controller.ts → draftInvoiceCopilot()
        ↓
invoice-copilot.ts → parseInvoicePromptWithTools(orgId, prompt)
        ↓
1. CustomerModel.find({ orgId, isActive }) → fuzzy name match "Apex Global"
2. ProductModel.find({ orgId, isActive }) → match "cloud server" by name
3. Regex: extract quantity "2", detect price overrides
4. Build InvoiceCopilotDraft { customerName, customerId, items[], dueDateOffsetDays, confidenceScore }
        ↓
Response: { success: true, data: draft }
        ↓
AiCopilotDrawer shows preview → user clicks "Apply to Invoice Form"
        ↓
onApplyDraftToInvoice(draft) → navigate('/invoices/create') with copilotDraft state
        ↓
CreateInvoicePage hydrates form from draft
```

### AI ASK BUSINESS QUERY

```text
User opens AiCopilotDrawer → switches to "Ask Business" tab
        ↓
Types: "How much revenue have we earned?"
        ↓
handleAskBusiness() → apiRequest('/ai/ask-business', { method: 'POST', body: { query } })
        ↓
POST /api/v1/ai/ask-business
        ↓
tenantMiddleware → ai.controller.ts → askBusiness()
        ↓
ask-business.ts → processAskBusinessQuery(orgId, query)
        ↓
1. Fetches ALL invoices, payments, customers for tenant
2. Computes: totalRevenue, totalCollected, totalOutstanding
3. Keyword matching: "revenue" → revenue summary response
4. Returns: { answer (markdown), chartData, sourcesUsed, suggestedFollowUps }
        ↓
AiCopilotDrawer renders answer + chart data + follow-up suggestions
```

### DASHBOARD LOAD

```text
User navigates to /dashboard → DashboardPage.tsx mounts
        ↓
useEffect → apiRequest('/reports/dashboard-summary')
        ↓
GET /api/v1/reports/dashboard-summary
        ↓
tenantMiddleware → report.controller.ts → getDashboardSummary()
        ↓
1. Parallel fetch: all invoices, payments, active customers
2. Compute KPIs: totalRevenue, totalCollected, totalOutstanding, overdueAmount, paidCount, pendingCount
3. Detect anomalies: high discounts (>20%), HIGH aiRiskScore invoices
4. Build cashflow projection (4-week forecast heuristic)
5. Compose AI daily brief: greeting, summary bullets, priority actions
6. Assemble DashboardSummary object
        ↓
Response: { success: true, data: DashboardSummary }
        ↓
DashboardPage renders: KPI cards, cashflow chart, recent invoices, anomaly alerts, AI brief
```

### REFUND PAYMENT

```text
POST /api/v1/payments/:id/refund
        ↓
tenantMiddleware → requireRole(['admin','manager']) → validate(refundPaymentSchema)
        ↓
payment.controller.ts → refundPayment()
        ↓
1. PaymentModel.findOne({ _id: paymentId, organizationId })
2. Guard: already refunded check
3. Calculate refundAmount (partial or full)
4. Invoice: amountPaid -= refundAmount, amountDue += refundAmount
5. Invoice: status recalculated
6. CustomerModel: $inc outstandingBalance by +refundAmount
7. Payment: status = 'refunded', notes appended
8. logAuditEvent('REFUND_PAYMENT')
```

### RECURRING INVOICE GENERATION

```text
recurring.controller.ts → triggerManualRun() OR processAllPendingRecurringInvoices()
        ↓
recurring-invoice.job.ts → executeRecurringProfileGeneration(profile)
        ↓
1. Fetch org + customer
2. calculateInvoice(profile.items, { taxSystem, states, discount })
3. Generate invoiceNumber (ORG-YEAR-SEQ), increment counter
4. InvoiceModel.create({ status: autoSend ? 'sent' : 'draft' })
5. If sent: CustomerModel $inc outstandingBalance
6. Profile: totalGeneratedCount++, nextRunDate = calculateNextRunDate()
7. If maxOccurrences reached or endDate passed: status = 'completed'
```

---

## 7. API Documentation

### Auth Endpoints

| Method | Endpoint | Auth | Purpose | Controller | Validation |
|---|---|---|---|---|---|
| POST | `/api/v1/auth/register` | ❌ | Register org + admin user | `register()` | `registerSchema` |
| POST | `/api/v1/auth/login` | ❌ | Login | `login()` | `loginSchema` |
| GET | `/api/v1/auth/me` | ✅ | Get current user + org | `getMe()` | — |

### Invoice Endpoints

| Method | Endpoint | Auth | Roles | Purpose | Controller |
|---|---|---|---|---|---|
| GET | `/api/v1/invoices` | ✅ | Any | List invoices (paginated, filterable) | `listInvoices()` |
| GET | `/api/v1/invoices/:id` | ✅ | Any | Get invoice detail | `getInvoice()` |
| POST | `/api/v1/invoices/preview` | ✅ | Any | Calculate invoice preview (no save) | `calculatePreview()` |
| POST | `/api/v1/invoices` | ✅ | Any | Create invoice | `createInvoice()` |
| PATCH | `/api/v1/invoices/:id` | ✅ | Any | Update draft invoice | `updateInvoice()` |
| PATCH | `/api/v1/invoices/:id/status` | ✅ | admin/manager/accountant | Change invoice status | `updateInvoiceStatus()` |
| DELETE | `/api/v1/invoices/:id` | ✅ | admin/manager | Cancel invoice | `deleteInvoice()` |

### Customer Endpoints

| Method | Endpoint | Auth | Roles | Purpose |
|---|---|---|---|---|
| GET | `/api/v1/customers` | ✅ | Any | List customers |
| GET | `/api/v1/customers/:id` | ✅ | Any | Get customer |
| POST | `/api/v1/customers` | ✅ | Any | Create customer |
| PATCH | `/api/v1/customers/:id` | ✅ | Any | Update customer |
| DELETE | `/api/v1/customers/:id` | ✅ | admin/manager | Deactivate customer |

### Product Endpoints

| Method | Endpoint | Auth | Roles | Purpose |
|---|---|---|---|---|
| GET | `/api/v1/products` | ✅ | Any | List products |
| GET | `/api/v1/products/:id` | ✅ | Any | Get product |
| POST | `/api/v1/products` | ✅ | Any | Create product |
| PATCH | `/api/v1/products/:id` | ✅ | Any | Update product |
| DELETE | `/api/v1/products/:id` | ✅ | admin/manager | Deactivate product |

### Payment Endpoints

| Method | Endpoint | Auth | Roles | Purpose |
|---|---|---|---|---|
| GET | `/api/v1/payments` | ✅ | Any | List payments |
| POST | `/api/v1/payments` | ✅ | admin/manager/accountant | Record payment |
| POST | `/api/v1/payments/:id/refund` | ✅ | admin/manager | Refund payment |

### Credit Note Endpoints

| Method | Endpoint | Auth | Roles | Purpose |
|---|---|---|---|---|
| GET | `/api/v1/credit-notes` | ✅ | Any | List credit notes |
| GET | `/api/v1/credit-notes/:id` | ✅ | Any | Get credit note |
| POST | `/api/v1/credit-notes` | ✅ | admin/manager/accountant | Create credit note |

### Recurring Profile Endpoints

| Method | Endpoint | Auth | Roles | Purpose |
|---|---|---|---|---|
| GET | `/api/v1/recurring` | ✅ | Any | List recurring profiles |
| POST | `/api/v1/recurring` | ✅ | admin/manager/accountant | Create profile |
| PATCH | `/api/v1/recurring/:id` | ✅ | admin/manager | Update profile |
| POST | `/api/v1/recurring/:id/run` | ✅ | admin/manager | Trigger manual run |

### Template Endpoints

| Method | Endpoint | Auth | Roles | Purpose |
|---|---|---|---|---|
| GET | `/api/v1/invoice-templates` | ✅ | Any | List templates |
| POST | `/api/v1/invoice-templates` | ✅ | admin | Create template |
| PATCH | `/api/v1/invoice-templates/:id` | ✅ | admin | Update template |
| DELETE | `/api/v1/invoice-templates/:id` | ✅ | admin | Delete template |

### Approval Endpoints

| Method | Endpoint | Auth | Roles | Purpose |
|---|---|---|---|---|
| GET | `/api/v1/approvals` | ✅ | Any | List pending approvals |
| POST | `/api/v1/approvals/:id/approve` | ✅ | admin/manager | Approve item |
| POST | `/api/v1/approvals/:id/reject` | ✅ | admin/manager | Reject item |

### Organization Endpoints

| Method | Endpoint | Auth | Roles | Purpose |
|---|---|---|---|---|
| GET | `/api/v1/organizations/profile` | ✅ | Any | Get org profile |
| PATCH | `/api/v1/organizations/settings` | ✅ | admin | Update settings |
| POST | `/api/v1/organizations/switch-model` | ✅ | admin | Switch billing model |

### User Management Endpoints

| Method | Endpoint | Auth | Roles | Purpose |
|---|---|---|---|---|
| GET | `/api/v1/users` | ✅ | Any | List team members |
| POST | `/api/v1/users` | ✅ | admin | Create user |
| PATCH | `/api/v1/users/:id` | ✅ | admin | Update user |

### Dynamic Engine Endpoints

| Method | Endpoint | Auth | Roles | Purpose |
|---|---|---|---|---|
| GET | `/api/v1/dynamic/presets` | ❌ | — | Get billing model presets |
| GET | `/api/v1/dynamic/fields` | ✅ | Any | List custom fields |
| POST | `/api/v1/dynamic/fields` | ✅ | admin | Create custom field |
| DELETE | `/api/v1/dynamic/fields/:id` | ✅ | admin | Delete custom field |
| GET | `/api/v1/dynamic/rules` | ✅ | Any | List business rules |
| POST | `/api/v1/dynamic/rules` | ✅ | admin | Create business rule |
| DELETE | `/api/v1/dynamic/rules/:id` | ✅ | admin | Delete business rule |

### AI Endpoints

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/ai/onboarding/suggest-model` | ❌ | AI-suggest billing model from description |
| POST | `/api/v1/ai/copilot/draft-invoice` | ✅ | Natural language → invoice draft |
| POST | `/api/v1/ai/ask-business` | ✅ | Business intelligence Q&A |
| POST | `/api/v1/ai/ocr/parse-document` | ✅ | Heuristic OCR text → invoice data extraction |
| POST | `/api/v1/ai/reminders/generate` | ✅ | Generate payment reminder emails (3 tones) |
| POST | `/api/v1/ai/templates/generate` | ✅ | AI-generate invoice template spec |

### Report Endpoints

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/reports/dashboard-summary` | ✅ | Full dashboard with KPIs, cashflow, anomalies, AI brief |
| GET | `/api/v1/reports/revenue` | ✅ | Revenue report (groupable by day/month) |
| GET | `/api/v1/reports/ar-aging` | ✅ | Accounts receivable aging buckets |
| GET | `/api/v1/reports/customer-statement/:customerId` | ✅ | Customer ledger statement |
| GET | `/api/v1/reports/top-customers` | ✅ | Top 10 customers by outstanding balance |

### Audit Endpoints

| Method | Endpoint | Auth | Roles | Purpose |
|---|---|---|---|---|
| GET | `/api/v1/audit-logs` | ✅ | admin/manager | Paginated audit trail |

### Health Check

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/health` | ❌ | Service health status |

---

## 8. Database Analysis

### Technology
**Database:** MongoDB 7.0 (via Docker or local)
**ODM:** Mongoose 8.10.1
**Connection:** `backend/src/config/db.ts` — connects with strict query mode enabled

### Collections (13 total)

| Collection | Model File | Indexes |
|---|---|---|
| `organizations` | Organization.model.ts | `slug` (unique) |
| `users` | User.model.ts | `(organizationId, email)` unique |
| `customers` | Customer.model.ts | `(orgId, name)`, `(orgId, email)`, `(orgId, gstinOrTaxId)` |
| `products` | Product.model.ts | `(orgId, sku)` unique, `(orgId, name)` |
| `invoices` | Invoice.model.ts | `(orgId, invoiceNumber)` unique, `(orgId, issueDate)`, `(orgId, dueDate)`, `(orgId, status)` |
| `payments` | Payment.model.ts | `(orgId, paymentDate)` |
| `creditnotes` | CreditNote.model.ts | `(orgId, creditNoteNumber)` unique, `(orgId, originalInvoiceId)` |
| `recurringprofiles` | RecurringProfile.model.ts | `(orgId, status, nextRunDate)` |
| `invoicetemplates` | InvoiceTemplate.model.ts | `(orgId, templateName)` unique |
| `approvalqueues` | ApprovalQueue.model.ts | `(orgId, status)`, `(orgId, entityType, entityId)` |
| `businessrules` | BusinessRule.model.ts | `(orgId, event)` |
| `customfielddefinitions` | CustomField.model.ts | `(orgId, targetEntity, fieldName)` unique |
| `auditlogs` | audit.service.ts | `(orgId, createdAt)` desc |

### Data Flow: UI → Database → UI

```text
UI Form Data → apiRequest() → Express → validate(Zod) → Controller
→ validateCustomFields(dynamic) → evaluateBusinessRules() → calculateInvoice()
→ Model.create() / .findOneAndUpdate() → MongoDB
→ Controller Response → apiRequest() return → React state update → UI re-render
```

### Seed Data
The `seed.ts` file populates a complete demo tenant:
- **Organization:** Nexus Cloud Technologies (subscription billing model)
- **Users:** admin@nexuscloud.io (Admin), rajesh@nexuscloud.io (Accountant) — password: `Admin@123456`
- **Products:** 4 SaaS/consulting products (₹12K–₹120K range)
- **Customers:** 3 customers across different states (tests IGST vs CGST/SGST)
- **Invoices:** 3 invoices in different states (paid, partially_paid, overdue)
- **Payments:** 2 payment records
- **Custom Fields:** 3 definitions (projectCode, billingCycle, slaTier)
- **Business Rules:** 2 rules (volume discount > ₹1L, approval > 8 items)

---

## 9. Authentication & Authorization Flow

```text
REGISTRATION
    ↓
RegisterPage.tsx → POST /api/v1/auth/register
    ↓
validate(registerSchema) — Zod validates: name, email, password (8+ chars), organizationName, billingModel
    ↓
auth.controller.ts → register()
    ↓
OrganizationModel.create() — slug generated from name + random suffix
    ↓
BILLING_MODEL_PRESETS → CustomFieldModel.create() (per suggested field)
    ↓
bcrypt.genSalt(10) → bcrypt.hash(password)
    ↓
UserModel.create({ role: 'admin', passwordHash })
    ↓
jwt.sign({ organizationId, userId, role, email }, JWT_SECRET, { expiresIn: '7d' })
    ↓
logAuditEvent('REGISTER_ORGANIZATION')
    ↓
Response: { token, user, organization }
    ↓
AuthContext.login() → localStorage.setItem('billing_auth_token', token)

LOGIN
    ↓
LoginPage.tsx → POST /api/v1/auth/login
    ↓
validate(loginSchema)
    ↓
UserModel.findOne({ email }) → bcrypt.compare(password, user.passwordHash)
    ↓
OrganizationModel.findById(user.organizationId)
    ↓
jwt.sign({ organizationId, userId, role, email })
    ↓
Response: { token, user, organization }

AUTHENTICATED REQUEST
    ↓
apiRequest() injects header: Authorization: Bearer <token>
    ↓
tenantMiddleware(): jwt.verify(token, JWT_SECRET) → req.tenant = decoded TenantContext
    ↓
requireRole(['admin','manager']): checks req.tenant.role ∈ allowedRoles

SESSION REFRESH (on page load)
    ↓
AuthContext.useEffect → GET /api/v1/auth/me
    ↓
tenantMiddleware → getMe(): UserModel.findById + OrganizationModel.findById
    ↓
If fails: AuthContext.logout() → clears localStorage → redirects to /login
```

---

## 10. State Management Flow

### Frontend State Architecture

The application uses **React Context + Component State** (no Redux/Zustand).

**Global State (AuthContext):**
- `user: User | null` — current logged-in user
- `organization: Organization | null` — current tenant
- `token: string | null` — JWT token
- `isLoading: boolean` — initial auth verification

**Page-Level State (useState hooks in each page):**
- Each page manages its own data fetching, lists, modals, forms, loading states
- Data is fetched on mount via `useEffect` → `apiRequest()`
- No cross-page state sharing except through AuthContext
- The `copilotDraft` state bridges AiCopilotDrawer → CreateInvoicePage via App.tsx

**Persistence:**
- `localStorage.billing_auth_token` — JWT
- `localStorage.billing_user` — serialized User object
- `localStorage.billing_org` — serialized Organization object

---

## 11. Error & Validation Flow

```text
USER INPUT
    ↓
FRONTEND: React form validation (basic checks in handleSubmit)
    ↓
API REQUEST
    ↓
BACKEND: validate(zodSchema) middleware
    ├── Valid: req.body replaced with parsed/coerced data → next()
    └── Invalid: 400 { code: 'VALIDATION_ERROR', details: [{ path, message }] }
    ↓
CONTROLLER: Manual business validation
    ├── Missing data: 400 { code: 'VALIDATION_ERROR', message: '...' }
    ├── Not found: 404 { code: 'NOT_FOUND', message: '...' }
    └── Business rule: 400 { code: 'IMMUTABLE_INVOICE' | 'CANNOT_DELETE_PAID' | ... }
    ↓
DYNAMIC VALIDATION: validateCustomFields()
    └── Invalid: 400 { code: 'CUSTOM_FIELD_ERROR', details: [{ field, message }] }
    ↓
MONGOOSE VALIDATION: Schema-level validation on save
    └── error.middleware.ts handles: ValidationError → 400, CastError → 400, E11000 → 409
    ↓
UNHANDLED: error.middleware.ts → 500 { code: 'SERVER_ERROR' }
    ↓
FRONTEND: apiRequest() catches → returns { success: false, error: { code, message } }
    ↓
PAGE: Displays error.message in alert/notification
```

---

## 12. Dependency & Import Relationships

```text
App.tsx
├── uses AuthContext.tsx (useAuth hook)
├── uses AppLayout.tsx
│   ├── uses Sidebar.tsx (navigation)
│   ├── uses Navbar.tsx (top bar)
│   └── uses AiCopilotDrawer.tsx
│       └── calls apiRequest('/ai/copilot/draft-invoice')
│       └── calls apiRequest('/ai/ask-business')
├── uses LoginPage.tsx → calls apiRequest('/auth/login')
├── uses RegisterPage.tsx → calls apiRequest('/auth/register')
├── uses DashboardPage.tsx → calls apiRequest('/reports/dashboard-summary')
├── uses CreateInvoicePage.tsx
│   ├── calls apiRequest('/customers')
│   ├── calls apiRequest('/products')
│   ├── calls apiRequest('/invoices/preview')
│   ├── calls apiRequest('/invoices')
│   └── uses DynamicFieldRenderer.tsx → calls apiRequest('/dynamic/fields')
├── uses InvoiceDetailPage.tsx
│   ├── calls apiRequest('/invoices/:id')
│   └── calls apiRequest('/payments')
├── uses InvoicesListPage.tsx → calls apiRequest('/invoices')
├── uses CustomersPage.tsx
│   └── calls apiRequest('/customers') (list/create/update/delete)
├── uses ProductsPage.tsx
│   └── calls apiRequest('/products') (list/create/update/delete)
└── uses SettingsPage.tsx
    ├── calls apiRequest('/organizations/profile')
    ├── calls apiRequest('/organizations/settings')
    ├── calls apiRequest('/users')
    ├── calls apiRequest('/dynamic/fields')
    ├── calls apiRequest('/dynamic/rules')
    └── calls apiRequest('/invoice-templates')

apiRequest (client.ts)
└── reads localStorage.billing_auth_token

invoice.controller.ts
├── uses InvoiceModel
├── uses CustomerModel
├── uses OrganizationModel
├── uses CustomFieldModel
├── uses BusinessRuleModel
├── uses calculateInvoice (billing-engine)
├── uses validateCustomFields (dynamic-engine)
├── uses evaluateBusinessRules (dynamic-engine)
└── uses logAuditEvent (core/audit)

calculateInvoice (invoice-calculator.ts)
├── uses calculateLineTaxes (tax-calculator.ts)
└── uses resolveTierPrice (self)

calculateLineTaxes (tax-calculator.ts)
└── pure function (no dependencies)
```

---

## 13. End-to-End System Workflow

```text
USER (Browser)
    ↓
REACT SPA (Vite dev server :5173)
    ↓
PAGES (Dashboard, Invoices, Customers, Products, Settings)
    ↓
COMPONENT STATE (useState, useEffect)
    ↓
API CLIENT (fetch with JWT, /api/v1/*)
    ↓
VITE PROXY → localhost:5000
    ↓
EXPRESS SERVER
    ↓
GLOBAL MIDDLEWARE (CORS → JSON → Morgan → RateLimiter)
    ↓
ROUTE MODULE SELECTION (15 modules)
    ↓
ROUTE-LEVEL MIDDLEWARE (tenantMiddleware → requireRole → validate)
    ↓
CONTROLLER (business logic orchestration)
    ↓
ENGINES (billing calculator, tax engine, rule evaluator, field validator, AI agents)
    ↓
MONGOOSE MODELS (12 collections)
    ↓
MONGODB (adaptive_billing database)
    ↓
CONTROLLER RESPONSE (JSON { success, data, pagination, error })
    ↓
API CLIENT (apiRequest return)
    ↓
REACT STATE UPDATE (setState)
    ↓
UI RE-RENDER
```

---

## 14. Project Startup & Execution Flow

### Installation
```bash
npm install                    # installs all workspaces (shared, backend, frontend)
```

### Database Setup
```bash
docker-compose up -d           # starts MongoDB 7.0 (:27017) + Redis 7.2 (:6379)
```

### Environment Configuration
```bash
cp .env.example .env           # configure MONGODB_URI, JWT_SECRET, etc.
```

### Seed Database
```bash
npm run seed                   # runs tsx backend/src/seed.ts
```

### Development Start
```bash
npm run dev                    # starts both backend + frontend concurrently
# OR individually:
npm run dev:backend            # tsx watch src/server.ts → :5000
npm run dev:frontend           # vite → :5173
```

### Backend Startup Sequence
1. `dotenv.config()` loads `.env`
2. `connectDB()` → `mongoose.connect(MONGODB_URI)` with strictQuery
3. `createApp()`:
   - CORS middleware (origin: true)
   - JSON body parser (10MB limit)
   - Morgan HTTP logger (dev format)
   - Rate limiter (200 req/min)
4. Mount 15 route modules at `/api/v1/*`
5. Register 404 handler
6. Register global error handler
7. `app.listen(PORT)` → console log with port and env
8. Register SIGTERM/SIGINT shutdown handlers

### Frontend Startup Sequence
1. Vite serves `index.html`
2. Loads Google Fonts (Inter, Outfit, JetBrains Mono)
3. `main.tsx` → `ReactDOM.createRoot`
4. `App` → `AuthProvider` wraps entire app
5. `RouterShell`:
   - Shows loading screen while `isLoading` is true
   - `AuthContext.refreshProfile()` → `GET /api/v1/auth/me` to validate cached token
   - If valid: render AppLayout + current page
   - If invalid/no token: render LoginPage

### Build & Production
```bash
npm run build                  # builds all workspaces: tsc (shared, backend) + vite build (frontend)
cd backend && npm start        # node dist/server.js
```

---

## 15. Configuration & Environment Variables

| Variable | Purpose | Where Read | Subsystem |
|---|---|---|---|
| `PORT` | HTTP server port | `config/env.ts` → `server.ts` | Server |
| `NODE_ENV` | development/production | `config/env.ts` → `error.middleware.ts`, `db.ts` | Error handling, DB recovery |
| `MONGODB_URI` | MongoDB connection string | `config/env.ts` → `db.ts`, `seed.ts` | Database |
| `JWT_SECRET` | JWT signing/verification key | `config/env.ts` → `tenant.middleware.ts`, `auth.controller.ts` | Authentication |
| `JWT_EXPIRES_IN` | Token lifetime | `config/env.ts` (declared, hardcoded to '7d' in auth) | Authentication |
| `CLIENT_URL` | Frontend origin URL | `config/env.ts` (declared, not used — CORS uses `origin: true`) | CORS |
| `OPENAI_API_KEY` | OpenAI API key | `config/env.ts` (declared, **not consumed by any module**) | AI (placeholder) |
| `GEMINI_API_KEY` | Gemini API key | `config/env.ts` (declared, **not consumed by any module**) | AI (placeholder) |
| `REDIS_URL` | Redis connection | `.env.example` only (declared, **not read by code**) | Cache (placeholder) |
| `ANTHROPIC_API_KEY` | Anthropic API key | `.env.example` only (declared, **not read by code**) | AI (placeholder) |
| `STORAGE_DRIVER` | local/S3 | `.env.example` only (declared, **not read by code**) | Storage (placeholder) |
| `STORAGE_LOCAL_PATH` | Upload path | `.env.example` only (declared, **not read by code**) | Storage (placeholder) |

> [!WARNING]
> Several environment variables (`REDIS_URL`, `ANTHROPIC_API_KEY`, `STORAGE_DRIVER`, `STORAGE_LOCAL_PATH`) are declared in `.env.example` but **never read by any source file**. They appear to be planned for future features.

---

## 16. Testing Architecture

### Existing Tests
- **File:** [invoice-calculator.test.ts](file:///d:/var-codes/BIlling%20Application/backend/src/billing-engine/calculators/invoice-calculator.test.ts)
- **Type:** Manual assertion-based unit tests (uses `console.assert`, not a test framework)
- **Runner:** `tsx src/billing-engine/calculators/invoice-calculator.test.ts` (via `npm test`)
- **Coverage:**
  - Test 1: Intra-state GST (CGST + SGST split) with line discount
  - Test 2: Inter-state GST (IGST) 
  - Test 3: Multiple line items with invoice-level discount
  - Test 4: Volume pricing tier resolution

### Missing Test Coverage
- No test framework (Jest, Vitest, Mocha) is configured
- No integration tests for API endpoints
- No tests for: tax calculator, rule evaluator, field validator, AI agents, controllers, middleware
- No frontend tests (no testing libraries in frontend dependencies)
- No E2E tests

---

## 17. Deployment & Infrastructure

### Docker Compose (`docker-compose.yml`)
- **MongoDB 7.0:** container `billing_mongodb`, port 27017, volume `mongo_data`, init DB `adaptive_billing`
- **Redis 7.2-alpine:** container `billing_redis`, port 6379, volume `redis_data`
- No application containers defined (backend/frontend run outside Docker in dev)

### Tunneling (for external access)
- `npm run tunnel:cloudflared` — Cloudflare tunnel to frontend (:5173)
- `npm run tunnel:localtunnel` — localtunnel to frontend (:5173)

### Missing Deployment Config
- No Dockerfile for backend or frontend
- No CI/CD pipeline configuration
- No production reverse proxy config (nginx/caddy)
- No Kubernetes/cloud deployment manifests
- No PM2 ecosystem file

---

## 18. Critical Code Paths

### Path 1: Invoice Creation (Most Complex)
```text
POST /api/v1/invoices
    → invoice.routes.ts (line 27)
    → tenantMiddleware (tenant.middleware.ts:15)
    → validate(createInvoiceSchema) (validate.middleware.ts:9)
    → createInvoice (invoice.controller.ts:124)
        → OrganizationModel.findById (Organization.model.ts)
        → CustomerModel.findOne (Customer.model.ts)
        → CustomFieldModel.find → validateCustomFields (field-validator.ts:8)
        → BusinessRuleModel.find → evaluateBusinessRules (rule-evaluator.ts:16)
        → calculateInvoice (invoice-calculator.ts:39)
            → resolveTierPrice (invoice-calculator.ts:29)
            → calculateLineTaxes (tax-calculator.ts:11)
        → InvoiceModel.create (Invoice.model.ts)
        → OrganizationModel.findByIdAndUpdate ($inc nextInvoiceNumber)
        → CustomerModel.findByIdAndUpdate ($inc outstandingBalance)
        → logAuditEvent (audit.service.ts:33)
    → Response: 201 { success, data, ruleEffects }
```

### Path 2: Payment Recording
```text
POST /api/v1/payments
    → payment.routes.ts → tenantMiddleware → requireRole → validate
    → recordPayment (payment.controller.ts:43)
        → InvoiceModel.findOne
        → PaymentModel.create
        → Invoice: update amountPaid, amountDue, status, paymentHistory
        → CustomerModel: $inc outstandingBalance (-amount)
        → logAuditEvent
    → Response: 201 { payment, invoice }
```

### Path 3: Authentication
```text
POST /api/v1/auth/login
    → auth.routes.ts → validate(loginSchema)
    → login (auth.controller.ts:105)
        → UserModel.findOne → bcrypt.compare
        → OrganizationModel.findById
        → jwt.sign
    → Response: { token, user, organization }
```

---

## 19. Architecture Diagrams

### Frontend Component Tree
```text
<AuthProvider>
└── <RouterShell>
    ├── [Unauthenticated]
    │   ├── <LoginPage />
    │   └── <RegisterPage />
    │
    └── [Authenticated]
        └── <AppLayout currentPath onNavigate onApplyDraftToInvoice>
            ├── <Sidebar />           — Left nav (Dashboard, Invoices, Customers, etc.)
            ├── <Navbar />            — Top bar (org name, user, logout)
            ├── <AiCopilotDrawer />   — Slide-out AI assistant (invoice draft + business Q&A)
            └── {Current Page}
                ├── <DashboardPage />      — KPIs, cashflow, anomalies, AI brief
                ├── <InvoicesListPage />    — Invoice table with filters
                ├── <CreateInvoicePage />   — Form builder + live preview + dynamic fields
                ├── <InvoiceDetailPage />   — Detail view + payment + status management
                ├── <CustomersPage />       — CRUD table + modal
                ├── <ProductsPage />        — CRUD table + modal
                ├── <SettingsPage />        — Org, team, fields, rules, templates tabs
                └── <OnboardingPage />      — AI-guided setup wizard
```

### Backend Module Architecture
```text
┌─────────────────── Express App (app.ts) ────────────────────┐
│                                                              │
│  ┌─── Global Middleware ─────────────────────────────────┐   │
│  │ cors → json(10mb) → urlencoded → morgan → rateLimiter│   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─── Route Modules ────────────────────────────────────┐   │
│  │                                                       │   │
│  │  PUBLIC:  auth.routes  (register, login)              │   │
│  │           dynamic.routes /presets                      │   │
│  │           ai.routes /onboarding/suggest-model          │   │
│  │                                                       │   │
│  │  PROTECTED (tenantMiddleware):                        │   │
│  │    invoices ─┬─ CRUD + preview + status               │   │
│  │              └─ requireRole for status/delete          │   │
│  │    customers ── CRUD + requireRole for delete          │   │
│  │    products ─── CRUD + requireRole for delete          │   │
│  │    payments ─── list + record (RBAC) + refund (RBAC)  │   │
│  │    credit-notes ── list + create (RBAC)                │   │
│  │    recurring ── list + create + update + manual run     │   │
│  │    templates ── CRUD (admin only)                      │   │
│  │    approvals ── list + approve/reject (admin/manager)  │   │
│  │    organizations ── profile + settings + model switch  │   │
│  │    users ───── list + create/update (admin only)       │   │
│  │    audit-logs ── list (admin/manager only)             │   │
│  │    dynamic ──── fields + rules CRUD (admin only)       │   │
│  │    ai ────────── copilot + ask + OCR + reminders       │   │
│  │    reports ───── dashboard + revenue + aging + stmt    │   │
│  │    auth /me ──── get current user (token refresh)      │   │
│  │                                                       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─── Terminal Middleware ───────────────────────────────┐   │
│  │ 404 handler → errorHandler                            │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Tax Calculation Decision Flow
```text
calculateLineTaxes(taxSystem, taxRate, taxableAmount, originState, destinationState)
    │
    ├── taxSystem === 'NONE' OR taxRate <= 0 → { taxAmount: 0, breakdown: [] }
    │
    ├── taxSystem === 'GST'
    │   ├── originState !== destinationState → IGST (full rate)
    │   └── originState === destinationState → CGST (half) + SGST (half)
    │
    ├── taxSystem === 'VAT' → VAT (full rate)
    │
    └── taxSystem === 'SALES_TAX' → SALES_TAX (full rate)
```

---

## 20. Final Developer Guide

### A. Where Should I Start Reading?

1. **[shared/src/types/](file:///d:/var-codes/BIlling%20Application/shared/src/types)** — Read all type definitions first to understand the domain model
2. **[backend/src/server.ts](file:///d:/var-codes/BIlling%20Application/backend/src/server.ts)** → **[app.ts](file:///d:/var-codes/BIlling%20Application/backend/src/app.ts)** — Understand the entry point and how everything is wired
3. **[backend/src/core/tenancy/tenant.middleware.ts](file:///d:/var-codes/BIlling%20Application/backend/src/core/tenancy/tenant.middleware.ts)** — Understand multi-tenancy mechanism
4. **[backend/src/models/Invoice.model.ts](file:///d:/var-codes/BIlling%20Application/backend/src/models/Invoice.model.ts)** — The most complex model; understand the data shape
5. **[backend/src/billing-engine/calculators/invoice-calculator.ts](file:///d:/var-codes/BIlling%20Application/backend/src/billing-engine/calculators/invoice-calculator.ts)** — Core business logic
6. **[backend/src/modules/invoices/invoice.controller.ts](file:///d:/var-codes/BIlling%20Application/backend/src/modules/invoices/invoice.controller.ts)** — Most complex controller; ties everything together
7. **[frontend/src/App.tsx](file:///d:/var-codes/BIlling%20Application/frontend/src/App.tsx)** — Frontend routing and composition
8. **[frontend/src/context/AuthContext.tsx](file:///d:/var-codes/BIlling%20Application/frontend/src/context/AuthContext.tsx)** — Auth state management

### B. Most Important Files

| File | Why It's Critical |
|---|---|
| `backend/src/app.ts` | All middleware and route wiring |
| `backend/src/core/tenancy/tenant.middleware.ts` | Auth + tenant isolation for every request |
| `backend/src/modules/invoices/invoice.controller.ts` | Most complex controller — invoice lifecycle |
| `backend/src/billing-engine/calculators/invoice-calculator.ts` | Core calculation engine used everywhere |
| `backend/src/billing-engine/tax-engine/tax-calculator.ts` | Tax compliance logic (GST/VAT) |
| `backend/src/dynamic-engine/rules/rule-evaluator.ts` | Business automation engine |
| `backend/src/modules/payments/payment.controller.ts` | Financial reconciliation logic |
| `backend/src/models/Invoice.model.ts` | Central data model |
| `frontend/src/context/AuthContext.tsx` | Frontend auth state |
| `frontend/src/api/client.ts` | All API communication |
| `backend/src/seed.ts` | Demo data — understand the data shapes |

### C. Core Execution Paths

1. **Registration → Login → Dashboard** (user onboarding)
2. **Create Customer → Create Product → Create Invoice → Record Payment** (core billing workflow)
3. **AI Copilot Draft → Apply to Form → Create Invoice** (AI-assisted workflow)
4. **Business Rule Trigger → Require Approval → Approve/Reject** (automation workflow)
5. **Recurring Profile → Manual/Scheduled Run → Invoice Generation** (subscription billing)

### D. How to Modify a Feature

**To add a new API endpoint:**
1. Add Zod schema in `core/schemas/`
2. Add controller function in `modules/<feature>/<feature>.controller.ts`
3. Register route in `modules/<feature>/<feature>.routes.ts`
4. If new module: import and mount in `app.ts`
5. Add shared types in `shared/src/types/`

**To add a new data model:**
1. Create `models/NewEntity.model.ts` following existing pattern
2. Add organizationId with index for tenant isolation
3. Add shared interface in `shared/src/types/`

**To add a frontend page:**
1. Create page component in `pages/<feature>/`
2. Add route case in `App.tsx → RouterShell.renderCurrentPage()`
3. Add sidebar link in `Sidebar.tsx`

**To add a custom field target entity:**
1. Add to `TargetEntity` union in `shared/src/types/metadata.ts`
2. Add to `targetEntity` enum in `CustomField.model.ts`
3. Add validation call in the relevant controller's create/update functions

### E. Potential Problem Areas

> [!WARNING]
> **Issues identified from actual code analysis:**

1. **No test framework:** Tests use `console.assert` — not suitable for CI/CD. No coverage for controllers, middleware, or frontend.

2. **In-memory rate limiter:** `rate-limiter.middleware.ts` uses a `Map` — resets on server restart and doesn't work across multiple server instances. Redis integration is declared in `.env.example` but never implemented.

3. **AI agents are heuristic only:** Despite environment variables for OpenAI/Anthropic/Gemini, the AI features use keyword matching and regex parsing — not actual LLM calls. The `OPENAI_API_KEY` and `GEMINI_API_KEY` are read into `ENV` but never used.

4. **No request-level transactions:** Invoice creation performs multiple DB operations (create invoice, update org counter, update customer balance) without MongoDB transactions. A failure mid-way could leave inconsistent state.

5. **Recurring job has no scheduler:** `processAllPendingRecurringInvoices()` exists but is never called automatically. There's no cron setup, no `setInterval`, and no job queue (Bull/Agenda). It only runs via manual API trigger.

6. **Security: `updateCustomer` and `updateProduct` pass `req.body` directly** to `findOneAndUpdate()` — could allow overwriting `organizationId` or `_id` if a malicious request includes them.

7. **No pagination on some endpoints:** `listCreditNotes`, `listRecurringProfiles`, `listTemplates`, `listUsers` return all records without pagination.

8. **Invoice edit allows only draft status** but `updateInvoiceStatus` has no state machine validation — allows invalid transitions (e.g., `paid → draft`).

9. **Customer soft delete but Product soft delete:** Both use `isActive: false` instead of actual deletion, but invoices still reference the original IDs — this is correct behavior but could confuse users if deactivated items appear in dropups.

10. **Frontend uses `window.history.pushState`** for routing without a proper router library — back/forward button behavior may be inconsistent, and deep-linking requires server-side fallback (which Vite handles in dev but needs config in production).

11. **PDF generation is declared** (`pdfUrl` field on Invoice) but never implemented — no PDF generation code exists.

12. **Redis declared but unused:** Docker Compose starts Redis but no code connects to it.

### F. Missing or Unclear Areas

- **PDF invoice generation:** `pdfUrl` field exists on the Invoice model but no PDF generation logic is implemented anywhere.
- **Email/notification delivery:** Smart reminders are generated but there's no email sending service (SMTP, SendGrid, etc.).
- **File upload/storage:** `STORAGE_DRIVER` and `STORAGE_LOCAL_PATH` are declared but no file upload middleware or storage service exists.
- **Redis usage:** Redis is provisioned via Docker but never connected to or used for caching or sessions.
- **LLM integration:** API keys for OpenAI/Anthropic/Gemini are declared but all AI features use deterministic heuristics, not actual LLM calls.
- **Usage-based and healthcare billing models:** Referenced in the `BillingModelType` union type but have no preset definitions in `BILLING_MODEL_PRESETS`.
- **Automated recurring invoice scheduling:** The job function exists but no scheduler triggers it automatically.
- **Frontend test coverage:** Zero test files or testing dependencies in the frontend package.
- **Production deployment configuration:** No Dockerfiles, CI/CD pipelines, or production deployment manifests exist.
