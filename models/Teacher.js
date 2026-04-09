const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const TeacherSchema = new mongoose.Schema({
  avatar: {
    type: String,
    default: 'https://ui-avatars.com/api/?name=Teacher&background=random'
  },
  name: {
    type: String,
    required: [true, 'Ad zorunludur']
  },
  surname: {
    type: String,
    required: [true, 'Soyad zorunludur']
  },
  email: {
    type: String,
    required: [true, 'Email zorunludur'],
    unique: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Geçerli bir email adresi giriniz'
    ]
  },
  password: {
    type: String,
    required: [true, 'Şifre zorunludur'],
    minlength: 6,
    select: false
  },
  phoneNumber: {
    type: String,
    default: ''
  },
  categories: {
    type: [String],
    default: []
  },
  courses: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Course'
  }],
  rating: {
    type: Number,
    default: 0
  },
  education: {
    type: String,
    default: ''
  },
  experience: {
    type: Number,
    default: 0
  },
  specializedAreas: {
    type: [String],
    default: []
  },
  socialNetworks: {
    type: Map,
    of: String, // Örn: { "linkedin": "Url", "instagram": "url" }
    default: {}
  },
  location: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    default: 'teacher'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Kaydetmeden önce şifreyi şifrele
TeacherSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Öğretmen için JWT oluştur JWT Secret
TeacherSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: '30d' // 30 gün geçerli
  });
};

// Girilen şifrenin veritabanındaki hash ile eşleşip eşleşmediğini kontrol et
TeacherSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Teacher', TeacherSchema);
