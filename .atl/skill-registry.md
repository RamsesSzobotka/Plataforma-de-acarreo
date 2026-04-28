# Skill Registry — Plataforma-de-acarreo

**Generated**: 2026-04-28  
**Project**: Plataforma-de-acarreo (B2B Marketplace para Transporte de Mercancías)

## Project Index Files

Primary reference for development, AI guidelines, and fullstack conventions:
- **AGENTS.md** — Sistema de diseño, stack tecnológico, estructura de carpetas, modelos de datos, endpoints, roles, verificación de conductores, reglas de UX
- **SPEC.md** — Especificaciones técnicas del proyecto
- **Doc/** — Documentación adicional (PRD, skills, etc.)

## Available Global Skills

### SDD (Spec-Driven Development) Skills

| Skill | Purpose | Trigger |
|-------|---------|---------|
| `sdd-init` | Initialize SDD context, detect stack, bootstrap infrastructure | When user wants to initialize SDD or says "sdd init" |
| `sdd-explore` | Investigate ideas before committing to a change | When orchestrator launches to think through a feature |
| `sdd-propose` | Create change proposal with intent, scope, approach | When orchestrator launches to create proposal |
| `sdd-spec` | Write specifications with requirements and scenarios | When orchestrator launches to write specs |
| `sdd-design` | Create technical design with architecture decisions | When orchestrator launches to write design |
| `sdd-tasks` | Break down change into implementation task checklist | When orchestrator launches to create tasks |
| `sdd-apply` | Implement tasks from a change, write actual code | When orchestrator launches to implement |
| `sdd-verify` | Validate implementation matches specs and design | When orchestrator launches to verify |
| `sdd-archive` | Sync delta specs to main specs, archive completed change | When orchestrator launches to archive |

**Location**: `~/.claude/skills/sdd-*` and `~/.config/opencode/skills/sdd-*`

### Team & PR Management

| Skill | Purpose | Trigger |
|-------|---------|---------|
| `issue-creation` | GitHub issue creation workflow following issue-first enforcement | When creating GitHub issues or reporting bugs |
| `branch-pr` | PR creation workflow following issue-first enforcement | When creating pull requests or preparing changes for review |
| `find-skills` | Discover and install agent skills | When asking "how do I do X" or looking for functionality |

**Location**: `~/.config/opencode/skills/`

### Testing & Quality

| Skill | Purpose | Trigger |
|-------|---------|---------|
| `go-testing` | Go testing patterns including Bubbletea TUI testing | When writing Go tests or using teatest |
| `judgment-day` | Parallel adversarial review protocol with dual judges | When user says "judgment day" or "dual review" |

**Location**: `~/.config/opencode/skills/`

### Skill Management

| Skill | Purpose | Trigger |
|-------|---------|---------|
| `skill-creator` | Create new AI agent skills following Agent Skills spec | When user asks to create new skills or document patterns |

**Location**: `~/.config/opencode/skills/`

## Project Stack

### Frontend
- **Framework**: React 18.3.1 + Vite 6.0.0
- **Router**: React Router DOM 6.28.0
- **Auth**: @clerk/clerk-react 5.17.0
- **Payments**: @stripe/stripe-js 5.1.0
- **Language**: TypeScript 5.7.0
- **Linting**: ESLint 9.0.0
- **Testing**: Playwright 1.59.1 (E2E tests in `frontend/e2e/`)
- **Port**: 5173 (proxies to backend at http://localhost:3000)

### Backend
- **Runtime**: Bun + Node ES2022
- **Framework**: Hono 4.0.0
- **Database**: MongoDB (via Mongoose 8.9.0)
- **Auth**: @clerk/clerk-sdk-node 5.0.0
- **Payments**: Stripe 17.0.0
- **Storage**: Cloudinary 2.10.0
- **Language**: TypeScript 5.7.0
- **Port**: 3000

### DevOps
- **Package Manager**: Bun
- **Database**: MongoDB (Docker via `docker-compose.yml`)
- **Environment**: .env (see `.env.example` files)

## Design System References

- **Colors**: Turquesa (#0D9488) + Naranja Terracotta (#F97316)
- **Typography**: Plus Jakarta Sans (headings), Inter (body), JetBrains Mono (mono)
- **Icons**: Material Symbols (Google Fonts)
- **CSS Variables**: Defined in AGENTS.md section 0

## Coding Conventions

### TypeScript
- **Strict mode** enabled
- **Module resolution**: bundler
- **Path aliases**: `@/*` → `src/*`
- **Target**: ES2022

### Architecture
- **Frontend**: Container-Presentational pattern (see AGENTS.md for structure)
- **Backend**: Modular routes + services + middleware (see AGENTS.md section 2)
- **Database Models**: Mongoose schemas (rides, users, drivers, messages, ratings)

### Testing
- **Frontend E2E**: Playwright (config: `frontend/playwright.config.ts`)
- **Test directory**: `frontend/e2e/`
- **Reporter**: HTML reports

### Code Style
- **Linting**: ESLint with TypeScript support
- **Formatting**: (no Prettier configured; follow ESLint rules)
- **Naming**: camelCase for variables/functions, PascalCase for components/classes

## Important Context

### Product Vision
Marketplace B2B de transporte de mercancías combinando:
- Experiencia Uber: tracking en tiempo real, perfil visible, calificaciones, pago digital
- Experiencia Facebook Marketplace: múltiples imágenes, descripción rica, chat directo

### Key Roles
- **Client** (cliente): crea pedidos con imágenes y ubicaciones
- **Driver** (acarreador/conductor): acepta pedidos, negocia precio, completa entregas
- **Admin**: back office de gestión y auditoría

### Ride States
`requested` → `negotiating` → `accepted` → `in_progress` → `completed` → `paid`

### Comisión
- Plataforma retiene **10%** del monto final
- Conductor recibe **90%**

### Key Features (MVP)
1. Crear pedido con imágenes (mínimo 1, máximo 8)
2. Chat en tiempo real entre cliente y conductor
3. Tracking de ubicación en tiempo real
4. Foto de entrega + confirmación
5. Pago con Stripe
6. Calificaciones mutuas (1-5 estrellas)
7. Sistema de verificación de conductores (pending → verified)

### Files to Reference
- **Structure**: AGENTS.md section 2
- **Models**: AGENTS.md section 9
- **Endpoints**: AGENTS.md section 11
- **Flow**: AGENTS.md section 8
- **Driver Verification**: AGENTS.md section 15.1
- **UX Rules**: AGENTS.md section 16

## Recommendations for AI Implementation

### Before Starting Any Task
1. Load relevant skill(s) from SDD workflow or project-specific ones
2. Read AGENTS.md as source of truth for design, stack, and conventions
3. Follow the **Stack Technological** order in AGENTS.md section 14 for incremental implementation
4. Check **Pendiente (TODO)** section in AGENTS.md for what's done vs. what's pending

### When Writing Code
1. Follow TypeScript strict mode and path aliases
2. Respect ownership checks in middleware (see AGENTS.md section on middleware patterns)
3. Implement role-based access (client/driver/admin)
4. Use conventional commits (no AI attribution)

### For Substantial Features
1. Use `/sdd-new <feature-name>` to create proposals
2. Follow the dependency graph: `proposal` → `spec` → `design` → `tasks` → `apply` → `verify` → `archive`
3. Reference AGENTS.md for all UX rules, model schemas, and API endpoint contracts

---

**Last Updated**: 2026-04-28  
**Next**: Ready for `/sdd-explore <topic>` or `/sdd-new <change-name>`
