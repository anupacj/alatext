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
    return new Response(JSON.stringify({ ok: false, error: "Missing url parameter" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  try {
    const parsedTarget = new URL(targetUrl);
    if (!["http:", "https:"].includes(parsedTarget.protocol)) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid protocol" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Abort after 4 seconds to keep responses snappy
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const resp = await fetch(targetUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timeoutId);

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return new Response(
        JSON.stringify({
          ok: true,
          url: targetUrl,
          domain: parsedTarget.hostname.replace(/^www\./, ""),
          title: parsedTarget.hostname.replace(/^www\./, ""),
          description: null,
          image: null,
          siteName: parsedTarget.hostname.replace(/^www\./, ""),
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=86400",
          },
        }
      );
    }

    // Read only the first 256KB to keep it lightweight
    const text = await resp.text();
    const headChunk = text.slice(0, 262144);

    const getMeta = (prop: string): string | null => {
      // Matches <meta property="prop" content="value"> or <meta name="prop" content="value"> (and reversed attribute order)
      const r1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i");
      const m1 = headChunk.match(r1);
      if (m1?.[1]) return decodeHtmlEntities(m1[1].trim());

      const r2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, "i");
      const m2 = headChunk.match(r2);
      if (m2?.[1]) return decodeHtmlEntities(m2[1].trim());

      return null;
    };

    const decodeHtmlEntities = (str: string) => {
      return str
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x2F;/g, "/");
    };

    let title =
      getMeta("og:title") ||
      getMeta("twitter:title") ||
      (() => {
        const titleMatch = headChunk.match(/<title[^>]*>([^<]*)<\/title>/i);
        return titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1].trim()) : null;
      })();

    let description =
      getMeta("og:description") ||
      getMeta("twitter:description") ||
      getMeta("description");

    let image = getMeta("og:image") || getMeta("twitter:image");
    if (image) {
      try {
        image = new URL(image, targetUrl).href;
      } catch (e) {}
    }

    let siteName = getMeta("og:site_name") || parsedTarget.hostname.replace(/^www\./, "");
    const domain = parsedTarget.hostname.replace(/^www\./, "");

    return new Response(
      JSON.stringify({
        ok: true,
        url: targetUrl,
        domain,
        siteName,
        title: title || domain,
        description: description || null,
        image: image || null,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      }
    );
  } catch (err: any) {
    // If request failed or timed out, return minimal fallback
    try {
      const parsedTarget = new URL(targetUrl);
      const domain = parsedTarget.hostname.replace(/^www\./, "");
      return new Response(
        JSON.stringify({
          ok: true,
          url: targetUrl,
          domain,
          siteName: domain,
          title: domain,
          description: null,
          image: null,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600",
          },
        }
      );
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: err.message || "Failed to fetch link preview" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  }
}
