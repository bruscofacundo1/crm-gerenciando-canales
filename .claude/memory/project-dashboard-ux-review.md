---
name: project-dashboard-ux-review
description: "Revisión UX del Dashboard admin — filtros inconsistentes entre secciones, aclaraciones agregadas, decisión de no unificar createdAt/stageChangedAt"
metadata:
  node_type: memory
  type: project
  originSessionId: 832d716f-6a3c-4b91-9493-984d9ec57cb7
---

Revisión hecha el 2026-07-08, a pedido del usuario, sobre cómo está dividido el Dashboard (secciones, filtros). Ver también [[project-parser-and-dashboard-fixes]].

## Hallazgo principal: los filtros (vendedor / fecha) no aplican igual en las 8 secciones

El Dashboard (`public/crm-app.jsx`, componente `Dashboard`, función completa ~línea 1249-1743) tiene 2 filtros globales (`sellerId`, `from`/`to`) pero cada sección los respeta distinto:

| Sección | Vendedor | Fecha |
|---|---|---|
| KPI cards | Sí | Sí |
| Alertas sin respuesta | Sí | No (endpoint no acepta from/to) |
| Cotizaciones por vendedor | No (a propósito, `data.js:193-194`) | Sí |
| Distribución por etapa | Sí | Sí |
| Evolución mensual | Sí | No (siempre últimos 6 meses fijos) |
| Embudo de conversión | Sí | Sí |
| Motivos de rechazo | Sí | Sí |
| Próximas a vencer | No (client-side, sin filtrar) | No |
| Últimas actividades | No (feed global) | No |

**Why:** Un admin que filtra por vendedor + fecha puede sacar conclusiones erróneas de los bloques que no respetan el filtro sin darse cuenta, porque visualmente no había ninguna aclaración.

## Cambios aplicados (sesión 2026-07-08)

1. **Aclaración visual en 2 gráficos** (`public/crm-app.jsx`):
   - "Cotizaciones por vendedor" — subtítulo agrega "muestra todos los vendedores para comparar" cuando hay `filters.sellerId` activo.
   - "Evolución mensual" — subtítulo dice "Últimos 6 meses fijos" + "no usa el rango de fechas filtrado" cuando `filters.from`/`to` están activos.

2. **KPI "Cotizaciones activas"** — subtítulo cambiado de "total del sistema" a **"F1 + NP + OC en curso"** para que el nombre no oculte que es una suma heterogénea de 3 fases. No se eliminó la tarjeta (decisión de negocio, no técnica — pendiente si el usuario quiere sacarla más adelante, ahora que existen "NP en curso" y "OC en curso" desglosadas).

3. **NO se unificó el criterio de fecha `createdAt` vs `stageChangedAt`** en `src/routes/data.js` (`/charts/monthly`). Se investigó a fondo y **no es un bug**: "recibidas" usa `createdAt` (mes de creación) y "ganadas" usa `stageChangedAt` con fallback a `updatedAt` (mes en que se ganó). Unificar rompería el gráfico — un presupuesto creado en enero y ganado en marzo aparecería falsamente como "ganado en enero". Se agregó un comentario explicativo arriba del endpoint en `data.js` para que nadie lo "corrija" por error en el futuro pensando que es inconsistencia.

## How to apply
Si en el futuro se propone "unificar" fechas en `/charts/monthly`, recordar que es intencional — leer el comentario en `data.js` antes de tocarlo. Si se pide sacar o rediseñar la tarjeta "Cotizaciones activas", es decisión de negocio del usuario, no autónoma.
