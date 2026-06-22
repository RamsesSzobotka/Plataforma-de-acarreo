# Historias de Usuario — Plataforma de Acarreos (Carglyn)

> **Proyecto:** Plataforma de Acarreos (Carglyn)  
> **Equipo:** Grupo MVP — Parcial #2 (A7)  
> **Propósito:** Inventario de funcionalidades implementadas + backlog para production-ready, incluyendo exposición vía MCP  
> **Formato:** `Como <rol>, quiero <funcionalidad/acción>, para <beneficio/objetivo>.`

---

## Sección 1: Inventario Actual — Funcionalidades YA implementadas (MVP)

### 1.1 Portal Cliente

| # | Historia | Criterios de Aceptación |
|---|----------|------------------------|
| **H-01** | Como **cliente**, quiero **registrarme con SSO (Google/Microsoft/UTP) via Clerk**, para **acceder a la plataforma sin contraseñas**. | 1. El usuario puede iniciar sesion con Google, Microsoft o UTP.<br>2. El registro automatico crea un perfil basico en MongoDB.<br>3. El token JWT se verifica en cada request protegido.<br>4. El usuario se crea con rol `client` por defecto. |
| **H-02** | Como **cliente**, quiero **crear un pedido con titulo, descripcion, tipo, imagenes, ubicaciones y precio sugerido**, para **solicitar un servicio de acarreo**. | 1. Formulario con titulo, descripcion, tipo (mudanza/electrodomesticos/muebles/productos/otros).<br>2. Multiples imagenes (hasta 8) via Cloudinary.<br>3. Direcciones con busqueda por OpenStreetMap + coordenadas.<br>4. Precio sugerido y numero de bultos opcional. |
| **H-03** | Como **cliente**, quiero **ver la lista de mis pedidos con filtros por estado**, para **dar seguimiento a mis acarreos**. | 1. Lista paginada (10 por pagina).<br>2. Filtros por estado del ride.<br>3. Ownership verificado — cada cliente solo ve sus propios pedidos.<br>4. Ordenados por fecha de creacion descendente. |
| **H-04** | Como **cliente**, quiero **ver los detalles completos de un pedido incluyendo imagenes, mapa y estado**, para **tener visibilidad total del servicio**. | 1. Timeline visual del estado del pedido.<br>2. Galeria de imagenes con lightbox.<br>3. Direcciones de recogida y destino.<br>4. Informacion del conductor asignado (nombre, rating, vehiculo). |
| **H-05** | Como **cliente**, quiero **ver los conductores interesados en mi pedido y chatear con ellos**, para **negociar directamente**. | 1. Lista de conductores que han iniciado contacto.<br>2. Chat en tiempo real via WebSocket.<br>3. Ver perfil basico del conductor (nombre, foto).<br>4. Indicador de mensajes no leidos por ride. |
| **H-06** | Como **cliente**, quiero **confirmar la entrega cuando el conductor llega al destino**, para **completar el servicio y proceder al pago**. | 1. Boton "Confirmar Entrega" cuando el ride esta `in_progress`.<br>2. Validacion de que existe foto de entrega.<br>3. Cobro automatico si hay metodo de pago guardado.<br>4. Transicion de estado a `completed` o `paid`. |
| **H-07** | Como **cliente**, quiero **pagar con Stripe usando una tarjeta guardada**, para **completar el pago de forma segura**. | 1. SetupIntent para guardar metodo de pago.<br>2. Off-session charge con marketplace (10% comision).<br>3. PaymentIntent con Stripe Connect.<br>4. Webhook de Stripe para confirmar pago. |
| **H-08** | Como **cliente**, quiero **calificar al conductor (1-5 estrellas + comentario) despues del pago**, para **compartir mi experiencia**. | 1. Solo disponible cuando el estado es `paid`.<br>2. Calificacion del 1 al 5.<br>3. Comentario opcional.<br>4. Recalculo automatico del rating promedio del conductor. |
| **H-09** | Como **cliente**, quiero **cancelar mi pedido cuando esta en estado requested o negotiating**, para **retirar la solicitud si cambio de opinion**. | 1. Boton de cancelar visible en estados permitidos.<br>2. Confirmacion antes de cancelar.<br>3. Registro del motivo de cancelacion.<br>4. No se puede cancelar en `accepted`, `in_progress`, `completed`, `paid`. |
| **H-10** | Como **cliente**, quiero **guardar un metodo de pago en mi perfil**, para **usarlo en pedidos futuros sin tener que ingresarlo cada vez**. | 1. SetupIntent con Stripe.<br>2. Adjuntar PaymentMethod al Customer.<br>3. Guardar `stripePaymentMethodId` en el perfil.<br>4. Verificar que el metodo existe antes de crear un ride. |

