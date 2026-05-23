const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 4173);
const rootDir = __dirname;
const idsDir = path.join(rootDir, 'IDS');
const imageExtensions = new Set(['.avif', '.bmp', '.gif', '.jpeg', '.jpg', '.png', '.webp']);

const mimeTypes = {
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp'
};

function resolvePath(urlPath) {
  const normalizedPath = decodeURIComponent(urlPath.split('?')[0]);
  const requestedPath = normalizedPath === '/' ? '/index.html' : normalizedPath;
  const absolutePath = path.join(rootDir, requestedPath);
  const relativePath = path.relative(rootDir, absolutePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  return absolutePath;
}

const server = http.createServer((request, response) => {
  const requestUrl = request.url || '/';

  if (requestUrl.split('?')[0] === '/api/ids') {
    fs.readdir(idsDir, { withFileTypes: true }, (readError, entries = []) => {
      if (readError) {
        response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ documents: [] }));
        return;
      }

      const documents = entries
        .filter((entry) => entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase()))
        .map((entry) => ({
          name: entry.name,
          url: `/IDS/${encodeURIComponent(entry.name)}`
        }))
        .sort((left, right) => left.name.localeCompare(right.name));

      response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ documents }));
    });
    return;
  }

  const absolutePath = resolvePath(requestUrl);

  if (!absolutePath) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  fs.stat(absolutePath, (statError, stats) => {
    if (statError) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not Found');
      return;
    }

    const filePath = stats.isDirectory() ? path.join(absolutePath, 'index.html') : absolutePath;
    const extension = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[extension] || 'application/octet-stream';

    fs.readFile(filePath, (readError, content) => {
      if (readError) {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Internal Server Error');
        return;
      }

      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': contentType
      });
      response.end(content);
    });
  });
});

server.listen(port, () => {
  console.log(`Identity verification app running at http://localhost:${port}`);
});