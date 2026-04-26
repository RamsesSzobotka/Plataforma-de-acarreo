---
description: "Usar cuando se implementen endpoints backend, modulos de dominio, servicios o persistencia con Bun, Honor y MongoDB para este proyecto de acarreos."
name: "Backend Honor MongoDB"
applyTo: "**/*.ts"
---
# Instrucciones backend

- Mantener rutas versionadas en /api/v1.
- Estructurar por dominio: auth, users, drivers, rides, payments, admin.
- Separar capas: route -> controller -> service -> repository.
- Validar DTO/schema en todas las escrituras.
- Aplicar auth, role y ownership antes de acceder a recursos sensibles.
- En listados, usar paginacion estandar (page, limit, sortBy, sortOrder, search, status).
- Incluir filtros por estado y orden por createdAt cuando aplique.
- Evitar overfetch con proyecciones selectivas.
- Definir indices recomendados del PRD para cada coleccion.
- Mantener compatibilidad de contratos; no romper campos usados por frontend.