### 1.2 Portal Conductor

| # | Historia | Criterios de Aceptación |
|---|----------|------------------------|
| **H-11** | Como **conductor**, quiero **registrarme con documentos obligatorios (fotos, licencia, cedula, RUV, seguro, placa)**, para **ser verificado y poder aceptar pedidos**. | 1. Formulario con 9 campos obligatorios + 4 opcionales.<br>2. Validacion de placa unica y formato.<br>3. Subida de imagenes a Cloudinary.<br>4. Estado inicial `pending` — pendiente de revision admin. |
| **H-12** | Como **conductor**, quiero **ver los pedidos disponibles cercanos filtrados por tipo**, para **elegir cuales me interesan**. | 1. Lista de rides con estado `requested`.<br>2. Paginacion y filtro por tipo.<br>3. Solo visible para conductores y admins.<br>4. Ordenados por fecha descendente. |
| **H-13** | Como **conductor**, quiero **iniciar chat con un cliente que publico un pedido**, para **negociar el precio y proponer mi oferta**. | 1. Enviar mensaje inicial crea un `DriverContact`.<br>2. Sistema de propuesta de precio (maximo 3 propuestas).<br>3. Chat en tiempo real con estado `requested`.<br>4. El cliente puede aceptar o rechazar la propuesta. |
| **H-14** | Como **conductor**, quiero **aceptar un pedido con un precio acordado**, para **formalizar el servicio**. | 1. Solo `requested` → `accepted`.<br>2. Precio acordado requerido.<br>3. No aceptar propio pedido.<br>4. Race condition: solo un conductor acepta. |
| **H-15** | Como **conductor**, quiero **confirmar que tengo la carga e iniciar el viaje**, para **comenzar el tracking hacia el destino**. | 1. Cambia estado de `accepted` → `in_progress`.<br>2. Solo el conductor asignado puede iniciar.<br>3. Solo cuando estado es `accepted`.<br>4. WebSocket actualiza el estado en tiempo real. |
| **H-16** | Como **conductor**, quiero **subir una foto de evidencia al llegar al destino**, para **demostrar que la entrega se realizo**. | 1. Solo en estado `in_progress`.<br>2. URL de imagen requerida.<br>3. Guarda `deliveryPhoto` en el ride.<br>4. Despues de subirla, el cliente puede confirmar. |
| **H-17** | Como **conductor**, quiero **cancelar un pedido en estado accepted (con motivo)**, para **liberarme si no puedo cumplir**. | 1. Solo en `accepted` y si eres el driver asignado.<br>2. Motivo de cancelacion requerido.<br>3. El cliente puede solicitar otro conductor.<br>4. No se puede cancelar en `in_progress`. |
| **H-18** | Como **conductor**, quiero **ver mi perfil con estadisticas (rating, viajes, documentos)**, para **gestionar mi informacion**. | 1. Rating promedio y total de viajes.<br>2. Estado de verificacion.<br>3. Documentos subidos.<br>4. Enlace a editar perfil. |
| **H-19** | Como **conductor**, quiero **ver mi historial de pagos con total de ganancias**, para **controlar mis ingresos**. | 1. Lista de rides `paid` paginada.<br>2. Monto recibido por viaje (driverAmount).<br>3. Total de ganancias agregado.<br>4. Fechas de pago. |

