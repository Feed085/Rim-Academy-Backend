const Student = require('../models/Student');

// @desc    Giriş yapmış öğrencinin kendi profili ve istatistiklerini getir
// @route   GET /api/student/me
// @access  Private (Token Gerekli)
exports.getMe = async (req, res) => {
  try {
    // req.user auth middleware icinden gelir
    const student = await Student.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        id: student._id,
        name: student.name,
        surname: student.surname,
        email: student.email,
        phoneNumber: student.phoneNumber,
        completedTests: student.completedTests,
        certificates: student.certificates,
        stats: {
          activeCoursesCount: student.activeCourses.length,
          completedTestsCount: student.completedTests.length,
          certificatesCount: student.certificates.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Sunucu hatası', error: error.message });
  }
};
