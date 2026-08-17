// Cloudflare Pages Function — POST /api/legal-check
// Reemplaza la llamada directa del navegador a api.anthropic.com, que
// SOLO funciona dentro de la vista previa de artifacts de Claude.ai.
// Acá la API key vive del lado del servidor, nunca en el HTML/JS.
//
// Configuración necesaria en Cloudflare Pages:
//   ANTHROPIC_API_KEY = "sk-ant-..."   (Settings > Environment variables > Secret)
//   Conseguí la key en https://console.anthropic.com

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse(
      { error: "ANTHROPIC_API_KEY no está configurada en el servidor" },
      500
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Cuerpo inválido" }, 400);
  }

  const topic = (body && body.topic ? String(body.topic) : "").slice(0, 300);
  const category = (body && body.category ? String(body.category) : "derecho").slice(0, 120);

  if (!topic) {
    return jsonResponse({ error: "Falta el tema a verificar" }, 400);
  }

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
        "x-api-key": env.ANTHROPIC_API_KEY,
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

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json" },
  });
}
