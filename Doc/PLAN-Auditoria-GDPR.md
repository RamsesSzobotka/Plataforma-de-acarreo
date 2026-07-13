# Plan: Auditoría Admin (H-42) + GDPR (H-43)

**Goal**: Implementar endpoint de consulta de auditoría + UI admin + GDPR básico (consentimiento, exportar datos, eliminar cuenta)

**Architecture**: Backend (Bun+Hono+Mongoose), Admin-Frontend (React+Vite), Frontend Cliente (React+Vite)

**Tech Stack**: Hono, Mongoose, React 18, react-router-dom v6, SweetAlert2, fetch API

---

## Grupo 1: Backend — Auditoría

**Files**: `routes/admin.ts` (modificar)

- [ ] Añadir `GET /admin/audit-logs` con filtros: action, userId, entityType, from, to + paginación
- [ ] Middleware: auth + requireAdmin
- [ ] Query MongoDB dinámico, sort por timestamp desc, paginate
- [ ] Response: `{ logs, pagination: { page, limit, total, totalPages } }`

## Grupo 2: Backend — GDPR

**Files**: `models/consent.ts` (crear), `routes/gdpr.ts` (crear), `index.ts` (modificar)

- [ ] Modelo Consent (userId, version, acceptedAt, ipAddress, userAgent)
- [ ] POST /api/gdpr/consent — guarda consentimiento
- [ ] GET /api/gdpr/export — reúne todos los datos del usuario
- [ ] DELETE /api/gdpr/account — anonimiza perfil, mensajes, logs; elimina driver
- [ ] Montar rutas en index.ts

## Grupo 3: Admin-Frontend — Auditoría

**Files**: `services/api.ts` (modificar), `pages/AuditLogs.tsx` (crear), `components/Layout.tsx` (modificar), `App.tsx` (modificar)

- [ ] API: getAuditLogs(params)
- [ ] Página AuditLogs con tabla, filtros, fila expandible, paginación
- [ ] Sidebar: añadir "Auditoría"
- [ ] Ruta /audit-logs

## Grupo 4: Frontend Cliente — GDPR

**Files**: `services/api.ts` (modificar), `pages/Privacy.tsx` (crear), `pages/GdprSettings.tsx` (crear), `components/Layout.tsx` (modificar), `App.tsx` (modificar)

- [ ] API: gdprAPI (giveConsent, exportData, deleteAccount)
- [ ] Página Privacy (política de privacidad estática con i18n)
- [ ] Página GdprSettings (botones exportar/eliminar)
- [ ] Layout: links en footer (privacidad) y header (GDPR settings)
- [ ] App: rutas /privacy y /settings/gdpr
- [ ] Consent banner en primera visita (App.tsx o Layout.tsx)
