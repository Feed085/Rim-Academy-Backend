const Teacher = require('../models/Teacher');
const Course = require('../models/Course'); // Öğrenci sayısını vs hesaplamak için kullanılabilir

// @desc    Giriş yapan öğretmenin bilgilerini getir
// @route   GET /api/teacher/me
// @access  Private (Teacher)
exports.getMe = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id).populate('courses');

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Öğretmen bulunamadı' });
    }

    // Toplam öğrenci sayısını hesaplama vs.. (kurslara kayıtlı öğrenciler üzerinden de olabilir)
    // Şimdilik düz mantık, ileride kurs modelinden students array count toplanabilir.
    
    res.status(200).json({
      success: true,
      data: teacher,
      // Frontend mockları için istatistikleri doğrudan birleştirebiliriz
      stats: {
        studentCount: 0, // İleride course students array'i üzerinden toplanacak
        courseCount: teacher.courses ? teacher.courses.length : 0,
        testCount: 0, // İleride eklenecek
        videoCount: 0, // İleride eklenecek
        rating: teacher.rating
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Hatası', error: error.message });
  }
};

// @desc    Giriş yapan öğretmenin profili güncelle
// @route   PUT /api/teacher/me
// @access  Private (Teacher)
exports.updateProfile = async (req, res) => {
  try {
    // Şifre güncellemeyi engelle, sadece profil bilgileri
    const updateFields = {
      name: req.body.name,
      surname: req.body.surname,
      phoneNumber: req.body.phone || req.body.phoneNumber,
      education: req.body.education,
      experience: req.body.experience,
      specializedAreas: req.body.specialties || req.body.specializedAreas,
      location: req.body.location,
      socialNetworks: req.body.socialLinks || req.body.socialNetworks,
      avatar: req.body.avatar
    };

    // undefined/null olmayan değerleri temizle
    Object.keys(updateFields).forEach(key => updateFields[key] === undefined && delete updateFields[key]);

    const teacher = await Teacher.findByIdAndUpdate(req.user.id, updateFields, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: teacher
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Hatası', error: error.message });
  }
};
