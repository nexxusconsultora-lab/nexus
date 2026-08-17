# Nexus — Despliegue fuera de Claude.ai

Esta carpeta contiene la página (`index.html`) más el backend chico
(`functions/api/*.js`) que necesita para funcionar en un hosting propio,
en vez de depender de la vista previa de artifacts de Claude.ai.

La página sigue funcionando igual si la abrís dentro de Claude.ai (detecta
el entorno solo). Estos pasos son para cuando la alojes en tu propio
dominio.

## 1. Crear el proyecto en Cloudflare Pages

1. Entrá a https://dash.cloudflare.com → Workers & Pages → Create → Pages.
2. Subí esta carpeta (o conectá el repo de GitHub donde la subas).
3. Build settings: no hace falta build command, el "output directory" es
   la raíz (donde está `index.html`).

## 2. Crear el namespace de KV (reemplaza a window.storage)

1. Workers & Pages → KV → Create namespace → nombralo, por ejemplo, `nexus_kv`.
2. En tu proyecto de Pages: Settings → Functions → KV namespace bindings
   → Add binding → Variable name: `NEXUS_KV` → Namespace: el que creaste.

## 3. Configurar los secretos

En tu proyecto de Pages: Settings → Environment variables → agregá estas
dos como **Secret** (no como texto plano):

- `ANTHROPIC_API_KEY` → tu clave de https://console.anthropic.com
- `DEV_SECRET_CODE` → el código que quieras usar para entrar al modo
  programador (podés dejar `1507` o cambiarlo — se recomienda cambiarlo)

## 4. Dominio propio (opcional)

Settings → Custom domains → agregá tu dominio (ej: `nexus.tuconsultora.com`).
Cloudflare gestiona el certificado SSL automáticamente.

## Qué cambia respecto a la versión de Claude.ai

| Función | Dentro de Claude.ai | Con este backend |
|---|---|---|
| Guardar perfil/puntaje | `window.storage` | Cloudflare KV vía `/api/storage` |
| Verificar vigencia legal | fetch directo a Anthropic (proxeado por Claude.ai) | `/api/legal-check` (la key nunca sale del servidor) |
| Código del modo programador | comparación en el navegador (visible en el código fuente) | `/api/dev-auth` (el código vive solo en el servidor) |

## Pendiente / ideas para una próxima ronda

Ya quedaron implementadas las estadísticas agregadas y la exportación en
JSON del panel de desarrollador, y las metaetiquetas para compartir el
link. Lo que quedó afuera de esta tanda por ser features más grandes,
para cuando quieras encararlas:

- Sesión grupal en vivo (un anfitrión gira, todos ven el mismo resultado)
- Tarjeta compartible para Instagram Stories
- Sistema de insignias por disciplina completa
- Enlaces de referido por participante
- Imagen de vista previa (`og:image`) una vez que tengas el dominio final
- PWA instalable en el celular
- Multilenguaje

Decime cuál seguimos y la armamos.
