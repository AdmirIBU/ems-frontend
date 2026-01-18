import http from 'node:http';
import { URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const port = Number(process.env.PORT ?? 80);
const proxyTarget = process.env.API_PROXY_TARGET ?? 'http://backend:5000';
const distDir = path.join(process.cwd(), 'dist');

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.ico':
      return 'image/x-icon';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}

function sendFile(res, filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType(filePath));
    res.setHeader('Content-Length', stat.size);
    fs.createReadStream(filePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

function proxy(req, res) {
  const target = new URL(proxyTarget);

  const headers = { ...req.headers };
  headers.host = target.host;

  const options = {
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || (target.protocol === 'https:' ? 443 : 80),
    method: req.method,
    path: req.url,
    headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', () => {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify({ error: 'Bad gateway' }));
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    return res.end('Bad Request');
  }

  if (req.url.startsWith('/api') || req.url.startsWith('/uploads')) {
    return proxy(req, res);
  }

  const urlPath = req.url.split('?')[0] || '/';
  const safePath = path.posix.normalize(urlPath).replace(/^\.\.(\/|\\)/, '');

  // Static file if present
  const filePath = path.join(distDir, safePath);
  if (safePath !== '/' && sendFile(res, filePath)) return;

  // SPA fallback
  const indexPath = path.join(distDir, 'index.html');
  if (!sendFile(res, indexPath)) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Missing dist/index.html');
  }
});

server.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`Frontend server listening on :${port} (proxy -> ${proxyTarget})`);
});
