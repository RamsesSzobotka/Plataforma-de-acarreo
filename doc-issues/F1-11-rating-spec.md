# F1-11: Calificar al Conductor

## Rol
Frontend + Backend

## Descripción
El cliente califica al conductor (1-5 estrellas + comentario) después de que el ride está en estado `paid`.

## Subtareas

### Backend
- [ ] Crear modelo Rating
- [ ] Endpoint POST /api/ratings
- [ ] Validar que ride esté en estado `paid`
- [ ] Validar ownership
- [ ] Calcular rating promedio del driver

### Frontend
- [ ] Componente de rating con estrellas interactivas
- [ ] Input para comentario opcional
- [ ] Botón "Enviar Calificación"
- [ ] Visible solo cuando status = `paid`
- [ ] Feedback "Gracias por calificar"
- [ ] Mostrar rating en perfil del conductor

## Criterios de Aceptación
- Visible solo cuando status = `paid`
- Rating 1-5 estrellas (required)
- Comentario opcional
- Solo se puede calificar una vez por ride
- Rating promedio actualizado