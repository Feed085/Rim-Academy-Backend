const Student = require('../models/Student');
const Course = require('../models/Course');
const Test = require('../models/Test');
const TestResult = require('../models/TestResult');

const flattenCourseLessons = (course) => {
  return (course.modules || []).reduce((lessons, module) => {
    const moduleLessons = (module.videos || []).map((video) => {
      const lesson = typeof video.toObject === 'function' ? video.toObject() : video;

      return {
        ...lesson,
        moduleTitle: module.title
      };
    });

    return [...lessons, ...moduleLessons];
  }, []);
};

const buildCourseProgressSummary = (course, progressEntry) => {
  const lessons = flattenCourseLessons(course);
  const completedLessons = progressEntry?.completedLessonIds?.length || 0;
  const totalLessons = lessons.length;
  const progress = totalLessons > 0
    ? Math.round((completedLessons / totalLessons) * 100)
    : 0;

  return {
    progress,
    completedLessons,
    totalLessons,
    lastAccessed: progressEntry?.lastAccessed || null
  };
};

const toPlainDoc = (doc) => (typeof doc?.toObject === 'function' ? doc.toObject() : doc);

const mergeUniqueTests = (tests = []) => {
  const seen = new Set();

  return tests.filter((test) => {
    const id = test?._id?.toString?.() || test?.id?.toString?.();

    if (!id || seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
};

// @desc    Giriş yapmış öğrencinin kendi profili ve istatistiklerini getir
// @route   GET /api/student/me
// @access  Private (Token Gerekli)
exports.getMe = async (req, res) => {
  try {
    // req.user auth middleware icinden gelir
    const student = await Student.findById(req.user.id)
      .populate('activeCourses')
      .populate({
        path: 'assignedTests',
        select: 'title course instructor duration createdAt',
        populate: [
          { path: 'course', select: 'title category image' },
          { path: 'instructor', select: 'name surname avatar' }
        ]
      });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Tələbə tapılmadı' });
    }

    const progressMap = new Map(
      (student.courseProgress || []).map((entry) => [entry.course.toString(), entry])
    );

    const activeCourses = (student.activeCourses || []).map((course) => {
      const courseData = typeof course.toObject === 'function' ? course.toObject() : course;
      const progressEntry = progressMap.get(courseData._id.toString());

      return {
        ...courseData,
        ...buildCourseProgressSummary(courseData, progressEntry)
      };
    });

    const activeCourseIds = activeCourses.map((course) => course._id);
    const courseLinkedTests = activeCourseIds.length > 0
      ? await Test.find({ course: { $in: activeCourseIds } })
        .populate('course', 'title category image')
        .populate('instructor', 'name surname avatar')
      : [];

    const manualTests = (student.assignedTests || []).map(toPlainDoc);
    const combinedTests = mergeUniqueTests([
      ...manualTests,
      ...courseLinkedTests.map(toPlainDoc)
    ]);

    const normalizedAssignedTests = combinedTests.map((test) => ({
      ...test,
      course: test.course ? toPlainDoc(test.course) : null,
      instructor: test.instructor ? toPlainDoc(test.instructor) : null
    }));

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
        assignedTests: normalizedAssignedTests,
        activeCourses,
        stats: {
          activeCoursesCount: student.activeCourses ? student.activeCourses.length : 0,
          assignedTestsCount: normalizedAssignedTests.length,
          completedTestsCount: testResults,
          certificatesCount: certificatesCount
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Sunucu hatası', error: error.message });
  }
};

// @desc    Video tamamlanmasını qeyd et və kurs irəliləyişini yenilə
// @route   POST /api/student/progress
// @access  Private (Student)
exports.markLessonCompleted = async (req, res) => {
  try {
    const { courseId, lessonId } = req.body;

    if (!courseId || !lessonId) {
      return res.status(400).json({ success: false, message: 'courseId və lessonId mütləqdir' });
    }

    const [student, course] = await Promise.all([
      Student.findById(req.user.id),
      Course.findById(courseId)
    ]);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Tələbə tapılmadı' });
    }

    if (!course) {
      return res.status(404).json({ success: false, message: 'Kurs tapılmadı' });
    }

    const isEnrolled = (student.activeCourses || []).some((activeCourseId) => activeCourseId.toString() === course._id.toString());

    if (!isEnrolled) {
      return res.status(403).json({ success: false, message: 'Bu kurs üçün qeydiyyat tapılmadı' });
    }

    const lessons = flattenCourseLessons(course);

    if (lessons.length === 0) {
      return res.status(400).json({ success: false, message: 'Kursda video dərs tapılmadı' });
    }

    const normalizedLessonId = lessonId.toString();
    const lessonIndex = lessons.findIndex((lesson) => lesson._id.toString() === normalizedLessonId);

    if (lessonIndex === -1) {
      return res.status(404).json({ success: false, message: 'Video dərsi tapılmadı' });
    }

    student.courseProgress = student.courseProgress || [];
    let progressEntry = student.courseProgress.find((entry) => entry.course.toString() === course._id.toString());

    if (!progressEntry) {
      progressEntry = {
        course: course._id,
        completedLessonIds: [],
        lastAccessed: new Date()
      };
      student.courseProgress.push(progressEntry);
    }

    const completedLessonIds = progressEntry.completedLessonIds || [];
    const alreadyCompleted = completedLessonIds.includes(normalizedLessonId);
    const nextExpectedLesson = lessons[completedLessonIds.length];
    const canAdvance = nextExpectedLesson && nextExpectedLesson._id.toString() === normalizedLessonId && !alreadyCompleted;

    if (canAdvance) {
      progressEntry.completedLessonIds = [...completedLessonIds, normalizedLessonId];
      progressEntry.lastAccessed = new Date();
      await student.save();
    }

    const summary = buildCourseProgressSummary(course, progressEntry);

    res.status(200).json({
      success: true,
      message: canAdvance ? 'Dərs tamamlandı' : 'İrəliləyiş dəyişməyib',
      data: {
        courseId: course._id,
        lessonId: normalizedLessonId,
        updated: canAdvance,
        ...summary
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'İrəliləyiş yenilənmədi', error: error.message });
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
