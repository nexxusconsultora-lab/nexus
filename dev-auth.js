// Cloudflare Pages Function — POST /api/dev-auth
// Verifica el código de acceso al "modo programador" del lado del servidor.
// El código real vive SOLO en la variable de entorno DEV_SECRET_CODE,
// configurada en el panel de Cloudflare Pages (Settings > Environment
// variables > Secret). Nunca aparece en el HTML/JS que llega al navegador.
//
// Configuración necesaria en Cloudflare Pages:
//   DEV_SECRET_CODE = "el código que quieras usar"
//
// Recomendación: cambiá este código de tanto en tanto, sobre todo si
// alguna vez sospechás que se filtró.

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ ok: false, error: "Cuerpo inválido" }, 400);
  }

  const code = (body && body.code ? String(body.code) : "").trim();
  const expected = (env.DEV_SECRET_CODE || "").trim();

  if (!expected) {
    return jsonResponse(
      { ok: false, error: "DEV_SECRET_CODE no está configurado en el servidor" },
      500
    );
  }

  // Pequeño freno anti fuerza-bruta: si en el futuro querés algo más
  // robusto, esto se puede reemplazar por un contador en KV por IP.
  const ok = code.length > 0 && code === expected;

  return jsonResponse({ ok }, ok ? 200 : 401);
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json" },
  });
}
