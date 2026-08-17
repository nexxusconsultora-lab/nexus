// Cloudflare Pages Function — /api/storage
// Reemplaza window.storage (disponible solo dentro de artifacts de
// Claude.ai) usando Workers KV, para que el registro de participantes,
// el puntaje y el panel de desarrollador funcionen en un hosting propio.
//
// Configuración necesaria en Cloudflare Pages:
//   1) Creá un namespace de KV (Workers & Pages > KV > Create namespace),
//      por ejemplo "nexus_kv".
//   2) En el proyecto de Pages: Settings > Functions > KV namespace
//      bindings > agregá el binding con el nombre NEXUS_KV apuntando a
//      ese namespace.
//
// Modelo de datos:
//   - "shared=1" → dato visible para todos (lo que hoy ve el panel de
//     desarrollador: el registro de cada participante). Se guarda tal
//     cual bajo su key.
//   - "shared=0" (o ausente) → dato personal del visitante. Se guarda
//     con el prefijo del visitante (header x-visitor-id que manda el
//     navegador) para que un visitante no pueda leer el perfil de otro.
//
// Nota de seguridad: esto NO es una autenticación real de usuarios (no
// hay login), es el mismo nivel de aislamiento "por navegador" que ya
// tenía la app con localStorage. Si en el futuro necesitás cuentas de
// verdad, esto habría que reemplazarlo por un sistema de sesiones.

function personalKey(visitorId, key) {
  return "personal:" + (visitorId || "anon") + ":" + key;
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.NEXUS_KV) {
    return jsonResponse({ error: "NEXUS_KV no está configurado en el servidor" }, 500);
  }
  const url = new URL(request.url);
  const shared = url.searchParams.get("shared") === "1";
  const visitorId = request.headers.get("x-visitor-id") || "anon";
  const isList = url.searchParams.get("list") === "1";

  if (isList) {
    const prefix = url.searchParams.get("prefix") || "";
    const fullPrefix = shared ? prefix : personalKey(visitorId, prefix);
    const listing = await env.NEXUS_KV.list({ prefix: fullPrefix });
    const keys = listing.keys.map((k) =>
      shared ? k.name : k.name.slice(personalKey(visitorId, "").length)
    );
    return jsonResponse({ keys, prefix, shared });
  }

  const key = url.searchParams.get("key");
  if (!key) return jsonResponse({ error: "Falta key" }, 400);
  const fullKey = shared ? key : personalKey(visitorId, key);
  const value = await env.NEXUS_KV.get(fullKey);
  if (value === null) return jsonResponse(null, 404);
  return jsonResponse({ key, value, shared });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.NEXUS_KV) {
    return jsonResponse({ error: "NEXUS_KV no está configurado en el servidor" }, 500);
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Cuerpo inválido" }, 400);
  }
  const { key, value, shared } = body || {};
  if (!key || typeof value !== "string") {
    return jsonResponse({ error: "Faltan key/value" }, 400);
  }
  const visitorId = request.headers.get("x-visitor-id") || "anon";
  const fullKey = shared ? key : personalKey(visitorId, key);
  await env.NEXUS_KV.put(fullKey, value);
  return jsonResponse({ key, value, shared: !!shared });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!env.NEXUS_KV) {
    return jsonResponse({ error: "NEXUS_KV no está configurado en el servidor" }, 500);
  }
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const shared = url.searchParams.get("shared") === "1";
  if (!key) return jsonResponse({ error: "Falta key" }, 400);
  const visitorId = request.headers.get("x-visitor-id") || "anon";
  const fullKey = shared ? key : personalKey(visitorId, key);
  await env.NEXUS_KV.delete(fullKey);
  return jsonResponse({ key, deleted: true, shared });
}
