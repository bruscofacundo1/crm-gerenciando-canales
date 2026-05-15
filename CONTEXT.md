# CRM Myselec — Contexto del proyecto

## Qué es esto
CRM comercial interno para **Myselec SRL** — empresa distribuidora de materiales eléctricos.
Gestiona cotizaciones (Fase 1) y órdenes de compra (Fase 2), con ingreso automático de pedidos por mail.

---

## Stack técnico
- **Backend**: Node.js + Express + Prisma ORM
- **DB**: PostgreSQL en Neon (cloud) — la conexión está en `.env`
- **Frontend**: React (sin bundler, cargado via CDN), Tailwind CSS, Recharts
- **Mail**: IMAP con node-imap + mailparser
- **PDF**: pdf-parse para extraer artículos de PDFs de Flexxus
- **Auth**: JWT con localStorage

## Correr el proyecto
```bash
npm install
npx prisma generate
npm run dev
# Abre en http://localhost:3000
```

---

## Estructura de archivos clave

```
src/
  server.js              — Express + rutas registradas
  routes/
    auth.js              — Login, forgot/reset password
    quotes.js            — Cotizaciones (CRUD + stage changes + items)
    orders.js            — Órdenes de compra
    clients.js           — Clientes
    users.js             — Usuarios (admin)
    data.js              — Dashboard, charts, stages, alertas
    articles.js          — Maestro de artículos (CRUD + importador XLS + sync)
    mail.js              — Sync IMAP manual
    notifications.js     — Reglas de notificación
    settings.js          — AppSettings
  services/
    mailReader.js        — Procesamiento automático de mails IMAP
    notifier.js          — Check de idle + envío de notificaciones
  middleware/
    auth.js              — JWT authMiddleware

public/
  crm-app.jsx            — App principal: routing, contexto global, Dashboard, Sidebar
  crm-views.jsx          — Vistas: Clients, Articles, Team, Config, MySalesView, LogisticsView
  crm-details.jsx        — Drawers de detalle: cotizaciones, OCs, ArticleSearchInput
  crm-interact.jsx       — Modales: nueva cotización, nueva OC, asignar, etc.
  crm-api.jsx            — API layer: CrmAuth, CrmApi, apiFetch, loadAllData

prisma/
  schema.prisma          — Modelos: User, Client, Quote, Order, Article, Activity, etc.

scripts/
  import-articles.js     — Importar XLS de Flexxus a la DB (node scripts/import-articles.js)
```

---

## Modelos principales (Prisma)

### Quote (Cotización — Fase 1)
- `stage`: recibida → asignada → armado → enviado → aceptada / rechazada
- `mailType`: SOLICITUD | PRESUPUESTO | OC | NOTA_PEDIDO
- `rejectReason`, `rejectNotes`: motivo de rechazo
- `sellerId`: vendedor asignado
- `items`: QuoteItem[] con sku, description, quantity, unitPrice, total

### Order (Orden de Compra — Fase 2)
- Se crea desde una Quote aceptada
- `stage`: oc → armado → despachado → entregada
- Items heredados de la Quote

### Article (Maestro de artículos)
- Importado desde Flexxus XLS (~3834 artículos)
- Campos: code (único), description, category, type, class, coefVar, active
- Importador en `/api/articles/preview` + `/api/articles/sync`

### StageDefinition
- Etapas configurables para COTIZACION y ORDEN_COMPRA
- Cada una tiene: stageKey, label, tone, order, mandatory, maxHours

---

## Funcionalidades implementadas

### Dashboard (admin)
- Filtros: vendedor + rango de fechas
- KPIs: cotizaciones activas, presupuestos enviados, OC en curso, entregas, monto cotizado, monto confirmado (NOTA_PEDIDO), tasa de conversión
- Carga en 2 pasadas: KPIs + alertas primero, gráficos después
- Alertas: presupuestos en etapa "enviado" sin movimiento por 3+ días
- Gráficos: vendedores (bar), etapas (pie), mensual (area), embudo de conversión, motivos de rechazo

### Procesamiento de mail (IMAP)
- Lee cuentas configuradas en EmailIntegration
- Procesa: SOLICITUD (mail de cliente), PRESUPUESTO (PDF Flexxus PR-), NOTA_PEDIDO (PDF Flexxus NP-)
- Auto-asigna vendedor por email de la cuenta IMAP
- Respuestas del cliente → crea Activity tipo NOTE en la cotización
- Ignora auto-replies (header Auto-Submitted)
- Aplica label `crm-procesado` en Gmail después de procesar
- Guarda lastSyncAt por cuenta en EmailIntegration

### Artículos
- Sección nueva en el nav (admin + vendedor)
- Tabla tipo Excel full-width: búsqueda, filtros por rubro/tipo/clase, ordenamiento por columna, paginación
- Importador XLS: preview diff (nuevos/actualizados/sin cambios/a eliminar) → confirmación → sync
- CRUD manual: crear, editar, eliminar con confirmación
- Autocomplete en SKU de ítems de cotización/OC (busca en catálogo al escribir)
- Verificación: ✓ verde si el SKU existe en catálogo, ? ámbar si no

---

## Pendientes / Próximas features

1. **CRUD manual de artículos** ✅ (hecho)
2. **Google OAuth login** — usuarios entran con cuenta Google del dominio, sin contraseña manual
3. **Preview PDF adjuntos** — ver PDFs inline sin descargar
4. **Nota de Pedido ↔ Presupuesto** — confirmar con Diego si Flexxus puede incluir número de presupuesto en el campo COMENTARIO para linkear automáticamente
5. **Limpiar datos hardcodeados** — quitar datos demo del código

---

## Roles de usuario
- `ADMIN` → todo: dashboard, config, equipo, artículos, clientes
- `VENDEDOR` → mis cotizaciones, mis OCs, pipeline, clientes (solo lectura), artículos
- `LOGISTICA` → operaciones (OCs en curso)

Los roles en el frontend llegan traducidos: `'Administrador'`, `'Vendedor'`, `'Logística'`

---

## Notas importantes
- La DB es Neon (free tier) — puede pausarse. El servidor reconecta solo al primer request.
- El `.env` tiene DATABASE_URL, JWT_SECRET y las credenciales IMAP
- `loadAllData()` en crm-api.jsx carga quotes, orders, clients, users, stages, activity al iniciar
- Los artículos NO se cargan en el contexto global — se fetchean on-demand desde la sección Artículos
- `buildBaseFilter()` en data.js convierte sellerId/from/to a cláusulas Prisma para el dashboard
- El importador XLS usa un token en memoria (expira 30 min) entre preview y sync