### 1.3 Portal Admin

| # | Historia | Criterios de Aceptación |
|---|----------|------------------------|
| **H-20** | Como **admin**, quiero **iniciar sesion con credenciales propias (email + password)**, para **acceder al panel de administracion**. | 1. Login con email y password hasheado.<br>2. Verificacion de rol admin.<br>3. Sesion basada en token (userId).<br>4. Cuenta admin se crea automaticamente al iniciar el servidor. |
| **H-21** | Como **admin**, quiero **ver estadisticas del sistema (usuarios, drivers, rides)**, para **monitorear la plataforma**. | 1. Total de clientes y conductores.<br>2. Conductores pendientes y verificados.<br>3. Total de rides, completados y en progreso.<br>4. Datos en tiempo real desde MongoDB. |
| **H-22** | Como **admin**, quiero **listar y gestionar usuarios (ver, editar, desactivar, eliminar)**, para **administrar la poblacion de la plataforma**. | 1. Lista paginada con filtro por rol.<br>2. Editar nombre, rol, estado activo.<br>3. Eliminar usuario.<br>4. Datos enriquecidos con Clerk. |
| **H-23** | Como **admin**, quiero **revisar y aprobar/rechazar/suspender conductores con documentos**, para **verificar que cumplen los requisitos**. | 1. Lista de drivers con filtro por estado.<br>2. Ver documentos completos del conductor.<br>3. Aprobar → `verified`, Rechazar → `rejected` con motivo.<br>4. Suspender → `suspended`. |
| **H-24** | Como **admin**, quiero **ver todos los rides del sistema con filtros**, para **monitorear la actividad**. | 1. Lista paginada con filtros por estado, cliente, conductor.<br>2. Datos enriquecidos con Clerk.<br>3. Ver detalle de cualquier ride.<br>4. Editar ride (titulo, precio, etc.). |
| **H-25** | Como **admin**, quiero **cambiar el estado de cualquier ride excepcionalmente**, para **resolver casos especiales**. | 1. Cambiar a cualquier estado valido.<br>2. Asignar/reasignar conductor.<br>3. Cancelar ride en cualquier estado.<br>4. Eliminar ride definitivamente. |

### 1.4 Infraestructura y Comunicacion

| # | Historia | Criterios de Aceptación |
|---|----------|------------------------|
| **H-26** | Como **usuario**, quiero **chatear en tiempo real con la otra parte del servicio**, para **coordinar la entrega sin salir de la plataforma**. | 1. WebSocket nativo de Bun.<br>2. Autenticacion via token JWT en el handshake.<br>3. Broadcast de mensajes por rideId.<br>4. Persistencia de mensajes en MongoDB. |
| **H-27** | Como **cliente o conductor**, quiero **subir imagenes a Cloudinary**, para **adjuntar evidencia visual a los pedidos**. | 1. Upload via multipart/form-data.<br>2. Soporta carpetas (rides, drivers, etc.).<br>3. Retorna URL publica y publicId.<br>4. Autenticacion requerida. |
| **H-28** | Como **admin**, quiero **tener MongoDB y Redis funcionando via Docker Compose**, para **entorno de desarrollo consistente**. | 1. MongoDB 7 con healthcheck.<br>2. Redis 7 Alpine.<br>3. Datos persistentes en volumen.<br>4. Script init-admin para crear admin inicial. |
| **H-29** | Como **sistema**, quiero **tener un health check endpoint**, para **verificar que el servidor y MongoDB estan operativos**. | 1. `GET /health` retorna estado de API y MongoDB.<br>2. `GET /health/ready` readiness check.<br>3. Responde rapido sin autenticacion. |

---

## Sección 2: Funcionalidades Faltantes — Production Ready (43 nuevas)

### 2.1 MCP — Herramientas del Protocolo de Contexto de Modelo

