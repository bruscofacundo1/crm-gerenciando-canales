# MySelec CRM — Sistema de Gestión Comercial

CRM personalizado para MySelec. Gestión de cotizaciones, órdenes de compra y trazabilidad completa del ciclo comercial.

## Setup rápido

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
```

Editá `.env` con tus datos:
- **DATABASE_URL**: tu conexión de Neon (PostgreSQL)
- **JWT_SECRET**: un string random largo
- **MAIL_USER**: la cuenta de Gmail de MySelec
- **MAIL_PASSWORD**: la App Password de Gmail (16 caracteres)

### 3. Preparar la base de datos
```bash
npx prisma db push
npx prisma generate
npm run seed
```

### 4. Arrancar el servidor
```bash
npm run dev
```

Abrí `http://localhost:3000` en el navegador.

### 5. Login
- **Email**: victoria@myselec.com.ar (o cualquier usuario del seed)
- **Contraseña**: myselec2026

## Credenciales de Gmail

Para generar la App Password:
1. Entrá a la cuenta de Gmail → Configuración → Seguridad
2. Activá "Verificación en 2 pasos" si no está
3. Volvé a Seguridad → "Contraseñas de aplicaciones"
4. Creá una nueva para "Otra (nombre personalizado)" → "CRM MySelec"
5. Copiá la contraseña de 16 caracteres y ponela en MAIL_PASSWORD del .env

## Estructura del proyecto
```
myselec-crm/
├── prisma/
│   ├── schema.prisma      ← Modelo de datos
│   └── seed.js            ← Carga inicial (clientes, etapas, usuarios)
├── src/
│   ├── server.js          ← Express server
│   ├── routes/
│   │   ├── auth.js        ← Login / JWT
│   │   ├── quotes.js      ← CRUD cotizaciones
│   │   ├── orders.js      ← CRUD órdenes de compra
│   │   ├── clients.js     ← CRUD clientes
│   │   ├── data.js        ← Usuarios, etapas, actividad, dashboard
│   │   └── mail.js        ← Sincronizar bandeja de entrada
│   ├── services/
│   │   └── mailReader.js  ← Conexión IMAP a Gmail
│   └── middleware/
│       └── auth.js        ← JWT middleware
├── public/                ← Frontend (React + Tailwind)
│   ├── index.html
│   ├── crm-api.jsx        ← Capa de API (fetch + JWT)
│   ├── crm-data.jsx       ← Datos estáticos de fallback + helpers
│   ├── crm-app.jsx        ← Login + routing + sidebar + dashboard
│   ├── crm-interact.jsx   ← Context provider + modales
│   ├── crm-kanban.jsx     ← Vista Kanban
│   ├── crm-details.jsx    ← Detalle de cotización/OC
│   └── crm-views.jsx      ← Clientes, equipo, config, logística
├── .env.example
├── package.json
└── README.md
```

## Usuarios del seed
| Email | Rol | Contraseña |
|---|---|---|
| victoria@myselec.com.ar | Admin | myselec2026 |
| diego@myselec.com.ar | Admin | myselec2026 |
| luciano@myselec.com.ar | Vendedor | myselec2026 |
| santiago@myselec.com.ar | Vendedor | myselec2026 |
| felipe@myselec.com.ar | Vendedor | myselec2026 |
| depo1@myselec.com.ar | Logística | myselec2026 |
