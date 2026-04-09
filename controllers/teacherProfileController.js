const Teacher = require('../models/Teacher');
const Course = require('../models/Course');
const Test = require('../models/Test');
const Student = require('../models/Student');

const MAX_REVIEW_LENGTH = 500;

const calculateAverageRating = (reviews = []) => {
  if (!reviews.length) {
    return 0;
  }

  const totalRating = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
  return Math.round((totalRating / reviews.length) * 10) / 10;
};

const calculateCourseAverageRating = (courses = []) => {
  if (!courses.length) {
    return 0;
  }

  const totalRating = courses.reduce((sum, course) => sum + Number(course.rating || 0), 0);
  return Math.round((totalRating / courses.length) * 10) / 10;
};

const collectCourseReviews = (courses = []) => courses.reduce((allReviews, course) => {
  const courseReviews = Array.isArray(course.reviews) ? course.reviews : [];

  return [...allReviews, ...courseReviews.map((review) => ({
    ...review,
    courseId: course._id,
    courseTitle: course.title
  }))];
}, []);

const calculateReviewStats = (reviews = []) => {
  if (!reviews.length) {
    return { rating: 0, reviewCount: 0 };
  }

  return {
    rating: calculateAverageRating(reviews),
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
  const rating = stats.teacherRating ?? teacher.rating ?? 0;

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
    courseReviewCount: stats.courseReviewCount ?? 0,
    teacherReviewCount: stats.teacherReviewCount ?? 0,
    courseRating: stats.courseRating ?? 0,
    teacherRating: stats.teacherRating ?? rating,
    createdAt: teacher.createdAt
  };
};

