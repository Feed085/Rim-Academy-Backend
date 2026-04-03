const Course = require('../models/Course');
const Teacher = require('../models/Teacher');

// @desc    Yeni kurs yarat
// @route   POST /api/courses
// @access  Private (Teacher)
exports.createCourse = async (req, res) => {
  try {
    // 1 günlük cooldown publishDate model tərəfindən default olaraq eklənəcək
    const course = await Course.create({
      ...req.body,
      instructor: req.user.id
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

    res.status(200).json({
      success: true,
      data: course
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
      req.body,
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
