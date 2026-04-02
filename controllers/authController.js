const Student = require('../models/Student');
const jwt = require('jsonwebtoken');

// Token oluşturma yardımcı fonksiyonu
const sendTokenResponse = (student, statusCode, res) => {
  const payload = { id: student._id };
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '30d' // 30 gün geçerli
  });

  res.status(statusCode).json({
    success: true,
    token,
    student: {
      id: student._id,
      name: student.name,
      surname: student.surname,
      email: student.email,
      phoneNumber: student.phoneNumber
    }
  });
};

// @desc    Öğrenci Kayıt (Register)
// @route   POST /api/student/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, surname, email, password, phoneNumber } = req.body;

    // E-posta kullanımda mı kontrol et
    const existingStudent = await Student.findOne({ email });
    if (existingStudent) {
      return res.status(400).json({ success: false, message: 'Bu e-posta adresi zaten kullanımda' });
    }

    // Öğrenciyi oluştur
    const student = await Student.create({
      name,
      surname,
      email,
      password,
      phoneNumber
    });

    sendTokenResponse(student, 201, res);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Öğrenci Giriş (Login)
// @route   POST /api/student/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Email ve şifre girilmiş mi kontrol et
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Lütfen e-posta ve şifrenizi giriniz' });
    }

    // Öğrenciyi bul (şifre alanı dahil edilecek çünkü modelde select: false ayarlandı)
    const student = await Student.findOne({ email }).select('+password');

    if (!student) {
      return res.status(401).json({ success: false, message: 'Geçersiz e-posta veya şifre' });
    }

    // Şifre eşleşiyor mu kontrol et
    const isMatch = await student.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Geçersiz e-posta veya şifre' });
    }

    sendTokenResponse(student, 200, res);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Sunucu hatası', error: error.message });
  }
};
