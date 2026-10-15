const http = require('node:http');
const { WebSocket, WebSocketServer } = require('ws');

function createRelayServer() {
  const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS ||
    'https://level-29-jester-rush-2.vercel.app,https://sea-turtle-app-zfvyk.ondigitalocean.app')
    .split(',').map(value => value.trim()).filter(Boolean));

  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'GET' && ['/', '/health', '/api/health'].includes(pathname)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        service: 'jester-backend',
        mode: 'relay-only',
        accounts: false,
        clans: false,
        persistence: false
      }));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not implemented.' }));
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  server.on('upgrade', (req, socket, head) => {
    if (!allowedOrigins.has(req.headers.origin)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    if (wss.clients.size >= 100) {
      socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
      return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });

  wss.on('connection', ws => {
    ws.isAlive = true;
    let windowStart = Date.now();
    let messages = 0;
    ws.on('error', () => ws.terminate());
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (data, isBinary) => {
      if (Date.now() - windowStart >= 1000) {
        windowStart = Date.now();
        messages = 0;
      }
      if (++messages > 60) { ws.close(1008, 'Message rate exceeded.'); return; }
      if (isBinary) { ws.close(1003, 'Send text JSON messages.'); return; }
      const text = data.toString();
      try { JSON.parse(text); }
      catch { ws.close(1007, 'Invalid JSON.'); return; }
      for (const client of wss.clients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          if (client.bufferedAmount > 256 * 1024) {
            client.close(1008, 'Client is not consuming messages.');
            continue;
          }
          client.send(text, { binary: false }, error => {
            if (error) client.terminate();
          });
        }
      }
    });
  });

  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      if (!client.isAlive) { client.terminate(); continue; }
      client.isAlive = false;
      client.ping();
    }
  }, 30000);
  heartbeat.unref();
  server.on('close', () => {
    clearInterval(heartbeat);
    for (const client of wss.clients) client.terminate();
    wss.close();
  });
  return { server, wss };
}

if (require.main === module) {
  const { server } = createRelayServer();
  server.listen(Number(process.env.PORT) || 8080, '0.0.0.0', () => {
    console.log(`Jester relay listening on 0.0.0.0:${server.address().port}`);
  });
}

module.exports = { createRelayServer };
