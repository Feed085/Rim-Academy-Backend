const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Kateqoriya adı məcburidir'],
    unique: true,
    trim: true
  },
  slug: {
    type: String,
    required: [true, 'Kateqoriya slug-u məcburidir'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  color: {
    type: String,
    default: '#00D084'
  },
  icon: {
    type: String,
    default: 'Tag'
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

module.exports = mongoose.model('Category', CategorySchema);