| # | Historia | Criterios de Aceptación | Tool MCP | Autenticación | Que permite al agente IA |
|---|----------|------------------------|----------|---------------|--------------------------|
| **H-30** [MCP] | Como **usuario**, quiero **listar mis acarreos como cliente con filtros**, para **consultar el estado de mis pedidos automaticamente**. | 1. Filtro por estado opcional.<br>2. Paginacion.<br>3. Retorna datos estructurados (id, titulo, tipo, estado, precio, direcciones).<br>4. Solo rides del cliente autenticado. | `list_my_rides` | Token MCP | El agente puede consultar el historial y estado de pedidos del cliente. |
| **H-31** [MCP] | Como **usuario**, quiero **crear un nuevo pedido de acarreo**, para **automatizar la creacion de solicitudes desde un chat**. | 1. Validacion de campos requeridos.<br>2. Coordenadas y direcciones.<br>3. Precio y tipo de acarreo.<br>4. Retorna el ride creado. | `create_ride` | Token MCP | El agente puede crear pedidos automaticamente en nombre del cliente. |
| **H-32** [MCP] | Como **usuario**, quiero **obtener detalles completos de un acarreo por su ID**, para **analizar el estado y la informacion del servicio**. | 1. Retorna todos los campos del ride.<br>2. Incluye ubicaciones, imagenes, precios.<br>3. Error si no existe o no pertenece al usuario.<br>4. Datos formateados para consumo IA. | `get_ride_details` | Token MCP | El agente puede obtener informacion detallada de un servicio especifico. |
| **H-33** [MCP] | Como **usuario**, quiero **ver las ofertas recibidas para un acarreo**, para **evaluar cuales conductores estan interesados**. | 1. Lista de conductores que contactaron.<br>2. Precio propuesto por cada uno.<br>3. Numero de propuestas restantes.<br>4. Datos del conductor (nombre, rating). | `view_offers` | Token MCP | El agente puede revisar y comparar ofertas de conductores. |
| **H-34** [MCP] | Como **usuario**, quiero **aceptar la oferta de un conductor para un acarreo**, para **formalizar el servicio sin intervencion manual**. | 1. Acepta rideId + driverId.<br>2. Cambia estado a `accepted`.<br>3. Desactiva otros contacts.<br>4. Precio opcional (si se negocio antes). | `accept_offer` | Token MCP | El agente puede formalizar contratos aceptando ofertas de conductores. |

### 2.2 Infraestructura y DevOps

| # | Historia | Criterios de Aceptación |
|---|----------|------------------------|
| **H-35** | Como **equipo de desarrollo**, quiero **tener Dockerfile para el backend y docker-compose para toda la aplicacion (backend + frontend + DB + Redis)**, para **desplegar facilmente en cualquier entorno**. | 1. Dockerfile multi-stage para backend Bun.<br>2. Dockerfile para frontend con Nginx.<br>3. docker-compose.yml unificado.<br>4. Variables de entorno por servicio. |
| **H-36** | Como **equipo de desarrollo**, quiero **tener CI/CD con GitHub Actions (lint, test, build, deploy)**, para **automatizar la calidad y entrega del software**. | 1. Workflow de CI al hacer PR a main.<br>2. Ejecutar linter y TypeScript check.<br>3. Ejecutar tests unitarios y de integracion.<br>4. Workflow de CD para deploy automatico. |
| **H-37** | Como **equipo de desarrollo**, quiero **tener pruebas unitarias e integracion para todos los modulos (auth, rides, messages, payments, admin, MCP)**, para **garantizar la calidad del codigo**. | 1. Tests unitarios para cada handler.<br>2. Tests de integracion con MongoDB test.<br>3. Tests de WebSocket.<br>4. Tests de flujo completo de ride. |
| **H-38** | Como **equipo de desarrollo**, quiero **tener tests E2E con Playwright para los flujos criticos**, para **validar la experiencia de usuario completa**. | 1. Flujo: registro → crear pedido → chat → aceptar → tracking → completar → pagar → calificar.<br>2. Flujo de registro de conductor con documentos.<br>3. Flujo de administracion (aprobar conductor).<br>4. Pruebas en mobile y desktop. |
| **H-39** | Como **admin**, quiero **tener logging estructurado y centralizado**, para **debuggear y monitorear la plataforma**. | 1. Logs en formato JSON.<br>2. Diferentes niveles (info, warn, error, debug).<br>3. Correlacion de requests via requestId.<br>4. Opcional: integracion con servicio externo (Datadog, Grafana). |

