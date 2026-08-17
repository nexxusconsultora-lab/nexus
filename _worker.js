// Worker único para el sitio Nexus (modo "Advanced" de Cloudflare Pages).
//
// Por qué existe este archivo: la carpeta /functions no se estaba
// compilando como Pages Function en este proyecto (las rutas devolvían
// 405 Method Not Allowed, señal de que Cloudflare las trataba como
// archivos estáticos comunes, no como funciones). Este archivo único
// reemplaza a esa carpeta: cuando existe un _worker.js en la raíz,
// Cloudflare SIEMPRE lo usa como el Worker completo del sitio, sin
// depender de ninguna detección automática de carpetas.
//
// Rutea manualmente /api/dev-auth, /api/storage y /api/legal-check, y
// deja pasar cualquier otra request al servidor de archivos estáticos
// (env.ASSETS), que es quien sirve index.html y el resto del sitio.

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json" },
  });
}

function personalKey(visitorId, key) {
  return "personal:" + (visitorId || "anon") + ":" + key;
}

// Lee una variable que puede llegar como texto plano o como "Secrets
// Store binding" (objeto con método .get() async) — Cloudflare tiene
// las dos formas activas según cómo se haya configurado desde el panel.
async function readSecret(value) {
  if (value && typeof value.get === "function") {
    return await value.get();
  }
  return value || "";
}

async function handleDevAuth(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ ok: false, error: "Cuerpo inválido" }, 400);
  }
  const code = (body && body.code ? String(body.code) : "").trim();
  const expected = (await readSecret(env.DEV_SECRET_CODE)).trim();

  if (!expected) {
    return jsonResponse(
      { ok: false, error: "DEV_SECRET_CODE no está configurado en el servidor" },
      500
    );
  }
  const ok = code.length > 0 && code === expected;
  return jsonResponse({ ok }, ok ? 200 : 401);
}

async function handleStorageGet(request, env) {
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

async function handleStoragePost(request, env) {
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

async function handleStorageDelete(request, env) {
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

async function handleLegalCheck(request, env) {
  const apiKey = await readSecret(env.ANTHROPIC_API_KEY);
  if (!apiKey) {
    return jsonResponse({ error: "ANTHROPIC_API_KEY no está configurada en el servidor" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Cuerpo inválido" }, 400);
  }

  const topic = (body && body.topic ? String(body.topic) : "").slice(0, 300);
  const category = (body && body.category ? String(body.category) : "derecho").slice(0, 120);
  if (!topic) return jsonResponse({ error: "Falta el tema a verificar" }, 400);

  const system =
    'Sos un asistente que verifica la vigencia normativa/regulatoria ACTUAL de temas ' +
    'jurídicos y de inversión, con foco en Argentina cuando corresponda y en normativa ' +
    'internacional cuando sea relevante. Usá la herramienta de búsqueda web para confirmar ' +
    'el estado vigente antes de responder. Respondé en español, en un máximo de 160 ' +
    'palabras, en prosa clara (sin markdown), mencionando: 1) el estado normativo actual, ' +
    '2) cambios recientes o proyectos en trámite si los hay, 3) la fuente y su fecha ' +
    'aproximada. Cerrá siempre aclarando que es información general y no asesoramiento ' +
    'legal formal.';
  const userMsg =
    'Tema: "' + topic + '". Disciplina: ' + category +
    '. Dame un panorama preciso y actualizado a hoy de su estado normativo o regulatorio vigente.';

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: system,
        messages: [{ role: "user", content: userMsg }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return jsonResponse({ error: "Error de la API de Anthropic: " + errText }, 502);
    }

    const data = await response.json();
    const text = (data.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return jsonResponse({ text });
  } catch (e) {
    return jsonResponse({ error: "No se pudo contactar a la API de Anthropic" }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (path === "/api/dev-auth" && method === "POST") {
        return await handleDevAuth(request, env);
      }
      if (path === "/api/storage" && method === "GET") {
        return await handleStorageGet(request, env);
      }
      if (path === "/api/storage" && method === "POST") {
        return await handleStoragePost(request, env);
      }
      if (path === "/api/storage" && method === "DELETE") {
        return await handleStorageDelete(request, env);
      }
      if (path === "/api/legal-check" && method === "POST") {
        return await handleLegalCheck(request, env);
      }
    } catch (e) {
      return jsonResponse({ error: "Error interno: " + (e && e.message ? e.message : String(e)) }, 500);
    }

    // Cualquier otra ruta: servir archivos estáticos (index.html, etc.)
    return env.ASSETS.fetch(request);
  },
};
