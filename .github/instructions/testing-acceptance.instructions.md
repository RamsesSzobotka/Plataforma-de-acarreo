---
description: "Usar cuando se agreguen o modifiquen modulos funcionales para exigir pruebas minimas y validar criterios de aceptacion del PRD."
name: "Testing y Aceptacion"
---
# Instrucciones de pruebas y aceptacion

- Cada modulo debe tener al menos:
  - 1 prueba de caso feliz,
  - 1 prueba de caso negativo.
- Validar flujos clave:
  - ride requested -> accepted -> in_progress -> completed -> paid/cancelled,
  - pago confirmado solo por webhook Stripe,
  - acceso por rol y ownership.
- Antes de merge, verificar que cliente, conductor y admin no se rompan.
- Priorizar pruebas de contrato API para evitar regresiones entre frontend y backend.
- Si se cambia un endpoint, actualizar sus pruebas y consumidores.
