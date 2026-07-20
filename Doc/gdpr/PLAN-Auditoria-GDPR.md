✅ PLAN COMPLETADO — Todas las tareas fueron implementadas.

# Plan: Auditoría Admin (H-42) + GDPR (H-43)

**Goal**: Implementar endpoint de consulta de auditoría + UI admin + GDPR básico (consentimiento, exportar datos, eliminar cuenta)

**Architecture**: Backend (Bun+Hono+Mongoose), Admin-Frontend (React+Vite), Frontend Cliente (React+Vite)

**Tech Stack**: Hono, Mongoose, React 18, react-router-dom v6, SweetAlert2, fetch API

---

## Grupo 1: Backend — Auditoría

**Files**: `routes/admin.ts` (modificar)

- [x] Añadir `GET /admin/audit-logs` con filtros: action, userId, entityType, from, to + paginación
- [x] Middleware: auth + requireAdmin
- [x] Query MongoDB dinámico, sort por timestamp desc, paginate
- [x] Response: `{ logs, pagination: { page, limit, total, totalPages } }`

## Grupo 2: Backend — GDPR

**Files**: `models/consent.ts` (crear), `routes/gdpr.ts` (crear), `index.ts` (modificar)

- [x] Modelo Consent (userId, version, acceptedAt, ipAddress, userAgent)
- [x] POST /api/gdpr/consent — guarda consentimiento
- [x] GET /api/gdpr/export — reúne todos los datos del usuario
- [x] DELETE /api/gdpr/account — anonimiza perfil, mensajes, logs; elimina driver
- [x] Montar rutas en index.ts

## Grupo 3: Admin-Frontend — Auditoría

**Files**: `services/api.ts` (modificar), `pages/AuditLogs.tsx` (crear), `components/Layout.tsx` (modificar), `App.tsx` (modificar)

- [x] API: getAuditLogs(params)
- [x] Página AuditLogs con tabla, filtros, fila expandible, paginación
- [x] Sidebar: añadir "Auditoría"
- [x] Ruta /audit-logs

## Grupo 4: Frontend Cliente — GDPR

**Files**: `services/api.ts` (modificar), `pages/Privacy.tsx` (crear), `pages/GdprSettings.tsx` (crear), `components/Layout.tsx` (modificar), `App.tsx` (modificar)

- [x] API: gdprAPI (giveConsent, exportData, deleteAccount)
- [x] Página Privacy (política de privacidad estática con i18n)
- [x] Página GdprSettings (botones exportar/eliminar)
- [x] Layout: links en footer (privacidad) y header (GDPR settings)
- [x] App: rutas /privacy y /settings/gdpr
- [x] Consent banner en primera visita (App.tsx o Layout.tsx)

Fecha de finalización: Julio 2026