### 2.3 Seguridad y Cumplimiento

| # | Historia | Criterios de Aceptación |
|---|----------|------------------------|
| **H-40** | Como **sistema**, quiero **tener rate limiting por endpoint y por usuario**, para **prevenir abusos y ataques DoS**. | 1. Limite de requests por minuto por IP.<br>2. Limite especifico por endpoint sensible (login, crear ride).<br>3. Respuesta 429 cuando se excede.<br>4. Almacenamiento en Redis. |
| **H-41** | Como **sistema**, quiero **tener validacion y sanitizacion de inputs en todos los endpoints**, para **prevenir inyeccion y XSS**. | 1. Validacion de tipos con Zod en todas las rutas.<br>2. Sanitizacion de texto en mensajes y descripciones.<br>3. Limite de tamaños en inputs.<br>4. Proteccion contra NoSQL injection. |
| **H-42** | Como **sistema**, quiero **tener registro de auditoria de todas las acciones sensibles**, para **trazabilidad y compliance**. | 1. Log de cambios de estado de rides.<br>2. Log de acciones de admin.<br>3. Log de cambios en perfiles de usuario.<br>4. Timestamp, usuario, accion, detalle. |
| **H-43** | Como **usuario**, quiero **que mi informacion personal este protegida segun GDPR/leyes de privacidad**, para **tener confianza en la plataforma**. | 1. Consentimiento explicito al registro.<br>2. Opcion de descargar mis datos.<br>3. Opcion de eliminar mi cuenta y todos mis datos.<br>4. Politica de privacidad visible. |

### 2.4 Tracking en Tiempo Real y Mapas

| # | Historia | Criterios de Aceptación |
|---|----------|------------------------|
| **H-44** | Como **cliente**, quiero **ver la ubicacion del conductor en tiempo real en un mapa durante el viaje**, para **saber cuando llegara la mercancia**. | 1. Mapa con icono del conductor moviendose.<br>2. Actualizacion cada 5-10 segundos.<br>3. Ruta desde origen a destino.<br>4. Tiempo estimado de llegada. |
| **H-45** | Como **conductor**, quiero **compartir mi ubicacion en tiempo real mientras el viaje esta en progreso**, para **que el cliente pueda trackear el progreso**. | 1. Envio periodico de coordenadas via WebSocket o API.<br>2. Solo cuando el estado es `in_progress`.<br>3. No compartir ubicacion cuando no hay viaje activo.<br>4. Consumo minimo de bateria/datos. |
| **H-46** | Como **cliente**, quiero **ver el mapa con las ubicaciones de recogida y destino en los detalles del pedido**, para **visualizar geograficamente el servicio**. | 1. Mapa con marcadores de pickup y dropoff.<br>2. Ruta calculada entre los dos puntos.<br>3. Distancia aproximada.<br>4. Integracion con Leaflet/OpenStreetMap (ya implementado AddressInput). |

### 2.5 Pagos y Facturacion

