const Teacher = require('../models/Teacher');
const Course = require('../models/Course');
const Test = require('../models/Test');
const Student = require('../models/Student');

const calculateReviewStats = (courses = []) => {
  const reviews = courses.reduce((allReviews, course) => {
    const courseReviews = Array.isArray(course.reviews) ? course.reviews : [];
    return [...allReviews, ...courseReviews];
  }, []);

  if (reviews.length === 0) {
    return { rating: 0, reviewCount: 0 };
  }

  const totalRating = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
  return {
    rating: Math.round((totalRating / reviews.length) * 10) / 10,
    reviewCount: reviews.length
  };
};

const parseExperience = (value) => {
  const experience = Number(value);
  return Number.isFinite(experience) ? experience : 0;
};

const toPlainSocialLinks = (socialNetworks) => {
  if (!socialNetworks) {
    return {};
  }

  if (typeof socialNetworks.toObject === 'function') {
    return socialNetworks.toObject();
  }

  if (typeof socialNetworks.entries === 'function') {
    return Object.fromEntries(socialNetworks.entries());
  }

  return socialNetworks;
};

const formatPublicTeacher = (teacher, stats = {}) => {
  const specialties = teacher.specializedAreas || [];
  const bio = teacher.bio || teacher.education || teacher.location || specialties.slice(0, 3).join(', ');
  const rating = stats.rating ?? teacher.rating ?? 0;

  return {
    id: teacher._id,
    name: teacher.name,
    surname: teacher.surname,
    avatar: teacher.avatar,
    categories: teacher.categories || [],
    rating,
    education: teacher.education || '',
    experience: parseExperience(teacher.experience),
    location: teacher.location || '',
    bio: bio || 'Müəllim profili yenilənir.',
    specialties,
    specializedAreas: specialties,
    socialLinks: toPlainSocialLinks(teacher.socialNetworks),
    studentCount: stats.studentCount ?? 0,
    courseCount: stats.courseCount ?? (teacher.courses ? teacher.courses.length : 0),
    testCount: stats.testCount ?? 0,
    reviewCount: stats.reviewCount ?? 0,
    createdAt: teacher.createdAt
  };
};

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

    const reviewStats = calculateReviewStats(myCourses);

    res.status(200).json({
      success: true,
      data: teacher,
      stats: {
        studentCount: studentCount,
        courseCount: teacher.courses ? teacher.courses.length : 0,
        testCount: testCount,
        videoCount: videoCount,
        rating: reviewStats.rating,
        reviewCount: reviewStats.reviewCount
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Hatası', error: error.message });
  }
};

// @desc    Public müəllim siyahısını gətir
// @route   GET /api/teacher/public
// @access  Public
exports.getPublicTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find().sort({ createdAt: -1 });

    const publicTeachers = await Promise.all(teachers.map(async (teacher) => {
      const courseIds = teacher.courses || [];
      const [studentCount, testCount, myCourses] = await Promise.all([
        Student.countDocuments({ activeCourses: { $in: courseIds } }),
        Test.countDocuments({ instructor: teacher._id }),
        Course.find({ instructor: teacher._id })
      ]);

      const reviewStats = calculateReviewStats(myCourses);

      return formatPublicTeacher(teacher, {
        courseCount: courseIds.length,
        studentCount,
        testCount,
        rating: reviewStats.rating,
        reviewCount: reviewStats.reviewCount
      });
    }));

    publicTeachers.sort((left, right) => {
      const ratingDiff = (right.rating || 0) - (left.rating || 0);

      if (ratingDiff !== 0) {
        return ratingDiff;
      }

      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    });

    res.status(200).json({
      success: true,
      count: publicTeachers.length,
      data: publicTeachers
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Müəllimlər alınmadı', error: error.message });
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
      experience: req.body.experience !== undefined ? parseExperience(req.body.experience) : undefined,
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

// @desc    Giriş etmədən bir müəllimin informasiyasını göstərir
// @route   GET /api/teacher/public/:id
// @access  Public
exports.getPublicTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id)
       .select('-password -email -phoneNumber'); // Həssas məlumatlar gizlədilir
       
    if(!teacher) {
       return res.status(404).json({ success: false, message: 'Müəllim tapılmadı' });
    }

    const testCount = await Test.countDocuments({ instructor: teacher._id });
    const myCourses = await Course.find({ instructor: teacher._id });
    const myCourseIds = myCourses.map(c => c._id);
    const studentCount = await Student.countDocuments({ activeCourses: { $in: myCourseIds } });
    const reviewStats = calculateReviewStats(myCourses);
    
    res.status(200).json({
       success: true,
       data: formatPublicTeacher(teacher, {
         courseCount: myCourses.length,
         studentCount,
         testCount,
         rating: reviewStats.rating,
         reviewCount: reviewStats.reviewCount
       }),
       courses: myCourses,
       stats: {
          courseCount: myCourses.length,
          studentCount: studentCount,
          testCount: testCount,
          rating: reviewStats.rating,
          reviewCount: reviewStats.reviewCount
       }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Hatası', error: error.message });
  }
};
