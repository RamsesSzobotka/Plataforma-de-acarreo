# F1-6: Chat y Negociación entre Cliente y Conductor

## Rol
Frontend + Backend

## Descripción
Implementar sistema de chat en tiempo real entre cliente y conductor asociado a un ride, disponible cuando el pedido está en `negotiating` o `accepted`.

## Subtareas

### Frontend
- [ ] Componente Chat.tsx existente - mejorar con WebSocket
- [ ] Integrar socket para mensajes en tiempo real
- [ ] Mostrar indicador de "escribiendo..." 
- [ ] Notificaciones push cuando llega mensaje offline

### Backend  
- [ ] Implementar WebSocket server (Socket.IO o Bun native)
- [ ] Crear canal por rideId
- [ ] Guardar mensajes en MongoDB
- [ ] Endpoint GET /messages/ride/:rideId
- [ ] Endpoint POST /messages
- [ ] Marcar mensajes como leídos

## Criterios de Aceptación
- Chat visible solo para rides en `negotiating` o `accepted`
- Mensajes persistidos en MongoDB
- Tiempo real < 1s de latencia
- Notificaciones en tiempo real