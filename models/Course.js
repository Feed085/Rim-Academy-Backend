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
    required: true,
    trim: true,
    maxlength: [500, 'Rəy mətni maksimum 500 simvol ola bilər']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const VideoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Video başlığı məcburidir']
  },
  videoUrl: {
    type: String,
    required: [true, 'Video URL məcburidir']
  },
  duration: {
    type: String, // e.g. "10:25"
    default: '0:00'
  }
});

const ModuleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Modul başlığı məcburidir']
  },
  videos: [VideoSchema]
});

const CourseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Kurs başlığı məcburidir'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Kateqoriya məcburidir']
  },
  instructor: {
    type: mongoose.Schema.ObjectId,
    ref: 'Teacher',
    required: true
  },
  image: {
    type: String,
    required: [true, 'Kover şəkli məcburidir']
  },
  description: {
    type: String,
    required: [true, 'Kurs açıqlaması məcburidir']
  },
  price: {
    type: Number,
    required: [true, 'Qiymət məlumatı məcburidir']
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
  learningPoints: {
    type: [String],
    default: []
  },
  includes: {
    type: [String],
    default: []
  },
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
