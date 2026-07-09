---
name: project-full-ux-audit
description: "Auditoría UX completa del sistema (Kanban, Detalle, Notificaciones/Nav, Clientes/Equipo/Config) hecha con 4 agentes en paralelo — bugs reales encontrados + hallazgos priorizados"
metadata:
  node_type: memory
  type: project
  originSessionId: 832d716f-6a3c-4b91-9493-984d9ec57cb7
---

Auditoría hecha el 2026-07-08 a pedido del usuario ("analizar todo el sistema y proponer mejoras de UX/usabilidad"), con 4 agentes en paralelo cubriendo: Kanban (F1/F2), Vistas de detalle (Quote/Order), Notificaciones+navegación global+auth, Clientes+Equipo+Config. Ver también [[project-dashboard-ux-review]] (dashboard ya cubierto en sesión anterior, no se repitió acá).

**Why:** el usuario quiere una base de mejoras concretas de UX antes de decidir qué priorizar. Ninguno de estos cambios está aplicado todavía — es solo el análisis.

## Bugs reales encontrados (no opinión, código roto)

1. **`setInboxAlerts` no desestructurado** — `public/crm-interact.jsx:1826-1827`. `NotificationsPopover` lo usa en el callback de `ReminderModal` pero no lo saca de `useApp()`. `ReferenceError` al mandar un recordatorio desde la campana.
2. **`roleKey === 'vendedor'` nunca es true** — `public/crm-interact.jsx:1496`. El valor real del mapeo de rol es `'seller'` (ver `crm-app.jsx:123`). `canReassign` para Quote nunca se activa para vendedores.
3. **Sin rollback en edición de ítems** — `public/crm-details.jsx:233-248` (`OCItemsTab.saveEdit`). Actualiza estado local y sale de modo edición ANTES de que resuelva el API call. Si falla, el usuario ve el cambio "guardado" que en realidad no se persistió. Comparar con `toggleChecked` (líneas 218-226) que sí hace rollback correcto — usar como referencia al arreglar.
4. **Header de OrderDetail miente si es NP** — `public/crm-details.jsx:2249`. El `subtitle` del drawer es fijo `"Fase 2 · Orden de Compra · {etapa}"` sin mirar el flag `isNP` que ya existe en el mismo componente.

## Top 5 hallazgos de impacto (no-bugs, pero UX real)

1. **Kanban**: cambiar etapa es solo drag-and-drop en `KanbanQuotes` y en `KanbanOrders` fuera de `logisticsMode` — sin botón alternativo, sin atajo de teclado, cero accesibilidad. El propio equipo ya resolvió esto para logística (botón "Avanzar etapa") pero no se generalizó. `public/crm-kanban.jsx:371-388`.
2. **SendEmailModal**: "Abrir en Gmail" avanza la etapa a "Enviado" igual que "Enviar", pero no garantiza que el mail se haya mandado (usuario tiene que completarlo manualmente en la pestaña que se abre, sin adjunto). `public/crm-details.jsx:549-564, 634-656`.
3. **Importación XLS de clientes**: `ClientImportModal` tiene MENOS fricción de confirmación que "Eliminar todos" a pesar de poder sobreescribir/eliminar cientos de clientes, y no hay ningún registro de auditoría ni rollback — el `upsert` pisa los datos directo. `public/crm-views.jsx:1161-1169`, `src/routes/clients.js:560-653`.
4. **Sesión expirada sin aviso**: interceptor global hace `window.location.reload()` inmediato en cualquier 401 fuera de `/auth/*`, sin toast ni intento de preservar formularios abiertos. `public/crm-api.jsx:26-36`.
5. **Sin indicador de ownership en detalle**: `canReassign` se calcula solo por rol, no compara si la cotización/orden es del usuario logueado — un VENDEDOR ve exactamente la misma UI editable en una cotización ajena, sin ningún banner. Es la manifestación en frontend del issue A-1 ya documentado en CLAUDE.md. `public/crm-interact.jsx:1494-1501`.

## Otros hallazgos por área (resumen, ver informes completos en la transcripción de sesión si hace falta detalle)

**Kanban** (`crm-kanban.jsx`): sin virtualización/paginación en columnas largas (riesgo con 100+ tarjetas), filtros de kanban no persisten en localStorage (a diferencia de `sidebarCollapsed` que sí), toast de error de etapa obligatoria desaparece en 3.2s sin poder releerlo, cero soporte touch/mobile para drag-and-drop, `OrderCard` no tiene indicador de "vencido por etapa" aunque `QuoteCard` sí.

**Detalle** (`crm-details.jsx`): cambio de etapa sin ninguna confirmación salvo "rechazada" (que sí pide motivo), edición de "Total con IVA" se guarda en `onBlur` sin botón explícito, botón de adjuntar simula drag-and-drop visualmente pero no tiene los handlers, errores de Multer (archivo grande) no se manejan explícitamente en `server.js` y devuelven HTML en vez de JSON — mensaje críptico al usuario, duplicación masiva de JSX entre QuoteDetail/OrderDetail generó inconsistencias no intencionales (atajo Ctrl+Enter solo en uno, iconMap de historial distinto en cada uno).

**Notificaciones/Nav/Auth** (`crm-interact.jsx`, `crm-app.jsx`): badge de campana cuenta tipos de alerta no cantidad real de ítems, snooze/posponer alertas tiene baja jerarquía visual (poco descubrible), 3 patrones de modal conviviendo (`ProfileModal` y `ImageCropper` no pasan por `MODAL_REGISTRY`, posicionamiento distinto), sidebar colapsado pierde el indicador de sección activa, login no distingue "cuenta pendiente de aprobación" de "credenciales inválidas".

**Clientes/Equipo/Config** (`crm-views.jsx`): "Reparsear PDFs Flexxus" (herramienta operativa de negocio) escondida detrás de tab exclusivo de DEVELOPER, guardar "dominios de email permitidos" (controla quién puede registrarse) no tiene ninguna confirmación, eliminar cliente individual usa `window.confirm()` nativo en vez del modal de marca, `Clients` es la única vista con dataset potencialmente grande que NO usa paginación server-side (a diferencia de Articles y LoginLogs que sí). Puntos positivos: flujo de aprobación de usuarios, manejo de LoginLogs con aviso proactivo de export, protección server-side al desactivar usuario con cotizaciones activas (409 requiresConfirmation).

## How to apply
Cuando el usuario pida arrancar a implementar mejoras de UX, priorizar primero los 4 bugs reales (son gratis de arreglar y no requieren decisión de producto), después los 5 de impacto alto. El resto son mejoras incrementales — no asumir que hay que hacerlas todas, preguntar cuáles le importan antes de tocar código.
