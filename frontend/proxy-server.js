const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const BACKEND_HOST = 'localhost';
const BACKEND_PORT = 8000;
const BUILD_DIR = path.join(__dirname, 'build');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

function proxyToBackend(req, res) {
  const options = {
    hostname: BACKEND_HOST,
    port: BACKEND_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `${BACKEND_HOST}:${BACKEND_PORT}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[proxy] Backend unavailable: ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ detail: '后端服务未启动，请先在 backend/ 目录运行 python main.py' }));
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);

  // API 请求 → 代理到后端
  if (req.url.startsWith('/api/')) {
    proxyToBackend(req, res);
    return;
  }

  // 静态文件
  let urlPath = req.url.split('?')[0]; // 去掉 query string
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(BUILD_DIR, urlPath);

  // 先尝试直接读取文件
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      // 文件不存在 → SPA fallback: 返回 index.html
      serveStaticFile(res, path.join(BUILD_DIR, 'index.html'));
    } else {
      serveStaticFile(res, filePath);
    }
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ═══════════════════════════════════════════');
  console.log('   🎭 ScriptPlatform 本地测试服务器');
  console.log('  ═══════════════════════════════════════════');
  console.log('');
  console.log(`  前端静态文件: http://localhost:${PORT}`);
  console.log(`  API 代理到:   http://${BACKEND_HOST}:${BACKEND_PORT}`);
  console.log('');
  console.log('  使用前请确保后端已启动：');
  console.log('    cd backend && python main.py');
  console.log('');
});
