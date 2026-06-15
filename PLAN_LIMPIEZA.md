# Plan de limpieza CRM-Auto — instrucciones de ejecución

> Generado tras auditoría del 2026-06-12. Ejecutar en orden. NO improvisar:
> cada cambio está especificado con archivo, línea y reemplazo exacto.
> Al terminar cada bloque, marcar la casilla. Verificación final al pie.

Directorio de trabajo: `/Users/branel/CRM-auto`

---

## BLOQUE 1 — Eliminar `openwa-server/` (código muerto) ❌

**Hallazgo:** `openwa-server/index.js` es una versión **vieja** del servidor de WhatsApp,
reemplazada por `baileys-server/`. NADA en el proyecto lo referencia
(`grep -rln "openwa" app components lib baileys-server .env.local` → 0 resultados).
Está sin rastrear en git. Es peso muerto y confunde.

**Acción:**
```bash
cd /Users/branel/CRM-auto
rm -rf openwa-server
```
- [ ] Carpeta `openwa-server/` eliminada.

---

## BLOQUE 2 — Sacar de git lo que el `.gitignore` ya prohíbe ❌

**Hallazgo:** se commiteó `baileys-server/node_modules/` (2.896 archivos) y
`baileys-server/auth_info_*/` (225 archivos) ANTES de añadir esas reglas al
`.gitignore`. Siguen **rastreados** pese al ignore → inflan el repo (.git = 36 MB)
y las credenciales de sesión de WhatsApp (`auth_info_*`) NO deben estar en git.

**Acción** (solo deja de rastrear; NO borra los archivos del disco, baileys sigue
funcionando):
```bash
cd /Users/branel/CRM-auto
git rm -r --cached baileys-server/node_modules baileys-server/auth_info_baileys baileys-server/auth_info_default
```
- [ ] `git status` ya no muestra esos miles de archivos como rastreados.
- [ ] Confirmar que `baileys-server/node_modules/` y `auth_info_*` SIGUEN en disco
      (no usar `git rm` sin `--cached`).

---

## BLOQUE 3 — Unificar spinners de página completa con `<Spinner/>` 🔧

**Hallazgo:** el primitivo `Spinner` (en `components/ui/primitives.tsx`) ya renderiza
exactamente `flex justify-center py-16` + el círculo `w-8 h-8 border-4 border-blue-500
border-t-transparent rounded-full animate-spin`. Hay **10 páginas** que repiten ese
bloque a mano. Migrarlas.

### Regla de migración (aplicar SOLO a los loaders de página completa de abajo)

1. **Añadir el import** en cada archivo. Si el archivo ya importa de
   `@/components/ui/primitives`, añadir `Spinner` a esa línea. Si no, añadir una
   línea nueva junto al resto de imports:
   ```ts
   import { Spinner } from '@/components/ui/primitives'
   ```
2. **Reemplazar** el bloque de 3 líneas:
   ```tsx
   <div className="flex justify-center py-16">   // o py-12 / py-20
     <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
   </div>
   ```
   por:
   ```tsx
   <Spinner />
   ```

### Archivos y líneas exactas (loaders de página completa — SÍ migrar)

- [ ] `app/dashboard/tasks/page.tsx` — líneas 116-118
- [ ] `app/dashboard/pipeline/page.tsx` — líneas 139-141
- [ ] `app/dashboard/calendar/page.tsx` — líneas 184-186 (wrapper es `py-12`)
- [ ] `app/dashboard/categories/page.tsx` — líneas 73-75
- [ ] `app/dashboard/reports/page.tsx` — líneas 155-157
- [ ] `app/dashboard/catalog/page.tsx` — bloque del spinner en ~línea 155
- [ ] `app/dashboard/clients/[id]/page.tsx` — líneas 228-230 (wrapper es `py-20`)
- [ ] `app/dashboard/users/page.tsx` — líneas 273-275 (wrapper es `py-12`). OJO:
      este archivo tiene OTRO spinner en línea 544 (`w-10 h-10`, modal) → **NO tocar**.
- [ ] `app/dashboard/broadcast/page.tsx` — línea 99 (está todo en UNA línea:
      `<div className="flex justify-center py-16"><div className="w-8 h-8 ...animate-spin" /></div>`
      → reemplazar por `<Spinner />`). El de la línea 190 es un botón "Enviando..."
      → **NO tocar**.
- [ ] `app/dashboard/team/page.tsx` — línea 112 (igual, todo en una línea → `<Spinner />`).

---

## BLOQUE 4 — Spinners que NO se tocan (déjalos como están) ✋

Son spinners **inline contextuales** (dentro de botones, junto a texto, o con
tamaño/color propios). Sustituirlos por `<Spinner/>` (que trae `py-16`) los rompería.
**No modificar:**

- `app/dashboard/broadcast/page.tsx:190` — botón "Enviando…" (`w-4 h-4` blanco)
- `app/dashboard/clients/page.tsx:260` — `w-6 h-6` inline
- `app/dashboard/clients/[id]/page.tsx:273` — `w-4 h-4` junto a "reassigning"
- `app/dashboard/instagram/page.tsx:134` — `w-6 h-6` inline
- `app/dashboard/users/page.tsx:544` — `w-10 h-10` en modal
- `app/dashboard/marketplace/page.tsx:203,274` — usan `RefreshCw animate-spin`
- `app/dashboard/nexo/page.tsx:211` — `RefreshCw` "Cargando…"
- `app/admin/page.tsx:229,541,659` — colores gray/indigo propios del panel admin
- `components/**` (AuthGuard, ChatWindow, BaileysQR, InstagramConnect, GlobalSearch,
  PhotoUploader) — spinners de componentes, fuera de alcance
- `app/page.tsx`, `app/c/[orgId]/page.tsx`, `app/form/.../CaptureFormClient.tsx` —
  páginas públicas, fuera de alcance

---

## VERIFICACIÓN FINAL (obligatoria antes de terminar)

```bash
cd /Users/branel/CRM-auto
# 1. Typecheck — no debe haber errores nuevos
npx tsc --noEmit
# 2. Lint
npm run lint
# 3. Confirmar que openwa ya no existe
ls openwa-server 2>/dev/null && echo "ERROR: sigue existiendo" || echo "OK: openwa eliminado"
# 4. Confirmar que los miles de archivos salieron del index
git status --short | grep -c "baileys-server/node_modules" # debe imprimir 0 archivos rastreados nuevos
```

- [ ] `tsc --noEmit` sin errores.
- [ ] `npm run lint` sin errores nuevos.
- [ ] Las 10 páginas del Bloque 3 importan `Spinner` y ya no tienen el bloque manual.
- [ ] Ningún archivo del Bloque 4 fue modificado.

## NO HACER (fuera de alcance de esta limpieza)
- No tocar la lógica de negocio, Firestore, ni endpoints API.
- No migrar `PageHeader`/`Card`/`StatCard` todavía (es otra tarea, mayor riesgo).
- No borrar `auth_info_*` ni `node_modules` del DISCO (solo del índice de git).
- No commitear: dejar los cambios staged/working para que el usuario revise.
