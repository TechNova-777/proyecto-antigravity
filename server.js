const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.woff2':'font/woff2',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  // /3d shortcut -> game3d.html
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/3d') urlPath = '/game3d.html';
  if (urlPath === '/')   urlPath = '/index.html';

  const filePath = path.join(__dirname, urlPath);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   ANTIGRAVITY LOCAL SERVER                   ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  🕹️  2D Arcade  → http://localhost:${PORT}/       ║`);
  console.log(`║  🌄  3D World   → http://localhost:${PORT}/3d     ║`);
  console.log('╚══════════════════════════════════════════════╝');
});
