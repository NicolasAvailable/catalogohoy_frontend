// Receptor de webhooks de TikTok Business Messaging — STUB (CAT-44 fase 1).
//
// La Business Messaging API de TikTok está en beta y el acceso de la app está
// en trámite: este endpoint existe para (1) poder registrar la URL del webhook
// durante la solicitud de acceso y (2) capturar los primeros eventos reales
// completos en los logs, para mapear el payload exacto antes de implementar el
// procesamiento (findOrCreateChat + persistencia, como wa-webhook/ig-webhook).
// NO procesa mensajes todavía. Endurecer con verificación de firma cuando la
// doc del portal esté disponible (requiere app aprobada).

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    // Eco de verificación: distintas plataformas mandan un challenge con
    // nombres distintos; devolvemos el que venga.
    const challenge =
      url.searchParams.get('challenge') ??
      url.searchParams.get('hub.challenge') ??
      url.searchParams.get('echostr');
    return new Response(challenge ?? 'ok', { status: 200 });
  }

  try {
    const body = await req.text();
    const headers = Object.fromEntries(
      [...req.headers.entries()].filter(
        ([k]) => k.startsWith('x-') || k === 'content-type'
      )
    );
    console.log('[tiktok-webhook] evento recibido', {
      headers,
      body: body.slice(0, 6000),
    });
  } catch (err) {
    console.error('[tiktok-webhook] error leyendo el body', err);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
