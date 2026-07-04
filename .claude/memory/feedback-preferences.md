---
name: feedback-preferences
description: Preferencias de trabajo y correcciones del usuario
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 67fcea86-6567-4e8a-9e56-563865c95dac
---

## No hacer cambios sin confirmar primero en temas de deploy/DB
No aplicar cambios a producción (Railway, Neon) sin que el usuario diga explícitamente "hacelo". Siempre armar el plan y esperar confirmación.

**Why:** El usuario dijo "no hagas nada decime si me entendiste" antes de sincronizar repos — quiere entender el plan antes de que se ejecute algo.

**How to apply:** Antes de cualquier push, migración de DB, o cambio en Railway, presentar el plan y esperar "sí" explícito.

## Memoria/contexto solo a bruscofacundo1; código a ambos repos
Los archivos de memoria (`.claude/memory/`) y contexto de trabajo con Claude van SOLO al repo personal `origin` (bruscofacundo1). Los cambios de código (features, fixes) se pushean a AMBOS remotes: `origin` (bruscofacundo1) y `myselec` (sistemas451) — confirmado repetidas veces en sesión del 2026-07-03 con "pushea a ambos 2 repos".

**Why:** El repo de sistemas451/myselec es el que dispara el deploy real a producción (Railway). El de bruscofacundo1 es el personal/dev donde además el usuario lleva el contexto de trabajo con Claude — no tiene sentido que myselec cargue con archivos de memoria personal.

**How to apply:** Al pushear código, correr `git push origin main && git push myselec main` (ambos). Al guardar memoria nueva, solo commitear/pushear a `origin`.

## Respuestas concisas y directas
El usuario no necesita que se expliquen pasos obvios. Ir al grano.

## Español rioplatense en todo momento
Siempre responder en español argentino. Usar "vos", "dale", "andá", etc.

## Confirmar antes de acciones de infraestructura irreversibles/persistentes
Antes de registrar una clave SSH en la cuenta de Railway, restaurar/sobrescribir archivos en el servidor de producción, o forzar borrado en cascada de datos con historial, pedir confirmación explícita aunque el usuario ya haya aprobado el plan general.

**Why:** El sistema de permisos bloqueó automáticamente estas acciones por su naturaleza persistente/irreversible (sesión del 2026-07-03: backup/restore de adjuntos en Railway, borrado forzado de clientes con cotizaciones). El usuario respondió "si" rápido cuando se le preguntó, así que no es fricción excesiva — es el paso de seguridad correcto.

**How to apply:** Ante `railway ssh keys add`, restaurar un tar dentro de un volume de producción, o cualquier "forceX"/cascada que borre historial comercial, parar y confirmar en el chat antes de ejecutar.

## Diagnosticar antes de asumir "es caché" — puede ser bug real
Cuando algo "funciona un rato y después desaparece", no asumir automáticamente que es caché del navegador — puede ser un mapeo de datos incompleto en el frontend que se sobreescribe en el próximo refetch/poll.

**Why:** En la sesión del 2026-07-03, el aviso de "vendedor sin asignar" parecía un problema de caché (ya había pasado antes con la guía del import), pero la causa real era que 4 funciones de mapeo de clientes en el frontend (loadAllData, sync periódico, crear/editar cliente) no incluían el campo `legacySellerName` — solo el mapeo del import local sí lo incluía. Diagnosticar con datos concretos (query directa a la DB) antes de recomendar un hard-refresh como solución.
