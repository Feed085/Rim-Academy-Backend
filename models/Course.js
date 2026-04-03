const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'Student',
    required: true
  },
  name: String,
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const VideoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Video başlığı zorunludur']
  },
  videoUrl: {
    type: String,
    required: [true, 'Video URL zorunludur']
  },
  duration: {
    type: String, // e.g. "10:25"
    default: '0:00'
  }
});

const ModuleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Modül başlığı zorunludur']
  },
  videos: [VideoSchema]
});

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
    type: mongoose.Schema.ObjectId,
    ref: 'Teacher',
    required: true
  },
  image: {
    type: String,
    default: 'default-course.jpg' // R2 Image URL
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
  hasCertificate: {
    type: Boolean,
    default: false
  },
  rating: {
    type: Number,
    default: 0
  },
  reviews: [ReviewSchema],
  tests: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Test'
  }],
  modules: [ModuleSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  publishDate: {
    type: Date,
    default: () => Date.now() + 24 * 60 * 60 * 1000 // Creates cool-down of 1 day by default
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Course', CourseSchema);
