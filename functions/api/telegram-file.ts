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
    // Security restriction: allow telegram.org or sticker assets
    const isAllowed =
      parsedTarget.hostname.endsWith("telegram.org") ||
      parsedTarget.hostname.endsWith("r2.dev") ||
      parsedTarget.hostname.endsWith("cloudflarestorage.com") ||
      parsedTarget.pathname.endsWith(".json") ||
      parsedTarget.pathname.endsWith(".tgs") ||
      parsedTarget.pathname.endsWith(".webm");

    if (!isAllowed) {
      return new Response("Forbidden target host: only telegram.org and sticker assets allowed", {
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

    const isTgs = parsedTarget.pathname.endsWith(".tgs");
    let responseBody = tgResp.body;
    let contentType = tgResp.headers.get("content-type") || "application/octet-stream";

    if (isTgs && responseBody && typeof DecompressionStream !== "undefined") {
      try {
        responseBody = responseBody.pipeThrough(new DecompressionStream("gzip"));
        contentType = "application/json";
      } catch (e) {
        console.warn("Edge decompress failed", e);
      }
    } else {
      const contentLength = tgResp.headers.get("content-length");
      if (contentLength) headers.set("Content-Length", contentLength);
    }

    headers.set("Content-Type", contentType);

    return new Response(responseBody, {
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
