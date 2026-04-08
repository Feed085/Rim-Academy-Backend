const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const StudentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Ad alanı zorunludur']
  },
  surname: {
    type: String,
    required: [true, 'Soyad alanı zorunludur']
  },
  email: {
    type: String,
    required: [true, 'E-posta alanı zorunludur'],
    unique: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Geçerli bir e-posta adresi giriniz'
    ]
  },
  password: {
    type: String,
    required: [true, 'Şifre alanı zorunludur'],
    minlength: 6,
    select: false // Varsayılan olarak sorgularda şifreyi getirme
  },
  phoneNumber: {
    type: String,
    required: [true, 'Telefon numarası alanı zorunludur']
  },
  avatar: {
    type: String,
    default: ''
  },
  educationLevel: {
    type: String, // 'Orta', 'Bakalavr', 'Magistr' vs.
    default: ''
  },
  activeCourses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  assignedTests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test'
  }],
  completedTests: {
    type: Array,
    default: []
  },
  testResults: {
    type: Array,
    default: []
  },
  certificates: {
    type: Array,
    default: []
  }
}, { timestamps: true });

// Şifreyi kaydetmeden önce hash'le
StudentSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Şifre kontrol metodu
StudentSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Student', StudentSchema);
