const mongoose = require('mongoose');

const ContactCourseOptionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Seçim başlığı məcburidir'],
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('ContactCourseOption', ContactCourseOptionSchema);