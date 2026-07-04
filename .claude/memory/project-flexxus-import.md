---
name: project-flexxus-import
description: "Importador de clientes desde Flexxus (CSV/Excel), asignación grupal de vendedor, y estado del catálogo real de 3119 clientes"
metadata: 
  node_type: memory
  type: project
  originSessionId: 67fcea86-6567-4e8a-9e56-563865c95dac
---

Trabajo del 2026-07-03. El usuario (Facundo) obtuvo de Diego Liberal un export real de Flexxus con 3.119 clientes.

## Formato real de Flexxus (confirmado con archivo real)
CSV separado por `;`, codificación Latin-1, cada campo envuelto en `="valor"` (truco Excel). Fila 0 = headers, fila 1 en adelante = datos (sin fila vacía intermedia, a diferencia del viejo Excel de migración).

Columnas en este orden: `Código;Razón Social;C.U.I.T.;Dirección;Teléfono;Localidad;Provincia;Zona;Vendedor;Tipo Actividad;Mail;Código Postal`

**Por qué el código no se puede normalizar:** Flexxus no es consistente con el padding de ceros a la izquierda — hay pares de códigos distintos como `"0886"` y `"00886"` que pertenecen a clientes DIFERENTES. Sacar los ceros para comparar los mezcla. Se decidió usar el código tal cual viene, sin normalizar, como clave única.

**Implementado en `src/routes/clients.js`:**
- `parseFlexxusCSV()` / `parseFlexxusXLS()` / `parseClientsFile()` — detecta por extensión (.csv vs .xls/.xlsx), mismo layout de columnas para ambos
- El viejo `parseClientsXLS()` (con columna libre + fila vacía) quedó reemplazado — era solo para la migración inicial desde un Excel de Team Viewer, ya no se usa
- Vendedor: matchea por nombre parcial contra usuarios activos; si no matchea, guarda en `Client.legacySellerName` (ver [[feedback-preferences]] sobre el bug de mapeo)
- Endpoints nuevos: `GET /clients/legacy-seller-groups` (grupos sin vendedor real, con conteo) y `POST /clients/bulk-assign-seller` (asigna un vendedor real a todo un grupo de una)
- `GET /clients/delete-all-preview` — antes de "Eliminar todos", muestra cuántos clientes tienen historial (cotizaciones/órdenes) que se protegen por defecto
- "Eliminar todos" ahora acepta `forceHistory: true` para borrar en cascada (Order → Quote → Client) a los que tienen historial, con log de auditoría server-side (`[AUDIT] Usuario X forzó...`)

## Desglose real de vendedores en el archivo de Flexxus
- MERCADO LIBRE: 1323-1324 clientes
- ADMINISTRADOR SISTEMA: 1036 clientes
- JORGE TINGUELY: 421 clientes (vendedor real, pero **aún no se da de alta como usuario** — decisión explícita del usuario, esperar a que ellos lo registren)
- DIEGO LIBERAL: 319 clientes (vendedor real ya activo en el sistema)
- REDES: 20 clientes

**Why:** Mercado Libre, Administrador Sistema y Redes son canales/cuentas del sistema viejo, no vendedores reales — se guardan como `legacySellerName` para asignar manualmente cuando corresponda, en vez de crear usuarios falsos.

## Bug encontrado y resuelto: legacySellerName se perdía en el frontend
4 funciones distintas en el frontend mapean el array de clientes para mostrar (`loadAllData` en crm-api.jsx, sync periódico y mapeos de crear/editar cliente en crm-interact.jsx). Solo el mapeo del componente Clientes (usado tras importar) incluía `legacySellerName` — las otras 3 no, causando que el aviso apareciera un rato y desapareciera al refrescar o tras el polling automático (cada 25s). Ver [[feedback-preferences]] — lección: no asumir que es caché sin verificar la data real primero.

## Fix de caché de archivos estáticos
`express.static` en `src/server.js` no seteaba `Cache-Control`, dejando que el navegador cacheara `.jsx`/`.html` agresivamente tras cada deploy. Se agregó `Cache-Control: no-cache` para esos archivos (fuerza revalidación, no bloquea cacheo real).

## Railway — Volume persistente para adjuntos
Se creó un Volume (`crm-myselec-volume`) montado en `/app/uploads` del servicio `crm-myselec` en Railway, porque el filesystem del contenedor es efímero y cada deploy borraba los adjuntos subidos. Se hizo backup+restore vía `railway ssh` (tar por stdin/stdout) antes de crear el volume. Clave SSH (`railway-backup`) registrada en la cuenta de Railway de myselec para esto — sigue activa.

## Estado pendiente
- Falta importar el CSV real de 3.119 clientes en **producción** myselec (solo se probó en local hasta ahora)
- Jorge Tinguely, Mercado Libre, Administrador Sistema, Redes quedan como grupos `legacySellerName` para asignar cuando corresponda vía el panel "Vendedores sin asignar" en Clientes