// @desc    Giriş yapan öğretmenin bilgilerini getir
// @route   GET /api/teacher/me
// @access  Private (Teacher)
exports.getMe = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id)
      .populate('courses')
      .populate('reviews.user', 'name surname avatar');

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Öğretmen bulunamadı' });
    }

    // 1. Dinamik Test sayı
    const testCount = await Test.countDocuments({ instructor: req.user.id });
    
    // 2. Dinamik Tələbə sayı
    const myCourses = await Course.find({ instructor: req.user.id }).populate('reviews.user', 'name surname avatar');
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

    const courseReviews = collectCourseReviews(myCourses);
    const teacherReviews = Array.isArray(teacher.reviews) ? teacher.reviews : [];
    const courseReviewStats = calculateReviewStats(courseReviews);
    const teacherReviewStats = calculateReviewStats(teacherReviews);
    const courseCount = teacher.courses ? teacher.courses.length : 0;
    const courseRating = calculateCourseAverageRating(myCourses);
    const totalReviewCount = courseReviewStats.reviewCount + teacherReviewStats.reviewCount;
    const avgStudentsPerCourse = courseCount > 0 ? Math.round((studentCount / courseCount) * 10) / 10 : 0;
    const avgVideosPerCourse = courseCount > 0 ? Math.round((videoCount / courseCount) * 10) / 10 : 0;

    const recentCourseReviews = [...courseReviews]
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
      .slice(0, 6);

    const recentTeacherReviews = [...teacherReviews]
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
      .slice(0, 6);

      const teacherData = teacher.toObject();
      teacherData.rating = teacherReviewStats.rating;

    res.status(200).json({
      success: true,
         data: teacherData,
      reviews: {
        courseReviews: recentCourseReviews,
        teacherReviews: recentTeacherReviews
      },
      stats: {
        studentCount: studentCount,
        courseCount: courseCount,
        testCount: testCount,
        videoCount: videoCount,
        courseReviewCount: courseReviewStats.reviewCount,
        teacherReviewCount: teacherReviewStats.reviewCount,
        courseRating: courseRating,
        teacherRating: teacherReviewStats.rating,
        totalReviewCount: totalReviewCount,
        avgStudentsPerCourse: avgStudentsPerCourse,
        avgVideosPerCourse: avgVideosPerCourse
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

      const courseReviews = collectCourseReviews(myCourses);
      const teacherReviews = Array.isArray(teacher.reviews) ? teacher.reviews : [];
      const courseReviewStats = calculateReviewStats(courseReviews);
      const teacherReviewStats = calculateReviewStats(teacherReviews);
      const courseCount = courseIds.length;
      const courseRating = calculateCourseAverageRating(myCourses);
      const totalReviewCount = courseReviewStats.reviewCount + teacherReviewStats.reviewCount;
      const avgStudentsPerCourse = courseCount > 0 ? Math.round((studentCount / courseCount) * 10) / 10 : 0;
      const avgVideosPerCourse = courseCount > 0 ? Math.round((myCourses.reduce((sum, course) => sum + (course.modules || []).reduce((moduleSum, module) => moduleSum + ((module.videos || []).length), 0), 0) / courseCount) * 10) / 10 : 0;

         const teacherData = teacher.toObject();
         teacherData.rating = teacherReviewStats.rating;

      return formatPublicTeacher(teacherData, {
        courseCount,
        studentCount,
        testCount,
        courseReviewCount: courseReviewStats.reviewCount,
        teacherReviewCount: teacherReviewStats.reviewCount,
        courseRating,
        teacherRating: teacherReviewStats.rating,
        totalReviewCount,
        avgStudentsPerCourse,
        avgVideosPerCourse
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
       .select('-password -email -phoneNumber')
       .populate('reviews.user', 'name surname avatar'); // Həssas məlumatlar gizlədilir
       
    if(!teacher) {
       return res.status(404).json({ success: false, message: 'Müəllim tapılmadı' });
    }

    const testCount = await Test.countDocuments({ instructor: teacher._id });
     const myCourses = await Course.find({ instructor: teacher._id }).populate('reviews.user', 'name surname avatar');
    const myCourseIds = myCourses.map(c => c._id);
    const studentCount = await Student.countDocuments({ activeCourses: { $in: myCourseIds } });
     const courseReviews = collectCourseReviews(myCourses);
     const teacherReviews = Array.isArray(teacher.reviews) ? teacher.reviews : [];
     const courseReviewStats = calculateReviewStats(courseReviews);
     const teacherReviewStats = calculateReviewStats(teacherReviews);
    const courseCount = myCourses.length;
    const courseRating = calculateCourseAverageRating(myCourses);
    const totalReviewCount = courseReviewStats.reviewCount + teacherReviewStats.reviewCount;
    const avgStudentsPerCourse = courseCount > 0 ? Math.round((studentCount / courseCount) * 10) / 10 : 0;
    const avgVideosPerCourse = courseCount > 0 ? Math.round((myCourses.reduce((sum, course) => sum + (course.modules || []).reduce((moduleSum, module) => moduleSum + ((module.videos || []).length), 0), 0) / courseCount) * 10) / 10 : 0;

       const teacherData = teacher.toObject();
       teacherData.rating = teacherReviewStats.rating;
    
    res.status(200).json({
       success: true,
       data: formatPublicTeacher(teacherData, {
         courseCount,
         studentCount,
         testCount,
        courseReviewCount: courseReviewStats.reviewCount,
        teacherReviewCount: teacherReviewStats.reviewCount,
        courseRating: courseReviewStats.rating,
         teacherRating: teacherReviewStats.rating,
         totalReviewCount,
         avgStudentsPerCourse,
         avgVideosPerCourse
       }),
       courses: myCourses,
       teacherReviews: teacherReviews,
       stats: {
          courseCount,
          studentCount: studentCount,
          testCount: testCount,
         courseReviewCount: courseReviewStats.reviewCount,
         teacherReviewCount: teacherReviewStats.reviewCount,
         courseRating,
         teacherRating: teacherReviewStats.rating,
         totalReviewCount,
         avgStudentsPerCourse,
         avgVideosPerCourse
       }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Hatası', error: error.message });
  }
};

// @desc    Müəllimə rəy əlavə et və ya mövcud rəyi yenilə
// @route   POST /api/teacher/public/:id/reviews
// @access  Private (Student)
exports.addTeacherReview = async (req, res) => {
  try {
    if (req.user?.constructor?.modelName !== 'Student') {
      return res.status(403).json({ success: false, message: 'Yalnız tələbələr rəy yaza bilər' });
    }

    const { rating, comment } = req.body;
    const normalizedRating = Number(rating);
    const trimmedComment = typeof comment === 'string' ? comment.trim() : '';

    if (!Number.isFinite(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
      return res.status(400).json({ success: false, message: 'Reytinq 1 ilə 5 arasında olmalıdır' });
    }

    if (!trimmedComment) {
      return res.status(400).json({ success: false, message: 'Rəy mətni boş ola bilməz' });
    }

    if (trimmedComment.length > MAX_REVIEW_LENGTH) {
      return res.status(400).json({ success: false, message: `Rəy maksimum ${MAX_REVIEW_LENGTH} simvol ola bilər` });
    }

    const [teacher, student] = await Promise.all([
      Teacher.findById(req.params.id).populate('reviews.user', 'name surname avatar'),
      Student.findById(req.user.id).select('name surname avatar activeCourses')
    ]);

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Müəllim tapılmadı' });
    }

    if (!student) {
      return res.status(404).json({ success: false, message: 'Tələbə tapılmadı' });
    }

    const teacherCourses = await Course.find({ instructor: teacher._id }).select('_id');
    const teacherCourseIds = teacherCourses.map((course) => course._id.toString());
    const enrolled = (student.activeCourses || []).some((courseId) => teacherCourseIds.includes(courseId.toString()));

    if (!enrolled) {
      return res.status(403).json({ success: false, message: 'Yalnız bu müəllimdən kurs alan tələbə rəy yaza bilər' });
    }

    teacher.reviews = teacher.reviews || [];
    const existingReviewIndex = teacher.reviews.findIndex((review) => review.user && review.user.toString() === req.user.id);

    const reviewPayload = {
      user: student._id,
      name: `${student.name} ${student.surname}`.trim(),
      rating: normalizedRating,
      comment: trimmedComment,
      createdAt: new Date()
    };

    if (existingReviewIndex >= 0) {
      teacher.reviews.splice(existingReviewIndex, 1, reviewPayload);
    } else {
      teacher.reviews.push(reviewPayload);
    }

    teacher.rating = calculateAverageRating(teacher.reviews);
    await teacher.save();

    const updatedTeacher = await Teacher.findById(teacher._id).populate('reviews.user', 'name surname avatar');

    res.status(existingReviewIndex >= 0 ? 200 : 201).json({
      success: true,
      message: existingReviewIndex >= 0 ? 'Müəllim rəyi yeniləndi' : 'Müəllim rəyi əlavə olundu',
      data: updatedTeacher,
      reviews: updatedTeacher.reviews,
      stats: {
        teacherRating: updatedTeacher.rating,
        teacherReviewCount: updatedTeacher.reviews.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Müəllim rəyi əlavə olunmadı', error: error.message });
  }
};
