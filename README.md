# Nexus — Despliegue fuera de Claude.ai

Esta versión NO usa inteligencia artificial ni ninguna API paga. Se sacó
por completo el botón de "vigencia legal (IA)", que era lo único que
tenía un costo asociado (consumía créditos de la API de Anthropic cada
vez que alguien lo apretaba). Todo lo que queda —la ruleta de temas, el
registro de participantes, el panel de desarrollador— corre gratis en el
plan gratuito de Cloudflare.

La página sigue funcionando igual si la abrís dentro de Claude.ai
(detecta el entorno solo). Estos pasos son para cuando la alojes en tu
propio dominio.

## 1. Subir el proyecto a GitHub (necesario para que funcione el backend)

Cloudflare no soporta la carpeta `functions` cuando subís los archivos
arrastrándolos directo — hay que pasar por GitHub (gratis, sin instalar
nada):

1. Creá una cuenta gratis en https://github.com
2. "New repository" → ponele un nombre, por ejemplo `nexus-consultora`
3. En la página del repo: "Add file" → "Upload files" → arrastrá TODO lo
   que hay en esta carpeta (`index.html`, la carpeta `functions`, este
   README) → "Commit changes"

## 2. Crear el proyecto en Cloudflare Pages

1. Entrá a https://dash.cloudflare.com → Workers & Pages → Create → Pages
2. Elegí "Connect to Git" (no "Upload assets")
3. Autorizá el acceso a GitHub y elegí el repositorio que creaste
4. Dejá los campos de build vacíos (no hace falta build command) → "Save and Deploy"

## 3. Crear el almacenamiento (KV) — reemplaza a window.storage

1. Workers & Pages → KV → Create namespace → nombralo, por ejemplo, `nexus_kv`
2. En tu proyecto de Pages: Settings → Functions → KV namespace bindings
   → Add binding → Variable name: `NEXUS_KV` → Namespace: el que creaste

## 4. Configurar el código de acceso al modo programador

Settings → Environment variables → agregá esta variable como **Secret**:

- `DEV_SECRET_CODE` → el código que quieras usar para entrar al modo
  programador (podés dejar `1507` o cambiarlo)

Guardá y hacé clic en "Retry deployment" para que tome el cambio.

## 5. Dominio propio (opcional)

Settings → Custom domains → agregá tu dominio (ej: `nexus.tuconsultora.com`).
Cloudflare gestiona el certificado SSL automáticamente, sin costo.

## Qué cambia respecto a la versión de Claude.ai

| Función | Dentro de Claude.ai | Con este backend |
|---|---|---|
| Guardar perfil/puntaje | `window.storage` | Cloudflare KV vía `/api/storage` (gratis) |
| Código del modo programador | comparación en el navegador (visible en el código fuente) | `/api/dev-auth` (el código vive solo en el servidor) |

## Ideas para más adelante (ninguna implica costo de por sí, salvo que se aclare)

- Sesión grupal en vivo (un anfitrión gira, todos ven el mismo resultado)
- Tarjeta compartible para Instagram Stories
- Sistema de insignias por disciplina completa
- Enlaces de referido por participante
- PWA instalable en el celular
- Multilenguaje

Decime cuál seguimos y la armamos.
