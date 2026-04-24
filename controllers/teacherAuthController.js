const Teacher = require('../models/Teacher');
const jwt = require('jsonwebtoken');
const { verifyGoogleCredential } = require('../utils/googleAuth');

const parseExperience = (value) => {
  const experience = Number(value);
  return Number.isFinite(experience) ? experience : 0;
};

// Token gönder fonksiyonu
const sendTokenResponse = (teacher, statusCode, res) => {
  const token = teacher.getSignedJwtToken();

  res.status(statusCode).json({
    success: true,
    token, // Frontend bu tokeni localStorage'a kaydedecek
    teacher: {
      id: teacher._id,
      name: teacher.name,
      surname: teacher.surname,
      email: teacher.email,
      avatar: teacher.avatar || '',
      role: teacher.role,
      categories: teacher.categories,
      rating: teacher.rating,
      education: teacher.education,
      experience: parseExperience(teacher.experience),
      specializedAreas: teacher.specializedAreas,
      location: teacher.location
    }
  });
};

// @desc    Öğretmen Kaydet (Register)
// @route   POST /api/teacher/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, surname, email, password, phoneNumber, categories, education, experience, specializedAreas, location, socialNetworks } = req.body;

    // Email önceden kullanılmış mı kontrol et
    const existingTeacher = await Teacher.findOne({ email });
    if (existingTeacher) {
      return res.status(400).json({ success: false, message: 'Bu email ile kayıtlı bir öğretmen zaten var.' });
    }

    // Yeni Öğretmen oluştur
    const teacher = await Teacher.create({
      name,
      surname,
      email,
      password,
      initialPassword: password,
      phoneNumber,
      categories,
      education,
      experience: parseExperience(experience),
      specializedAreas,
      location,
      socialNetworks
    });

    sendTokenResponse(teacher, 201, res);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Öğretmen Google Girişi
// @route   POST /api/teacher/auth/google
// @access  Public
exports.googleLogin = async (req, res) => {
  try {
    const { credential } = req.body || {};

    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential tələb olunur' });
    }

    const payload = await verifyGoogleCredential(credential);
    const email = (payload?.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(401).json({ success: false, message: 'Google hesab email-i tapılmadı' });
    }

    if (!payload?.email_verified) {
      return res.status(401).json({ success: false, message: 'Google email təsdiqlənməyib' });
    }

    const teacher = await Teacher.findOne({ email });

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Bu e-poçt ilə qeydiyyatdan keçmiş müəllim tapılmadı. Əvvəlcə hesab yaradın.',
      });
    }

    sendTokenResponse(teacher, 200, res);
  } catch (error) {
    console.error('Teacher Google login failed:', error);
    const statusCode = error?.statusCode || 401;
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'Google girişi uğursuz oldu',
    });
  }
};

// @desc    Öğretmen Girişi (Login)
// @route   POST /api/teacher/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Email ve şifre girilmiş mi?
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Lütfen email ve şifre giriniz.' });
    }

    // Öğretmeni veritabanında ara
    const teacher = await Teacher.findOne({ email }).select('+password'); // Şifreyi de çek

    if (!teacher) {
      return res.status(401).json({ success: false, message: 'Geçersiz email veya şifre' });
    }

    // Şifreler eşleşiyor mu?
    const isMatch = await teacher.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Geçersiz email veya şifre' });
    }

    sendTokenResponse(teacher, 200, res);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Sunucu hatası', error: error.message });
  }
};
