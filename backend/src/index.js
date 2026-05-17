require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
});
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve uploaded character images
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
app.use('/api/pemain', require('./routes/pemain'));
app.use('/api/karakter', require('./routes/karakter'));
app.use('/api/atribut', require('./routes/atribut'));
app.use('/api/session', require('./routes/session'));

// Music room WebSocket handler
const initMusicRoom = require('./routes/musicRoom');
initMusicRoom(io);

// Map room WebSocket handler
const initMapRoom = require('./routes/mapRoom');
initMapRoom(io);

// Serve React frontend (production build)
const distPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Lorewarden berjalan di http://localhost:${PORT}`);
});
