const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');

app.use('/api/student/auth', authRoutes);
app.use('/api/student', studentRoutes);

// Test Route
app.get('/', (req, res) => {
  res.send('Rim-Academy Backend API Kurulumu Tamamlandı');
});

// Database Connection
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB Bağlantısı Başarılı');
    app.listen(PORT, () => {
      console.log(`Sunucu ${PORT} portunda çalışıyor.`);
    });
  })
  .catch((err) => {
    console.error('MongoDB Bağlantı Hatası:', err);
  });
