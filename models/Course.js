const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Kurs başlığı zorunludur'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Kategori zorunludur']
  },
  instructor: {
    type: String, // Şimdilik isim, ileride Teacher Ref eklenebilir
    required: [true, 'Eğitmen adı zorunludur']
  },
  image: {
    type: String,
    default: 'default-course.jpg' // İleride resim URL'si kullanılacak
  },
  description: {
    type: String,
    required: [true, 'Kurs açıklaması zorunludur']
  },
  price: {
    type: Number,
    required: [true, 'Fiyat bilgisi zorunludur'],
    default: 0 // 0 ise ücretsiz
  },
  students: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Student'
  }],
  tests: [{
    // Bu kursa ait olan testlerin ID'leri
    type: mongoose.Schema.ObjectId,
    ref: 'Test'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Course', CourseSchema);