| # | Historia | Criterios de Aceptación |
|---|----------|------------------------|
| **H-47** | Como **conductor**, quiero **recibir pagos automaticos semanales a mi cuenta bancaria via Stripe Connect**, para **tener ingresos predecibles**. | 1. Stripe Connect account con onboarding.<br>2. Transferencias automaticas (payouts).<br>3. Reporte de pagos por periodo.<br>4. Historial de transferencias. |
| **H-48** | Como **cliente**, quiero **recibir una factura o comprobante de pago por cada servicio**, para **mis registros contables**. | 1. PDF o email con detalle del pago.<br>2. Incluir: monto, comision, fecha, conductor.<br>3. Descargable desde el historial.<br>4. Envio automatico al completar pago. |
| **H-49** | Como **admin**, quiero **tener un dashboard de conciliacion de pagos con Stripe**, para **verificar que todos los pagos coinciden**. | 1. Tabla de pagos vs rides completados.<br>2. Deteccion de discrepancias.<br>3. Exportacion a CSV.<br>4. Filtros por fecha, estado, conductor. |
| **H-50** | Como **admin**, quiero **poder procesar reembolsos y disputas desde el panel**, para **manejar casos excepcionales**. | 1. Boton de reembolso en rides pagados.<br>2. Gestion de disputas desde Stripe.<br>3. Registro de motivo y evidencia.<br>4. Notificacion a ambas partes. |

### 2.6 Notificaciones y Comunicacion

| # | Historia | Criterios de Aceptación |
|---|----------|------------------------|
| **H-51** | Como **usuario**, quiero **recibir notificaciones por email cuando cambia el estado de mi pedido**, para **estar informado sin revisar la app**. | 1. Email al crear pedido.<br>2. Email cuando un conductor acepta.<br>3. Email cuando el viaje comienza.<br>4. Email cuando se completa el servicio. |
| **H-52** | Como **usuario**, quiero **recibir notificaciones push en mi movil cuando recibo un mensaje**, para **responder rapidamente a los conductores/clientes**. | 1. Push cuando llega nuevo mensaje.<br>2. Push cuando se recibe una propuesta.<br>3. Push cuando se acepta/rechaza una propuesta.<br>4. Configuracion de preferencias de notificacion. |
| **H-53** | Como **conductor**, quiero **recibir notificaciones cuando hay nuevos pedidos disponibles cerca de mi ubicacion**, para **ser el primero en ofertar**. | 1. Notificacion en tiempo real via WebSocket.<br>2. Opcional: push notification.<br>3. Filtro por tipo de acarreo y distancia.<br>4. No notificar si esta en viaje activo. |

### 2.7 MCP — Tools del Conductor y Usuario

