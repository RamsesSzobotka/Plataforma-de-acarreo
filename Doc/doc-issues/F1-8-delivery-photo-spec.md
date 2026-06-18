# F1-8: Foto de Entrega del Conductor

## Rol
Frontend + Backend

## Descripción
El conductor sube una foto al llegar al destino. El cliente puede ver esta foto en los detalles del pedido.

## Subtareas

### Backend
- [ ] Endpoint POST /api/rides/:id/delivery-photo
- [ ] Integrar Cloudinary para guardar imagen
- [ ] Guardar photoUrl y publicId en ride

### Frontend
- [ ] Mostrar foto de entrega en RideDetails
- [ ] Thumbnail clickeable para ver en tamaño completo
- [ ] Badge "Foto de entrega" visible

## Criterios de Aceptación
- Foto visible para cliente después de `completed`
- Imagen de buena calidad
- Click para ver tamaño completo