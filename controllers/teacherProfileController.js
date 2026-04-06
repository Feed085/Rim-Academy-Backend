const Teacher = require('../models/Teacher');
const Course = require('../models/Course');
const Test = require('../models/Test');

// @desc    Giriş yapan öğretmenin bilgilerini getir
// @route   GET /api/teacher/me
// @access  Private (Teacher)
exports.getMe = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id).populate('courses');

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Öğretmen bulunamadı' });
    }

    // 1. Dinamik Test sayı
    const testCount = await Test.countDocuments({ instructor: req.user.id });
    
    // 2. Dinamik Tələbə sayı
    const myCourses = await Course.find({ instructor: req.user.id });
    const myCourseIds = myCourses.map(c => c._id);
    const Student = require('../models/Student');
    const studentCount = await Student.countDocuments({ activeCourses: { $in: myCourseIds } });
    
    // 3. Dinamik Video sayı
    let videoCount = 0;
    myCourses.forEach(course => {
      if(course.modules) {
        course.modules.forEach(module => {
           if(module.videos) videoCount += module.videos.length;
        });
      }
    });

    res.status(200).json({
      success: true,
      data: teacher,
      stats: {
        studentCount: studentCount,
        courseCount: teacher.courses ? teacher.courses.length : 0,
        testCount: testCount,
        videoCount: videoCount,
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

// @desc    Müəllimin öz kurslarına qeydiyyatdan keçmiş tələbələrin siyahısını gətir
// @route   GET /api/teacher/students
// @access  Private (Teacher)
exports.getTeacherStudents = async (req, res) => {
  try {
    // 1. Müəllimin idarə etdiyi kursları tap
    const myCourses = await Course.find({ instructor: req.user.id });
    const myCourseIds = myCourses.map(course => course._id.toString());
    
    // 2. Tələbələri tap ki, onların activeCourses listində yuxarıdakı ID-lərdən biri olsun
    // Hazırda backend-də enrollment sistemi yoxdur, amma activeCourses Array olaraq saxlanılır.
    const Student = require('../models/Student');
    const students = await Student.find({ activeCourses: { $in: myCourseIds } });

    // 3. Frontend-in gözlədiyi sadə JSON formatına çevir
    const formattedStudents = [];
    
    students.forEach(student => {
       student.activeCourses.forEach(courseIdObj => {
          const courseIdStr = courseIdObj.toString();
          if(myCourseIds.includes(courseIdStr)) {
             const matchedCourse = myCourses.find(c => c._id.toString() === courseIdStr);
             formattedStudents.push({
               id: student._id + '-' + courseIdStr, // Unique for list key
               name: student.name + ' ' + student.surname,
               email: student.email,
               phone: student.phoneNumber,
               course: matchedCourse ? matchedCourse.title : 'Naməlum Kurs',
               date: new Date(student.createdAt).toLocaleDateString('az-AZ')
             });
          }
       });
    });

    res.status(200).json({
      success: true,
      data: formattedStudents
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Hatası', error: error.message });
  }
};
