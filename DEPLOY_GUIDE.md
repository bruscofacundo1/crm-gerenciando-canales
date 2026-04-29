# 🚀 Guía completa: MySelec CRM — De cero a producción

## PARTE 1: PREPARAR TU MÁQUINA LOCAL

### Paso 1: Descomprimir el proyecto
```bash
# Descomprimí el zip que descargaste
unzip myselec-crm.zip
cd myselec-crm
```

### Paso 2: Instalar dependencias
```bash
npm install
```
Esto va a instalar Express, Prisma, bcryptjs, jsonwebtoken, imap, mailparser, etc.
Debería tardar 1-2 minutos. Cuando termine vas a ver una carpeta `node_modules/`.

---

## PARTE 2: CREAR LA BASE DE DATOS EN NEON

### Paso 3: Crear proyecto nuevo en Neon
1. Andá a https://neon.tech y logueate
2. Click en "New Project"
3. Nombre: `myselec-crm`
4. Región: `us-east-1` (o la que prefieras)
5. Click "Create Project"
6. Te va a mostrar el connection string. Copialo, se ve así:
   ```
   postgresql://neondb_owner:TU_PASSWORD@ep-algo-algo-12345.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
7. Guardalo, lo vas a necesitar en el paso siguiente.

---

## PARTE 3: CONFIGURAR VARIABLES DE ENTORNO

### Paso 4: Crear archivo .env
```bash
cp .env.example .env
```

### Paso 5: Editar el .env
Abrí el archivo `.env` con VS Code y completá:

```env
# Pegá acá el connection string de Neon del paso 3
DATABASE_URL="postgresql://neondb_owner:TU_PASSWORD@ep-algo.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Generá un string random largo (podés usar: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET="pegá_acá_el_string_random"

# La cuenta de Gmail de MySelec que te dieron
MAIL_USER="elmail@queTeeDieron.com"
MAIL_PASSWORD="la_app_password_de_16_caracteres"
MAIL_HOST="imap.gmail.com"
MAIL_PORT=993

PORT=3000
```

### Paso 6: Generar el JWT_SECRET
Abrí una terminal y ejecutá:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Te va a imprimir algo como `a3f8c2e1...`. Copialo y pegalo en JWT_SECRET.

---

## PARTE 4: CONFIGURAR GMAIL (App Password)

### Paso 7: Generar contraseña de aplicación de Gmail
1. Entrá a la cuenta de Gmail que te dieron (la de MySelec)
2. Andá a: https://myaccount.google.com/security
3. Buscá "Verificación en 2 pasos" → Activala si no está
4. Una vez activada, volvé a Seguridad
5. Buscá "Contraseñas de aplicaciones" (o "App passwords")
   - Si no aparece, entrá directo: https://myaccount.google.com/apppasswords
6. En "Seleccionar app" poné: "Otra (nombre personalizado)"
7. Nombre: "CRM MySelec"
8. Click "Generar"
9. Te va a mostrar una contraseña de 16 caracteres (tipo: `abcd efgh ijkl mnop`)
10. Copiala SIN ESPACIOS y pegala en MAIL_PASSWORD del .env

⚠️ IMPORTANTE: Si la cuenta es de Google Workspace (dominio corporativo), puede que necesites que el admin del dominio habilite "acceso de apps menos seguras" o permita contraseñas de aplicación. Si no te deja, preguntale a Victoria/Diego.

---

## PARTE 5: CREAR LAS TABLAS Y CARGAR DATOS

### Paso 8: Pushear el schema a la base de datos
```bash
npx prisma db push
```
Esto crea todas las tablas en Neon. Deberías ver:
```
🚀 Your database is now in sync with your Prisma schema.
```

### Paso 9: Generar el cliente de Prisma
```bash
npx prisma generate
```

### Paso 10: Cargar datos iniciales (seed)
```bash
npm run seed
```
Deberías ver:
```
🌱 Seeding database...
👥 Creating users...        ✅ 6 users created
📋 Creating stage definitions... ✅ 16 stages created
❌ Creating rejection reasons... ✅ 6 rejection reasons created
🏢 Importing clients...     ✅ 214 clients imported from Excel
📄 Creating sample quotes... ✅ 5 sample quotes created
📧 Creating email integration... ✅ done
🎉 Seed complete!
```

### Paso 11: Verificar en Neon (opcional)
Andá a https://console.neon.tech → Tu proyecto → SQL Editor
Ejecutá:
```sql
SELECT COUNT(*) FROM "Client";
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "StageDefinition";
```
Deberías ver 214 clientes, 6 usuarios, 16 etapas.

---

## PARTE 6: PROBAR LOCALMENTE

### Paso 12: Arrancar el servidor
```bash
npm run dev
```
Deberías ver:
```
🚀 MySelec CRM running at http://localhost:3000
```

### Paso 13: Probar en el navegador
1. Abrí http://localhost:3000
2. Logueate con: victoria@myselec.com.ar / myselec2026
3. Deberías ver el dashboard con datos reales
4. Probá el botón "Sincronizar Mail" → debería leer la bandeja de Gmail

### Paso 14: Probar la API directamente (opcional, con Thunder Client o curl)
```bash
# Health check
curl http://localhost:3000/api/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"victoria@myselec.com.ar","password":"myselec2026"}'

