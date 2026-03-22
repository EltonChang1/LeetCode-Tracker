#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4321);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

function resolvePath(urlPath) {
  if (urlPath === '/') return path.join(rootDir, 'web', 'index.html');
  const normalized = path.normalize(urlPath).replace(/^\/+/, '');
  return path.join(rootDir, normalized);
}

const server = http.createServer((req, res) => {
  const requestUrl = req.url.split('?')[0];
  const filePath = resolvePath(requestUrl);

  if (!filePath.startsWith(rootDir)) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        send(res, 404, 'Not found');
      } else {
        send(res, 500, 'Server error');
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, mimeTypes[ext] || 'application/octet-stream');
  });
});

server.listen(port, () => {
  console.log(`🎮 LeetCode Game Dashboard running at http://localhost:${port}`);
  console.log('Tip: Open /web/index.html if you want the explicit path.');
});
