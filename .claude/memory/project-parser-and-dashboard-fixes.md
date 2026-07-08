---
name: project-parser-and-dashboard-fixes
description: "Fix del parser Flexxus (presupuestos + NP), reparseo masivo, dedup de mail por carrera, y reestructura de KPIs del dashboard — sesión 2026-07-06/08"
metadata: 
  node_type: memory
  type: project
  originSessionId: 67fcea86-6567-4e8a-9e56-563865c95dac
---

Trabajo del 2026-07-06 a 2026-07-08, continuación de [[project-flexxus-import]].

## 1. Fix del parser Flexxus (`src/services/flexxusParser.js`)

Flexxus cambió el layout de los PDFs de presupuesto: ahora el orden es
`{código}{cantidad}U$S {total}U$S {unitario}{MARCA}{N°item}{DESCRIPCIÓN}`
(antes la descripción iba primero). El parser viejo resolvía correctamente
solo 5/17 presupuestos reales y 0/12 notas de pedido reales.

**Validado contra archivos reales del usuario** (`D:\presupuesto-crm`, `D:\np-crm`, catálogo `C:\Archivos Flexxus\Listado de Artculos...csv`):
- 17/17 presupuestos OK, 12/12 NP OK, con el catálogo de 3.797 artículos cargado
- El catálogo de artículos (`Article` model) se usa como estrategia de refuerzo para resolver SKUs ambiguos — importante subirlo también a producción (Config → Artículos, acepta CSV directo de Flexxus ahora)

**Bug de detección encontrado y arreglado:** `isNotaPedidoPDF()` buscaba el string `"nota de pedido"` con espacios, pero al guardar el adjunto en disco los espacios se sanitizan a `_`. Esto hacía que el reparseo masivo (ver abajo) no encontrara el PDF de NINGUNA NP (18/18 fallaban) mientras que Presupuesto funcionaba (criterio de una sola palabra, sin espacios). Fix: normalizar `_` → espacio antes de comparar.

**NP en pesos:** las notas de pedido de compras Mercado Libre vienen en `$` (no `U$S`). El parser ahora detecta la moneda (`currency: 'ARS'|'USD'`) y se propaga a los 3 puntos donde se crea la Quote NOTA_PEDIDO (mailReader.js x1, server.js x1, quotes.js x1).

## 2. Reparseo masivo (`src/routes/admin.js`, nuevo)

Feature para re-procesar cotizaciones ya cargadas con el parser corregido, gateado a rol DEVELOPER. Config → 🛠 Desarrolladores → "Reparsear PDFs Flexxus".

- Selección granular: checkbox por cotización + filtros Todos/Presupuestos/NPs
- Flujo preview (dry-run, no escribe nada) → aplicar
- Re-matchea cliente por CUIT si la cotización no tenía cliente asignado (reutiliza el mismo patrón que `mailReader.js`)
- Auditoría: log server-side de qué DEVELOPER reparseó qué cotizaciones y cuándo

## 3. Bug de duplicados por carrera de mail (M-9, ya cerrado)

Encontrados **10 pares de cotizaciones duplicadas en producción** (6 Presupuestos + 4 NP), todas con el mismo `emailMessageId` y el mismo `createdAt` exacto — dos sincronizaciones de mail corriendo en paralelo procesaron el mismo email dos veces. El chequeo previo (`findFirst`) no es atómico sin constraint único a nivel DB.

**Fix aplicado:**
- `emailMessageId` pasó de índice a `@@unique` en el schema (NULL sigue permitido para cotizaciones manuales)
- Los 3 puntos que crean Quote desde mail (`processNotaPedido`, `processSentMail`, `processEmail` en mailReader.js) atrapan el rechazo P2002 y lo tratan como "ya procesado por la otra sincronización" en vez de romper
- Se limpiaron los 10 duplicados en producción (se conservó siempre el insertado primero, usando `Attachment.createdAt` como timestamp real ya que `Quote.createdAt` refleja la fecha del email, no la inserción)

**Caso aparte, no tocado:** `COT-2026-005/006/009` (mismo PR-18172) — son 3 emails REALES distintos (distinto emailMessageId, distinto asunto), o sea el mismo presupuesto reenviado por mail 3 veces por una persona. No es el bug del sistema, queda a criterio del usuario si lo quiere unificar.

## 4. Reestructura de KPIs del dashboard (`src/routes/data.js`, `crm-app.jsx`)

**Bug 1 — "Monto cotizado" duplicaba plata con "Monto confirmado":** la query de `totalAmount` sumaba `amount` de TODAS las cotizaciones (sin filtrar `mailType`), incluidas las Notas de Pedido — que ya se contaban aparte en "Monto confirmado". Medido contra producción: la diferencia coincidía centavo a centavo con "Monto confirmado" en ambas monedas (USD $65.176,49 y ARS $418.130). Fix: aplicar el filtro `PRESUPUESTO_ONLY` (ya existía, se usaba solo para tasa de conversión) a las queries de monto.

**Bug 2 — mismo patrón en las tarjetas de cantidad:** "Cotizaciones activas" no filtraba por tipo y usaba el criterio de cierre de Fase 1 (`aceptada`/`rechazada`), que no aplica a NP/OC (cierran con `entregada`) — así que casi todas las NP activas quedaban contadas ahí Y en "OC en curso" (que ya las sumaba a propósito).

**Estructura nueva de 4 tarjetas (sin solapamiento):**
- **Cotizaciones activas** = ahora sí es el total real del sistema: F1 puro (Solicitud+Presupuesto, excluye `mailType IN ('OC','NOTA_PEDIDO')` igual que el tablero F1) + NP activas + OC activas, cada uno cerrado con su propio criterio
- **Presupuestos enviados** = sin cambios (Presupuestos en etapa `enviado`)
- **NP en curso** = tarjeta nueva, antes esta plata estaba escondida sumada dentro de "OC en curso"
- **OC en curso** = ahora solo `Order` (Fase 2 manual), sin mezclar NP

Medido en producción: "OC en curso" bajó de 19 a 2 (las 17 NP que tenía mezcladas pasaron a su propia tarjeta).

## 5. Aclaración de dominio: qué es una OC en este sistema

**No existe forma de crear una `Order` (OC) manual sin presupuesto atrás.** El wrapper `createOrder()` en `crm-api.jsx` (apunta a `POST /api/orders`) está definido pero **no lo llama ningún botón del frontend**. El único camino real es automático: `autoAcceptPresupuesto()` en `quoteHelper.js` crea la Order-espejo cuando un Presupuesto pasa a etapa `aceptada` (por NP vinculada o aceptación manual). El botón "Nueva Nota de Pedido" en el tablero F2 (`crm-kanban.jsx`) NO crea una `Order` — crea una `Quote` con `mailType: 'NOTA_PEDIDO'` vía `POST /api/quotes/create-np`, que es la otra mitad del patrón "dos tablas" de F2 (ver [[project-overview]]).

**Conclusión confirmada con el usuario:** en la práctica, OC = Presupuesto aceptado con su espejo automático. No hay OCs "sueltas" sin presupuesto en este sistema hoy.
