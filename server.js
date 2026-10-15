const express = require('express');
const { Server } = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new Server({ server });

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    // Broadcast player movement to all other connected clients
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Multiplayer server running');
});