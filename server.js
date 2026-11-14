const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const firstApodDate = "1995-06-16";
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};
const publicFiles = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/app.js", "app.js"],
  ["/styles.css", "styles.css"],
]);

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(data));
}

function isValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function getMetaContent(html, property) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const tag = tags.find((item) => {
    const match = item.match(/\bproperty\s*=\s*(["'])(.*?)\1/i);
    return match && match[2] === property;
  });
  const content = tag?.match(/\bcontent\s*=\s*(["'])(.*?)\1/i)?.[2];
  return content?.replaceAll("&amp;", "&") || null;
}

function getApodVideoUrl(html) {
  const allowedHosts = new Set([
    "youtube.com",
    "www.youtube.com",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
    "player.vimeo.com",
  ]);
  const iframes = html.match(/<iframe\b[^>]*>/gi) || [];

  for (const iframe of iframes) {
    const source = iframe.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (!source) continue;

    try {
      const videoUrl = new URL(source.replaceAll("&amp;", "&"));
      if (videoUrl.protocol === "https:" && allowedHosts.has(videoUrl.hostname)) {
        return videoUrl.href;
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function getApodPageMedia(date) {
  const pageUrl = new URL("https://science.nasa.gov/apod/");
  pageUrl.searchParams.set("date", date);
  const response = await fetch(pageUrl, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("NASA APOD page request failed");

  const html = await response.text();
  const imageUrl = getMetaContent(html, "og:image");
  const ogTitle = getMetaContent(html, "og:title");
  if (!imageUrl || !ogTitle) throw new Error("NASA APOD page metadata is missing");

  const parsedImageUrl = new URL(imageUrl);
  if (parsedImageUrl.protocol !== "https:" || !parsedImageUrl.hostname.endsWith(".nasa.gov")) {
    throw new Error("NASA APOD page returned an invalid image URL");
  }

  const title = ogTitle
    .replace(/^APOD:\s*\d{4}\s+\w+\s+\d{1,2}\s+[\u2013\u2014-]\s*/i, "")
    .replace(/\s+-\s+NASA Science$/i, "")
    .trim();
  if (!title) throw new Error("NASA APOD page title is invalid");

  return {
    title,
    imageUrl: parsedImageUrl.href,
    videoUrl: getApodVideoUrl(html),
  };
}

async function handleApod(response, requestUrl) {
  const date = requestUrl.searchParams.get("date");
  if (!isValidDate(date) || date < firstApodDate || date > new Date().toISOString().slice(0, 10)) {
    sendJson(response, 400, { error: "Escolha uma data válida entre 16 de junho de 1995 e hoje." });
    return;
  }

  const apiKey = process.env.NASA_API_KEY?.trim();
  if (!apiKey) {
    sendJson(response, 503, { error: "A chave da NASA não está configurada no servidor." });
    return;
  }

  const nasaUrl = new URL("https://api.nasa.gov/planetary/apod");
  nasaUrl.searchParams.set("api_key", apiKey);
  nasaUrl.searchParams.set("date", date);

  try {
    const nasaResponse = await fetch(nasaUrl, { signal: AbortSignal.timeout(15000) });
    let data;
    try {
      data = await nasaResponse.json();
    } catch {
      sendJson(response, 502, { error: "A NASA retornou uma resposta inválida." });
      return;
    }

    if (!nasaResponse.ok) {
      const error = nasaResponse.status === 429
        ? "Limite de consultas da API da NASA atingido."
        : nasaResponse.status === 401 || nasaResponse.status === 403
          ? "A chave configurada no servidor não foi aceita pela NASA."
          : `A NASA respondeu com o erro HTTP ${nasaResponse.status}.`;
      sendJson(response, nasaResponse.status, { error });
      return;
    }

    const hasPlaceholderImage = typeof data.url === "string"
      && (data.url.includes("/nasa-logo@2x.png") || data.url.includes("/news-thumbnail.png"));
    if (data.title === "NASA Science" || hasPlaceholderImage) {
      let pageMedia;
      try {
        pageMedia = await getApodPageMedia(date);
      } catch {
        sendJson(response, 502, { error: "A NASA não forneceu uma mídia válida para esta edição." });
        return;
      }
      data.title = pageMedia.title;
      if (pageMedia.videoUrl) {
        data.media_type = "video";
        data.url = pageMedia.videoUrl;
        delete data.hdurl;
      } else {
        data.media_type = "image";
        data.url = pageMedia.imageUrl;
        data.hdurl = pageMedia.imageUrl;
      }
    }

    if (
      !data
      || typeof data !== "object"
      || Array.isArray(data)
      || (data.media_type !== "image" && data.media_type !== "video")
      || typeof data.url !== "string"
    ) {
      sendJson(response, 502, { error: "A NASA retornou dados de APOD inválidos." });
      return;
    }

    const apod = {
      date: typeof data.date === "string" ? data.date : date,
      title: typeof data.title === "string" ? data.title : "",
      explanation: typeof data.explanation === "string" ? data.explanation : "",
      media_type: data.media_type,
      url: data.url,
    };
    if (typeof data.hdurl === "string") apod.hdurl = data.hdurl;
    if (typeof data.copyright === "string") apod.copyright = data.copyright;
    sendJson(response, 200, apod);
  } catch (error) {
    const timedOut = error.name === "TimeoutError";
    sendJson(response, timedOut ? 504 : 502, {
      error: timedOut ? "A consulta à NASA excedeu o tempo limite." : "Não foi possível conectar à API da NASA.",
    });
  }
}

http.createServer((request, response) => {
  let requestUrl;
  try {
    requestUrl = new URL(request.url, "http://localhost");
  } catch {
    sendJson(response, 400, { error: "Endereço de requisição inválido." });
    return;
  }

  if (requestUrl.pathname === "/api/apod") {
    if (request.method !== "GET") {
      response.writeHead(405, { Allow: "GET" });
      response.end("Method not allowed");
      return;
    }
    handleApod(response, requestUrl);
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method not allowed");
    return;
  }

  const fileName = publicFiles.get(requestUrl.pathname);
  if (!fileName) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const filePath = path.join(root, fileName);
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(fileName)] || "application/octet-stream",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  });
}).listen(8000, "127.0.0.1", () => {
  console.log("Diário do Cosmos disponível em http://localhost:8000");
});
