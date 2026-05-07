require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve uploaded character images
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
app.use('/api/pemain',   require('./routes/pemain'));
app.use('/api/karakter', require('./routes/karakter'));
app.use('/api/atribut',  require('./routes/atribut'));
app.use('/api/session',  require('./routes/session'));

// Serve frontend
app.use(express.static(path.join(__dirname, '../../frontend')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Lorewarden berjalan di http://localhost:${PORT}`);
});
