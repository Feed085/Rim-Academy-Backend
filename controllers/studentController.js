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