# Te devuelve un token. Usalo para los demás endpoints:
curl http://localhost:3000/api/quotes \
  -H "Authorization: Bearer TU_TOKEN_ACÁ"
```

---

## PARTE 7: DEPLOY A PRODUCCIÓN (Railway)

Railway es la opción más simple para este tipo de proyecto (Express + PostgreSQL).
Tiene plan gratuito y no requiere configuración de Docker.

### Paso 15: Crear cuenta en Railway
1. Andá a https://railway.app
2. Logueate con tu cuenta de GitHub

### Paso 16: Subir el código a GitHub
```bash
# Desde la carpeta myselec-crm
git init
git add .
git commit -m "CRM MySelec v1 - MVP"

# Crear repo en GitHub (podés hacerlo desde github.com/new)
# Nombre: myselec-crm (privado)
git remote add origin https://github.com/TU_USUARIO/myselec-crm.git
git branch -M main
git push -u origin main
```

### Paso 17: Crear proyecto en Railway
1. En Railway, click "New Project"
2. Elegí "Deploy from GitHub repo"
3. Seleccioná tu repo `myselec-crm`
4. Railway detecta automáticamente que es Node.js

### Paso 18: Configurar variables de entorno en Railway
1. En el dashboard de Railway, click en tu servicio
2. Andá a la pestaña "Variables"
3. Agregá TODAS las variables del .env:
   - `DATABASE_URL` → tu connection string de Neon
   - `JWT_SECRET` → tu secret
   - `MAIL_USER` → el mail de MySelec
   - `MAIL_PASSWORD` → la app password
   - `MAIL_HOST` → imap.gmail.com
   - `MAIL_PORT` → 993
   - `PORT` → 3000

### Paso 19: Configurar el Start Command
En Railway → Settings → Deploy:
- Start Command: `npm run start`
- Si pide Build Command: `npx prisma generate`

### Paso 20: Obtener la URL pública
1. En Railway → Settings → Networking
2. Click "Generate Domain"
3. Te da una URL tipo: `myselec-crm-production.up.railway.app`

### Paso 21: Correr el seed en producción
En Railway → tu servicio → click en "New" → "Command"
Ejecutá:
```bash
npx prisma db push && npm run seed
```

### Paso 22: ¡Listo!
Entrá a tu URL de Railway y logueate. Compartile la URL a Hollman para la demo del miércoles.

---

## PARTE 8: ALTERNATIVA — Deploy en Render (si Railway no te convence)

### Opción B: Render.com
1. Andá a https://render.com y logueate con GitHub
2. New → Web Service → conectá tu repo
3. Configurá:
   - Name: myselec-crm
   - Runtime: Node
   - Build Command: `npm install && npx prisma generate`
   - Start Command: `npm run start`
4. Agregá las variables de entorno (mismas que Railway)
5. Click "Create Web Service"
6. Te da URL tipo: `myselec-crm.onrender.com`

⚠️ Render free tier tiene cold starts (tarda ~30 seg la primera vez). Railway no tiene ese problema.

---

## RESUMEN DE CUENTAS NECESARIAS

| Servicio | URL | Uso | Costo |
|----------|-----|-----|-------|
| Neon | neon.tech | Base de datos PostgreSQL | Gratis (0.5 GB) |
| Railway | railway.app | Hosting del servidor | Gratis ($5/mes crédito) |
| GitHub | github.com | Repositorio del código | Gratis |
| Gmail | gmail.com | Lectura de mails | Ya lo tienen |

---

## TROUBLESHOOTING

### "Error: Cannot find module '@prisma/client'"
→ Ejecutá: `npx prisma generate`

### "Error: P1001 Can't reach database server"
→ Verificá que el DATABASE_URL en .env esté bien. Probá abrir Neon y hacer un query manual.

### "Error al sincronizar mail: IMAP connection error"
→ Verificá MAIL_USER y MAIL_PASSWORD. Asegurate de usar la App Password, NO la contraseña normal de Gmail.

### "El login no funciona"
→ Verificá que corriste `npm run seed`. La contraseña default es `myselec2026`.

### "Los datos no cargan después del login"
→ Abrí la consola del navegador (F12) y fijate si hay errores de red (401, 500). Si dice 401, el token expiró — recargá la página.
