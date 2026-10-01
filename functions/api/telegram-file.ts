export async function onRequest(context: any): Promise<Response> {
  const request = context.request;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const url = new URL(request.url);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return new Response("Missing target url parameter", {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const parsedTarget = new URL(targetUrl);
    // Security restriction: allow only api.telegram.org requests
    if (parsedTarget.hostname !== "api.telegram.org") {
      return new Response("Forbidden target host: only api.telegram.org allowed", {
        status: 403,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    const tgResp = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "AlaText/1.0",
      },
    });

    const headers = new Headers();
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "*");

    const contentType = tgResp.headers.get("content-type");
    if (contentType) headers.set("Content-Type", contentType);

    const contentLength = tgResp.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);

    return new Response(tgResp.body, {
      status: tgResp.status,
      headers,
    });
  } catch (err: any) {
    return new Response(`Proxy error: ${err.message || String(err)}`, {
      status: 502,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
}
