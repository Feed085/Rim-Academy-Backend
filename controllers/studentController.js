const Student = require('../models/Student');
const TestResult = require('../models/TestResult');

// @desc    Giriş yapmış öğrencinin kendi profili ve istatistiklerini getir
// @route   GET /api/student/me
// @access  Private (Token Gerekli)
exports.getMe = async (req, res) => {
  try {
    // req.user auth middleware icinden gelir
    const student = await Student.findById(req.user.id).populate('activeCourses');

    // Dinamik sınaq nəticələrinə baxaq
    const testResults = await TestResult.countDocuments({ student: student._id });
    const certificatesCount = await TestResult.countDocuments({ 
       student: student._id, 
       scorePercentage: { $gte: 50 },
       hasPendingAnswers: false 
    });

    res.status(200).json({
      success: true,
      data: {
        id: student._id,
        name: student.name,
        surname: student.surname,
        email: student.email,
        phoneNumber: student.phoneNumber,
        avatar: student.avatar,
        educationLevel: student.educationLevel,
        completedTests: [], // Artıq sınaqlar TestResult-dan gəlir
        certificates: [],
        activeCourses: student.activeCourses,
        stats: {
          activeCoursesCount: student.activeCourses ? student.activeCourses.length : 0,
          completedTestsCount: testResults,
          certificatesCount: certificatesCount
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Giriş etmiş tələbənin profilini yenilə
// @route   PUT /api/student/me
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { name, surname, phoneNumber, avatar, educationLevel } = req.body;
    
    // Yalnız bu sahələrin yenilənməsinə icazə veririk
    const updateData = {};
    if (name) updateData.name = name;
    if (surname) updateData.surname = surname;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (avatar) updateData.avatar = avatar;
    if (educationLevel !== undefined) updateData.educationLevel = educationLevel;

    const student = await Student.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profil uğurla yeniləndi',
      data: student
    });
  } catch (error) {
    console.error('Update Profile xətası:', error);
    res.status(500).json({ success: false, message: 'Server xətası', error: error.message });
  }
};