| # | Historia | Criterios de Aceptación | Tool MCP | Autenticación | Que permite al agente IA |
|---|----------|------------------------|----------|---------------|--------------------------|
| **H-54** [MCP] | Como **usuario**, quiero **listar los pedidos disponibles para conductores**, para **ayudar a un conductor a encontrar trabajo cercano**. | 1. Filtro por tipo y distancia.<br>2. Paginacion.<br>3. No incluir pedidos del mismo conductor.<br>4. Datos del cliente (nombre, rating). | `list_available_rides` | Token MCP (driver) | El agente puede buscar y recomendar pedidos disponibles para conductores. |
| **H-55** [MCP] | Como **usuario**, quiero **enviar un mensaje en el chat de un ride**, para **automatizar la comunicacion con el cliente**. | 1. rideId + contenido del mensaje.<br>2. Verificar que el conductor tiene contacto activo.<br>3. Broadcast via WebSocket.<br>4. Retorna el mensaje creado. | `send_message` | Token MCP | El agente puede chatear automaticamente (ej: "Llegare en 10 min"). |
| **H-56** [MCP] | Como **usuario**, quiero **proponer un precio a un cliente**, para **negociar desde un chat automatizado**. | 1. rideId + precio propuesto.<br>2. Maximo 3 propuestas.<br>3. Debe haber contacto activo primero.<br>4. Retorna estado de la propuesta. | `propose_price` | Token MCP (driver) | El agente puede negociar precios en nombre del conductor. |
| **H-57** [MCP] | Como **usuario**, quiero **iniciar un viaje (cambiar a in_progress)**, para **automatizar el flujo cuando el conductor tiene la carga**. | 1. rideId requerido.<br>2. Solo driver asignado.<br>3. Solo desde estado `accepted`.<br>4. Retorna el ride actualizado. | `start_trip` | Token MCP (driver) | El agente puede iniciar el viaje cuando el conductor confirma carga. |
| **H-58** [MCP] | Como **usuario**, quiero **subir la foto de entrega (URL)**, para **completar el servicio automaticamente**. | 1. rideId + URL de imagen.<br>2. Solo driver asignado.<br>3. Solo desde estado `in_progress`.<br>4. Retorna confirmacion. | `upload_delivery_photo` | Token MCP (driver) | El agente puede registrar la evidencia de entrega. |
| **H-59** [MCP] | Como **usuario**, quiero **confirmar la entrega como cliente**, para **completar el ciclo del servicio**. | 1. rideId requerido.<br>2. Solo el cliente del ride.<br>3. Debe haber foto de entrega.<br>4. Cobro automatico si hay metodo de pago. | `confirm_delivery` | Token MCP (client) | El agente puede confirmar entregas y disparar pagos. |
| **H-60** [MCP] | Como **usuario**, quiero **calificar a la contraparte (1-5 estrellas + comentario)**, para **compartir feedback post-servicio**. | 1. rideId + rating + comment opcional.<br>2. Solo en estado `paid`.<br>3. Detectar automaticamente quien califica a quien.<br>4. Recalcular promedio del calificado. | `rate_service` | Token MCP | El agente puede calificar automaticamente post-servicio. |
| **H-61** [MCP] | Como **usuario**, quiero **obtener el historial de pagos del conductor**, para **analizar ganancias y productividad**. | 1. Paginacion.<br>2. Total de ganancias agregado.<br>3. Filtro por periodo de fechas.<br>4. Detalle por ride. | `get_payment_history` | Token MCP (driver) | El agente puede consultar y reportar ganancias del conductor. |
| **H-62** [MCP] | Como **usuario**, quiero **obtener el perfil completo de un conductor (rating, vehiculo, documentos, viajes)**, para **evaluar a un conductor antes de aceptar su oferta**. | 1. Retorna nombre, foto, rating y total de viajes.<br>2. Incluye tipo de vehiculo, placa y capacidad.<br>3. Muestra documentos verificados (licencia, seguro).<br>4. Error si el conductor no existe o no esta verificado. | `get_driver_profile` | Token MCP (driver) | El agente puede consultar informacion detallada de un conductor para decisiones informadas. |
| **H-63** [MCP] | Como **usuario**, quiero **cancelar un pedido en estados permitidos (requested, negotiating)**, para **gestionar cancelaciones sin abrir la plataforma**. | 1. Solo se puede cancelar en `requested` o `negotiating`.<br>2. Motivo de cancelacion requerido.<br>3. El cliente recibe notificacion de la cancelacion.<br>4. Retorna el estado actualizado del ride. | `cancel_ride` | Token MCP (client) | El agente puede cancelar pedidos en nombre del cliente cuando las condiciones lo permiten. |

### 2.8 Mejoras de Experiencia de Usuario

| # | Historia | Criterios de Aceptación |
|---|----------|------------------------|
| **H-64** | Como **usuario**, quiero **poder cambiar el idioma de la plataforma (espanol/ingles)**, para **usarla en mi idioma preferido**. | 1. Selector de idioma en el header.<br>2. Todos los textos traducibles via i18n.<br>3. Persistencia de preferencia.<br>4. Valores por defecto: espanol. |
| **H-65** | Como **usuario con discapacidad visual**, quiero **que la plataforma sea accesible (WCAG 2.1 AA)**, para **poder usar el servicio sin barreras**. | 1. Contraste de colores suficiente.<br>2. Navegacion por teclado.<br>3. ARIA labels en componentes interactivos.<br>4. Textos alternativos en imagenes. |
| **H-66** | Como **usuario**, quiero **que la aplicacion funcione offline parcialmente (PWA)**, para **consultar mis pedidos sin conexion a internet**. | 1. Service worker con cache de datos basicos.<br>2. Manifest de PWA.<br>3. Iconos y splash screen.<br>4. Notificaciones push como PWA. |

