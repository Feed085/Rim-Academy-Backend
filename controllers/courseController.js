const Course = require('../models/Course');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Test = require('../models/Test');

const MAX_REVIEW_LENGTH = 500;

const calculateAverageRating = (reviews = []) => {
  if (!reviews.length) {
    return 0;
  }

  const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
  return Math.round((total / reviews.length) * 10) / 10;
};

// @desc    Yeni kurs yarat
// @route   POST /api/courses
// @access  Private (Teacher)
exports.createCourse = async (req, res) => {
  try {
    // 1 günlük cooldown publishDate model tərəfindən default olaraq eklənəcək
    const course = await Course.create({
      ...req.body,
      instructor: req.user.id,
      updatedAt: new Date()
    });

    // Müəllimin arxivinə kursu əlavə edirik
    await Teacher.findByIdAndUpdate(req.user.id, {
      $push: { courses: course._id }
    });

    res.status(201).json({
      success: true,
      data: course
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server xətası', error: error.message });
  }
};

// @desc    Bütün public (aktiv qovluq və vaxtı çatmış) kursları gətir
// @route   GET /api/courses
// @access  Public
exports.getCourses = async (req, res) => {
  try {
    const courses = await Course.find({
      isActive: true,
      publishDate: { $lte: Date.now() }
    }).populate('instructor', 'name surname avatar rating');

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server xətası', error: error.message });
  }
};

// @desc    Müəllimin öz kurslarını gətir 
// @route   GET /api/courses/my-courses
// @access  Private (Teacher)
exports.getTeacherCourses = async (req, res) => {
  try {
    // Müəllimə publishDate təsir etməməlidir ki, öz yarımçıq işini görə bilsin
    const courses = await Course.find({ instructor: req.user.id });

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server xətası', error: error.message });
  }
};

// @desc    Tək bir kursun detaylarını gətir
// @route   GET /api/courses/:id
// @access  Public
exports.getCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('instructor', 'name surname avatar experience specializedAreas socialNetworks')
      .populate('reviews.user', 'name surname avatar');

    if (!course) {
      return res.status(404).json({ success: false, message: 'Kursa rast gəlinmədi' });
    }

    const studentCount = await Student.countDocuments({ activeCourses: course._id });

    res.status(200).json({
      success: true,
      data: {
        ...course.toObject(),
        studentCount
      }
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: 'Yanlış Kurs ID formatı' });
    }
    res.status(500).json({ success: false, message: 'Server xətası', error: error.message });
  }
};

// @desc    Kursu yenilə (redaktə)
// @route   PUT /api/courses/:id
// @access  Private (Teacher)
exports.updateCourse = async (req, res) => {
  try {
    let course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ success: false, message: 'Kursa rast gəlinmədi' });
    }

    // Yalnız kursun sahibi olan müəllim dəyişə bilər
    if (course.instructor.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Bu kursu dəyişmək icazəniz yoxdur' });
    }

    course = await Course.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: course
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: 'Yanlış Kurs ID formatı' });
    }
    res.status(500).json({ success: false, message: 'Server xətası' });
  }
};

// @desc    Kursu sil
// @route   DELETE /api/courses/:id
// @access  Private (Teacher)
exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ success: false, message: 'Kursa rast gəlinmədi' });
    }

    if (course.instructor.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bu kursu silmək icazəniz yoxdur' });
    }

    const relatedTests = await Test.find({ course: course._id }).select('_id');
    const relatedTestIds = relatedTests.map((test) => test._id);

    await Promise.all([
      Test.deleteMany({ course: course._id }),
      Student.updateMany(
        {
          $or: [
            { activeCourses: course._id },
            { 'courseProgress.course': course._id },
            ...(relatedTestIds.length > 0 ? [{ assignedTests: { $in: relatedTestIds } }] : [])
          ]
        },
        {
          $pull: {
            activeCourses: course._id,
            courseProgress: { course: course._id },
            assignedTests: { $in: relatedTestIds }
          }
        }
      ),
      Teacher.findByIdAndUpdate(course.instructor, {
        $pull: { courses: course._id }
      })
    ]);

    await Course.findByIdAndDelete(course._id);

    res.status(200).json({
      success: true,
      message: 'Kurs silindi'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Kurs silinmədi', error: error.message });
  }
};

// @desc    Kursa rəy əlavə et və ya mövcud rəyi yenilə
// @route   POST /api/courses/:id/reviews
// @access  Private (Student)
exports.addReview = async (req, res) => {
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

    const [course, student] = await Promise.all([
      Course.findById(req.params.id),
      Student.findById(req.user.id).select('name surname avatar activeCourses')
    ]);

    if (!course) {
      return res.status(404).json({ success: false, message: 'Kursa rast gəlinmədi' });
    }

    if (!student) {
      return res.status(404).json({ success: false, message: 'Tələbə tapılmadı' });
    }

    const isEnrolled = (student.activeCourses || []).some((courseId) => courseId.toString() === course._id.toString());

    if (!isEnrolled) {
      return res.status(403).json({ success: false, message: 'Yalnız qeydiyyatdan keçmiş tələbələr rəy yaza bilər' });
    }

    course.reviews = course.reviews || [];
    const existingReviewIndex = course.reviews.findIndex((review) => review.user && review.user.toString() === req.user.id);

    const reviewPayload = {
      user: student._id,
      name: `${student.name} ${student.surname}`.trim(),
      rating: normalizedRating,
      comment: trimmedComment,
      createdAt: new Date()
    };

    if (existingReviewIndex >= 0) {
      course.reviews.splice(existingReviewIndex, 1, reviewPayload);
    } else {
      course.reviews.push(reviewPayload);
    }

    course.rating = calculateAverageRating(course.reviews);
    course.updatedAt = new Date();
    await course.save();

    const updatedCourse = await Course.findById(course._id)
      .populate('instructor', 'name surname avatar experience specializedAreas socialNetworks')
      .populate('reviews.user', 'name surname avatar');
    const studentCount = await Student.countDocuments({ activeCourses: course._id });

    const updatedCourseData = updatedCourse.toObject();
    updatedCourseData.studentCount = studentCount;

    res.status(existingReviewIndex >= 0 ? 200 : 201).json({
      success: true,
      message: existingReviewIndex >= 0 ? 'Rəyiniz yeniləndi' : 'Rəyiniz əlavə olundu',
      data: updatedCourseData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Rəy əlavə olunmadı', error: error.message });
  }
};