### 2.9 Operaciones y Mantenimiento

| # | Historia | Criterios de Aceptación |
|---|----------|------------------------|
| **H-67** | Como **admin**, quiero **tener backups automaticos de MongoDB**, para **recuperar datos en caso de desastre**. | 1. Backup diario automatico.<br>2. Retencion de 30 dias.<br>3. Restauracion point-in-time.<br>4. Backup cifrado en cloud storage. |
| **H-68** | Como **admin**, quiero **tener un dashboard de monitoreo con metricas (rendimiento, errores, usuarios activos)**, para **detectar problemas proactivamente**. | 1. Latencia de API por endpoint.<br>2. Tasa de error (5xx, 4xx).<br>3. Usuarios activos por hora.<br>4. Uso de CPU/memoria del servidor. |
| **H-69** | Como **admin**, quiero **tener un sistema de feature flags**, para **activar/desactivar funcionalidades sin desplegar**. | 1. Flags por funcionalidad.<br>2. Activacion por porcentaje de usuarios.<br>3. Interfaz de administracion.<br>4. Flags en backend y frontend. |
| **H-70** | Como **equipo de desarrollo**, quiero **tener migraciones de base de datos versionadas**, para **evolucionar el schema sin downtime**. | 1. Migraciones con up/down.<br>2. Ejecucion automatica al iniciar.<br>3. Estado de migraciones registrado en DB.<br>4. Rollback en caso de error. |

### 2.10 Datos y Reportes

| # | Historia | Criterios de Aceptación |
|---|----------|------------------------|
| **H-71** | Como **admin**, quiero **exportar reportes CSV de rides, usuarios y pagos**, para **analizar los datos externamente**. | 1. Exportacion de rides por periodo.<br>2. Exportacion de usuarios.<br>3. Exportacion de pagos y comisiones.<br>4. Filtros antes de exportar. |
| **H-72** | Como **conductor**, quiero **ver un resumen semanal de mis ganancias en el dashboard**, para **planificar mis finanzas**. | 1. Grafico de ganancias por dia.<br>2. Total de viajes en la semana.<br>3. Promedio por viaje.<br>4. Comparacion con semana anterior. |

---

## Resumen de Historias

| Tipo | Cantidad | Con MCP |
|------|----------|---------|
| **Implementado (MVP)** | 29 historias | 0 historias [MCP] |
| **Production Ready (faltante)** | 43 historias | 15 historias [MCP] |
| **Total** | **72 historias** | **15 historias [MCP]** |

### Total de historias [MCP]: 15 (H-30 a H-34, H-54 a H-63)

### Tools MCP (15 en total, todas en Production Ready):
| Tool | Descripción | Rol |
|------|-------------|-----|
| `list_my_rides` | Listar acarreos del cliente | Client |
| `create_ride` | Crear nuevo pedido | Client |
| `get_ride_details` | Obtener detalles de un ride | Client |
| `view_offers` | Ver ofertas recibidas | Client |
| `accept_offer` | Aceptar oferta de conductor | Client |
| `list_available_rides` | Listar pedidos disponibles | Driver |
| `send_message` | Enviar mensaje en chat | Driver/Client |
| `propose_price` | Proponer precio a cliente | Driver |
| `start_trip` | Iniciar viaje | Driver |
| `upload_delivery_photo` | Subir foto de entrega | Driver |
| `confirm_delivery` | Confirmar entrega | Client |
| `rate_service` | Calificar servicio | Driver/Client |
| `get_payment_history` | Historial de pagos | Driver |
| `get_driver_profile` | Obtener perfil del conductor | Driver/Client |
| `cancel_ride` | Cancelar pedido | Client |

---

> **Nota:** Este documento alimenta el proyecto de Servidor MCP sobre el comercio electronico. Las historias marcadas con [MCP] corresponden a funcionalidades que deben exponerse a traves de un MCP bajo autenticacion, importables desde Claude Code o Codex.
