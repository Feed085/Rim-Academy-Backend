const mongoose = require('mongoose');
const Course = require('../models/Course');
const ContactCourseOption = require('../models/ContactCourseOption');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Test = require('../models/Test');
const TestResult = require('../models/TestResult');
const Category = require('../models/Category');
const { deleteR2ObjectsByUrls } = require('../utils/s3Upload');

const normalizeText = (value = '') => value
  .trim()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[çÇ]/g, 'c')
  .replace(/[ğĞ]/g, 'g')
  .replace(/[ıİ]/g, 'i')
  .replace(/[öÖ]/g, 'o')
  .replace(/[şŞ]/g, 's')
  .replace(/[üÜ]/g, 'u')
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase();

const formatCategory = (category) => ({
  id: category.slug,
  name: category.name,
  description: category.description,
  color: category.color,
  icon: category.icon,
  order: category.order,
  isActive: category.isActive
});

const formatContactCourseOption = (option) => ({
  id: option._id,
  title: option.title,
  description: option.description || '',
  order: option.order || 0,
  isActive: Boolean(option.isActive)
});

const getMonthRange = (date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
};

const getPreviousMonthRange = (date) => {
  const start = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const end = new Date(date.getFullYear(), date.getMonth(), 1);
  return { start, end };
};

const calculateGrowthPercent = (current, previous) => {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return Math.round(((current - previous) / previous) * 100);
};

const parseExperience = (value) => {
  const experience = Number(value);
  return Number.isFinite(experience) ? experience : 0;
};

const getAttemptScopeKey = (result) => {
  const testId = resolveEntityKey(result?.test?._id || result?.test);
  const studentId = resolveEntityKey(result?.student?._id || result?.student);
  return `${testId}:${studentId}`;
};

const buildAttemptNumberedResults = (results) => {
  const attemptCounters = new Map();

  return results.map((result) => {
    const attemptScopeKey = getAttemptScopeKey(result);
    const attemptNumber = attemptScopeKey ? ((attemptCounters.get(attemptScopeKey) || 0) + 1) : 1;

    if (attemptScopeKey) {
      attemptCounters.set(attemptScopeKey, attemptNumber);
    }

    return {
      id: result._id,
      test: result.test,
      student: result.student,
      answers: result.answers,
      scorePercentage: result.scorePercentage,
      hasPendingAnswers: result.hasPendingAnswers,
      completedAt: result.completedAt,
      createdAt: result.createdAt,
      attemptNumber
    };
  });
};

const resolveEntityKey = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }

  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') {
      return value.toHexString();
    }

    if (value._id !== undefined && value._id !== null) {
      if (value._id === value) {
        return value.toString();
      }

      return resolveEntityKey(value._id);
    }

    if (value.id !== undefined && value.id !== null) {
      if (value.id === value) {
        return value.toString();
      }

      return resolveEntityKey(value.id);
    }

    if (typeof value.toString === 'function') {
      const stringValue = value.toString();
      if (stringValue !== '[object Object]') {
        return stringValue;
      }
    }
  }

  return String(value);
};

const formatSelectedAnswerText = (question, rawAnswer) => {
  if (rawAnswer === null || rawAnswer === undefined || rawAnswer === '') {
    return 'Cavab verilməyib';
  }

  if (question?.answerType === 'multiple_choice') {
    const answerIndex = Number(String(rawAnswer).trim());

    if (Number.isInteger(answerIndex) && answerIndex >= 0 && Array.isArray(question?.options)) {
      const optionText = question.options[answerIndex];

      if (optionText) {
        return `${String.fromCharCode(65 + answerIndex)}: ${optionText}`;
      }

      return String.fromCharCode(65 + answerIndex);
    }
  }

  return String(rawAnswer);
};

const collectCourseAssetUrls = (course) => {
  const urls = [];

  if (course?.image) {
    urls.push(course.image);
  }

  const modules = Array.isArray(course?.modules) ? course.modules : [];

  modules.forEach((module) => {
    const videos = Array.isArray(module?.videos) ? module.videos : [];

    videos.forEach((video) => {
      if (video?.videoUrl) {
        urls.push(video.videoUrl);
      }

      if (video?.thumbnail) {
        urls.push(video.thumbnail);
      }
    });
  });

  return urls;
};

const collectTestAssetUrls = (test) => {
  const urls = [];
  const questions = Array.isArray(test?.questions) ? test.questions : [];

  questions.forEach((question) => {
    if (typeof question?.content === 'string' && question.content.trim()) {
      urls.push(question.content);
    }
  });

  return urls;
};

const collectTeacherDeletionAssetUrls = (teacher, courses = [], tests = []) => {
  const urls = [teacher?.avatar];

  courses.forEach((course) => {
    urls.push(...collectCourseAssetUrls(course));
  });

  tests.forEach((test) => {
    urls.push(...collectTestAssetUrls(test));
  });

  return [...new Set(urls.filter(Boolean))];
};

const buildTeacherSummary = async (teacher) => {
  const courseCount = await Course.countDocuments({ instructor: teacher._id });
  const testCount = await Test.countDocuments({ instructor: teacher._id });

  return {
    id: teacher._id,
    name: teacher.name,
    surname: teacher.surname,
    email: teacher.email,
    phoneNumber: teacher.phoneNumber,
    avatar: teacher.avatar,
    categories: teacher.categories || [],
    rating: teacher.rating || 0,
    education: teacher.education || '',
    experience: parseExperience(teacher.experience),
    location: teacher.location || '',
    initialPassword: teacher.initialPassword || '',
    courseCount,
    testCount,
    createdAt: teacher.createdAt
  };
};

exports.getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const currentMonthRange = getMonthRange(now);
    const previousMonthRange = getPreviousMonthRange(now);
    const activeCourseQuery = { isActive: true };

    const [
      totalStudents,
      totalTeachers,
      activeCourses,
      currentMonthStudents,
      previousMonthStudents,
      currentMonthTeachers,
      previousMonthTeachers,
      currentMonthCourses,
      previousMonthCourses,
      studentCourseUsage,
      latestStudents,
      latestTeachers,
      latestCourses
    ] = await Promise.all([
      Student.countDocuments(),
      Teacher.countDocuments(),
      Course.countDocuments(activeCourseQuery),
      Student.countDocuments({ createdAt: { $gte: currentMonthRange.start, $lt: currentMonthRange.end } }),
      Student.countDocuments({ createdAt: { $gte: previousMonthRange.start, $lt: previousMonthRange.end } }),
      Teacher.countDocuments({ createdAt: { $gte: currentMonthRange.start, $lt: currentMonthRange.end } }),
      Teacher.countDocuments({ createdAt: { $gte: previousMonthRange.start, $lt: previousMonthRange.end } }),
      Course.countDocuments({ isActive: true, createdAt: { $gte: currentMonthRange.start, $lt: currentMonthRange.end } }),
      Course.countDocuments({ isActive: true, createdAt: { $gte: previousMonthRange.start, $lt: previousMonthRange.end } }),
      Student.aggregate([
        { $unwind: '$activeCourses' },
        { $group: { _id: '$activeCourses', students: { $sum: 1 } } }
      ]),
      Student.find().sort({ createdAt: -1 }).limit(5),
      Teacher.find().select('+initialPassword').sort({ createdAt: -1 }).limit(5),
      Course.find(activeCourseQuery)
        .populate('instructor', 'name surname avatar')
        .sort({ createdAt: -1 })
    ]);

    const enrolledMap = studentCourseUsage.reduce((accumulator, entry) => {
      accumulator[entry._id.toString()] = entry.students;
      return accumulator;
    }, {});

    const courseSummaries = latestCourses.map((course) => ({
      id: course._id,
      title: course.title,
      category: course.category,
      instructorName: course.instructor ? `${course.instructor.name} ${course.instructor.surname}` : 'Naməlum müəllim',
      studentCount: enrolledMap[course._id.toString()] || 0,
      publishDate: course.publishDate,
      createdAt: course.createdAt
    }));

    const monthlyStudentGrowth = calculateGrowthPercent(currentMonthStudents, previousMonthStudents);
    const monthlyTeacherGrowth = calculateGrowthPercent(currentMonthTeachers, previousMonthTeachers);
    const monthlyCourseGrowth = calculateGrowthPercent(currentMonthCourses, previousMonthCourses);

    res.status(200).json({
      success: true,
      data: {
        cards: [
          {
            key: 'students',
            label: 'Ümumi Tələbə',
            value: totalStudents,
            trendLabel: `${monthlyStudentGrowth >= 0 ? '+' : ''}${monthlyStudentGrowth}%`,
            trendType: monthlyStudentGrowth >= 0 ? 'up' : 'down',
            note: 'Keçən aya nisbətən'
          },
          {
            key: 'teachers',
            label: 'Müəllimlər',
            value: totalTeachers,
            trendLabel: `+${currentMonthTeachers} bu ay`,
            trendType: 'up',
            note: `Ötən ay ${previousMonthTeachers} yeni müəllim`
          },
          {
            key: 'courses',
            label: 'Aktiv Kurslar',
            value: activeCourses,
            trendLabel: `+${currentMonthCourses} bu ay`,
            trendType: 'up',
            note: `${monthlyCourseGrowth >= 0 ? '+' : ''}${monthlyCourseGrowth}% ay müqayisəsi`
          },
        ],
        topCourses: courseSummaries
          .sort((left, right) => right.studentCount - left.studentCount)
          .slice(0, 5),
        latestStudents: latestStudents.map((student) => ({
          id: student._id,
          name: `${student.name} ${student.surname}`,
          email: student.email,
          phoneNumber: student.phoneNumber,
          activeCoursesCount: student.activeCourses ? student.activeCourses.length : 0,
          assignedTestsCount: student.assignedTests ? student.assignedTests.length : 0,
          createdAt: student.createdAt
        })),
        latestTeachers: await Promise.all(latestTeachers.map(buildTeacherSummary)),
        meta: {
          totalStudents,
          totalTeachers,
          activeCourses,
          revenueReady: false
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Dashboard məlumatları alınmadı', error: error.message });
  }
};

exports.getPublicStats = async (req, res) => {
  try {
    const now = new Date();

    const [totalStudents, totalTeachers, activeCourses] = await Promise.all([
      Student.countDocuments(),
      Teacher.countDocuments(),
      Course.countDocuments({ isActive: true, publishDate: { $lte: now } })
    ]);

    res.status(200).json({
      success: true,
      data: {
        students: totalStudents,
        teachers: totalTeachers,
        courses: activeCourses,
        experience: 15
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'İctimai statistikalar alınmadı', error: error.message });
  }
};

exports.getTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find().select('+initialPassword').sort({ createdAt: -1 });
    const data = await Promise.all(teachers.map(buildTeacherSummary));

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Müəllimlər alınmadı', error: error.message });
  }
};

exports.updateTeacher = async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      surname: req.body.surname,
      email: req.body.email,
      phoneNumber: req.body.phoneNumber,
      categories: req.body.categories,
      education: req.body.education,
      experience: req.body.experience !== undefined ? parseExperience(req.body.experience) : undefined,
      specializedAreas: req.body.specializedAreas,
      location: req.body.location,
      avatar: req.body.avatar,
      rating: req.body.rating
    };

    const password = req.body.password;

    Object.keys(updateData).forEach((key) => updateData[key] === undefined && delete updateData[key]);

    const teacher = await Teacher.findById(req.params.teacherId).select('+password +initialPassword');

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Müəllim tapılmadı' });
    }

    Object.entries(updateData).forEach(([key, value]) => {
      teacher[key] = value;
    });

    if (password !== undefined) {
      teacher.password = password;
      teacher.initialPassword = password;
    }

    await teacher.save();

    res.status(200).json({ success: true, data: await buildTeacherSummary(teacher) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Müəllim yenilənmədi', error: error.message });
  }
};

exports.deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.teacherId);

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Müəllim tapılmadı' });
    }

    const [courses, tests] = await Promise.all([
      Course.find({ instructor: teacher._id }).select('image modules'),
      Test.find({ instructor: teacher._id }).select('questions')
    ]);

    const courseIds = courses.map((course) => course._id);
    const testIds = tests.map((test) => test._id);
    const assetUrls = collectTeacherDeletionAssetUrls(teacher, courses, tests);

    const studentPullUpdate = { $pull: {} };

    if (courseIds.length > 0) {
      studentPullUpdate.$pull.activeCourses = { $in: courseIds };
      studentPullUpdate.$pull.courseProgress = { course: { $in: courseIds } };
    }

    if (testIds.length > 0) {
      studentPullUpdate.$pull.assignedTests = { $in: testIds };
    }

    const cleanupOperations = [
      ...(courseIds.length > 0 ? [Course.deleteMany({ instructor: teacher._id })] : []),
      ...(testIds.length > 0 ? [
        TestResult.deleteMany({ test: { $in: testIds } }),
        Test.deleteMany({ instructor: teacher._id })
      ] : []),
      Object.keys(studentPullUpdate.$pull).length > 0 ? Student.updateMany({}, studentPullUpdate) : Promise.resolve(),
      deleteR2ObjectsByUrls(assetUrls)
    ];

    await Promise.all(cleanupOperations);

    await Teacher.findByIdAndDelete(req.params.teacherId);

    res.status(200).json({
      success: true,
      message: 'Müəllim silindi'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Müəllim silinmədi', error: error.message });
  }
};

exports.getStudents = async (req, res) => {
  try {
    const students = await Student.find()
      .populate('activeCourses', 'title category instructor isActive')
      .populate('assignedTests', 'title course instructor duration allowRetake')
      .sort({ createdAt: -1 });

    const data = students.map((student) => ({
      id: student._id,
      name: `${student.name} ${student.surname}`,
      firstName: student.name,
      lastName: student.surname,
      email: student.email,
      phoneNumber: student.phoneNumber,
      avatar: student.avatar,
      educationLevel: student.educationLevel,
      activeCourses: student.activeCourses || [],
      assignedTests: student.assignedTests || [],
      activeCoursesCount: student.activeCourses ? student.activeCourses.length : 0,
      assignedTestsCount: student.assignedTests ? student.assignedTests.length : 0,
      completedTestsCount: student.completedTests ? student.completedTests.length : 0,
      createdAt: student.createdAt
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Tələbələr alınmadı', error: error.message });
  }
};

exports.getStudentTestResults = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findById(studentId)
      .select('name surname email phoneNumber avatar educationLevel createdAt')
      .populate('activeCourses', 'title category image')
      .populate('assignedTests', 'title course instructor duration allowRetake');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Tələbə tapılmadı' });
    }

    const results = await TestResult.find({ student: studentId })
      .populate({
        path: 'test',
        select: 'title course duration allowRetake questions createdAt',
        populate: [
          { path: 'course', select: 'title category image' },
          { path: 'instructor', select: 'name surname avatar' }
        ]
      })
      .sort({ createdAt: 1 });

    const resultsWithAttempts = buildAttemptNumberedResults(results).map((result) => ({
      ...result,
      test: result.test && typeof result.test.toObject === 'function' ? result.test.toObject() : result.test,
      student: result.student && typeof result.student.toObject === 'function' ? result.student.toObject() : result.student
    }));

    res.status(200).json({
      success: true,
      data: {
        student: {
          id: student._id,
          name: student.name,
          surname: student.surname,
          email: student.email,
          phoneNumber: student.phoneNumber,
          avatar: student.avatar,
          educationLevel: student.educationLevel,
          createdAt: student.createdAt,
          activeCourses: student.activeCourses || [],
          assignedTests: student.assignedTests || []
        },
        results: resultsWithAttempts
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Tələbə nəticələri alınmadı', error: error.message });
  }
};

exports.assignStudentItem = async (req, res) => {
  try {
    const { type, targetId, action = 'assign' } = req.body;

    if (!type || !targetId) {
      return res.status(400).json({ success: false, message: 'type və targetId mütləqdir' });
    }

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ success: false, message: 'targetId düzgün deyil' });
    }

    if (!['assign', 'remove'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action yalnız assign və ya remove ola bilər' });
    }

    const student = await Student.findById(req.params.studentId);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Tələbə tapılmadı' });
    }

    if (type === 'course') {
      const course = await Course.findById(targetId);

      if (!course) {
        return res.status(404).json({ success: false, message: 'Kurs tapılmadı' });
      }

      const alreadyAssigned = student.activeCourses.some((courseId) => courseId.toString() === targetId);

      if (action === 'assign') {
        if (alreadyAssigned) {
          return res.status(400).json({ success: false, message: 'Bu kurs artıq tələbəyə verilib' });
        }

        student.activeCourses.push(course._id);

        student.courseProgress = student.courseProgress || [];
        const hasProgressEntry = student.courseProgress.some((entry) => entry.course.toString() === course._id.toString());

        if (!hasProgressEntry) {
          student.courseProgress.push({
            course: course._id,
            completedLessonIds: [],
            lastAccessed: new Date()
          });
        }
      } else {
        if (!alreadyAssigned) {
          return res.status(400).json({ success: false, message: 'Bu kurs tələbəyə təyin edilməyib' });
        }

        student.activeCourses = student.activeCourses.filter((courseId) => courseId.toString() !== targetId);
        student.courseProgress = (student.courseProgress || []).filter((entry) => entry.course.toString() !== targetId);
      }
    } else if (type === 'test') {
      const test = await Test.findById(targetId);

      if (!test) {
        return res.status(404).json({ success: false, message: 'Test tapılmadı' });
      }

      const alreadyAssigned = (student.assignedTests || []).some((testId) => testId.toString() === targetId);

      if (action === 'assign') {
        if (alreadyAssigned) {
          return res.status(400).json({ success: false, message: 'Bu test artıq tələbəyə verilib' });
        }

        student.assignedTests = student.assignedTests || [];
        student.assignedTests.push(test._id);
      } else {
        if (!alreadyAssigned) {
          return res.status(400).json({ success: false, message: 'Bu test tələbəyə təyin edilməyib' });
        }

        student.assignedTests = (student.assignedTests || []).filter((testId) => testId.toString() !== targetId);
      }
    } else {
      return res.status(400).json({ success: false, message: 'type yalnız course və ya test ola bilər' });
    }

    await student.save();

    const updatedStudent = await Student.findById(student._id)
      .populate('activeCourses', 'title category instructor isActive')
      .populate('assignedTests', 'title course instructor duration');

    res.status(200).json({
      success: true,
      data: {
        id: updatedStudent._id,
        name: `${updatedStudent.name} ${updatedStudent.surname}`,
        email: updatedStudent.email,
        phoneNumber: updatedStudent.phoneNumber,
        activeCourses: updatedStudent.activeCourses || [],
        assignedTests: updatedStudent.assignedTests || [],
        activeCoursesCount: updatedStudent.activeCourses ? updatedStudent.activeCourses.length : 0,
        assignedTestsCount: updatedStudent.assignedTests ? updatedStudent.assignedTests.length : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Təyinat əməliyyatı tamamlanmadı', error: error.message });
  }
};

exports.getCourses = async (req, res) => {
  try {
    const courses = await Course.find()
      .populate('instructor', 'name surname avatar')
      .sort({ createdAt: -1 });

    const courseUsage = await Student.aggregate([
      { $unwind: { path: '$activeCourses', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$activeCourses', studentCount: { $sum: 1 } } }
    ]);

    const usageMap = courseUsage.reduce((accumulator, entry) => {
      accumulator[entry._id.toString()] = entry.studentCount;
      return accumulator;
    }, {});

    const data = courses.map((course) => ({
      id: course._id,
      title: course.title,
      category: course.category,
      instructor: course.instructor ? `${course.instructor.name} ${course.instructor.surname}` : 'Naməlum müəllim',
      instructorId: course.instructor ? course.instructor._id : null,
      price: course.price,
      isActive: course.isActive,
      studentCount: usageMap[course._id.toString()] || 0,
      createdAt: course.createdAt,
      publishDate: course.publishDate
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Kurslar alınmadı', error: error.message });
  }
};

exports.getTests = async (req, res) => {
  try {
    const tests = await Test.find()
      .populate('course', 'title category')
      .populate('instructor', 'name surname')
      .sort({ createdAt: -1 });

    const data = tests.map((test) => ({
      id: test._id,
      title: test.title,
      courseId: test.course ? test.course._id : null,
      courseTitle: test.course ? test.course.title : 'Naməlum kurs',
      instructorId: test.instructor ? test.instructor._id : null,
      instructorName: test.instructor ? `${test.instructor.name} ${test.instructor.surname}` : 'Naməlum müəllim',
      duration: test.duration,
      questionCount: test.questions ? test.questions.length : 0,
      createdAt: test.createdAt
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Testlər alınmadı', error: error.message });
  }
};

exports.getTestResults = async (req, res) => {
  try {
    const { testId } = req.params;

    const test = await Test.findById(testId)
      .populate('course', 'title category image instructor')
      .populate('instructor', 'name surname avatar');

    if (!test) {
      return res.status(404).json({ success: false, message: 'Test tapılmadı' });
    }

    const results = await TestResult.find({ test: testId })
      .populate('student', 'name surname email phoneNumber avatar educationLevel createdAt')
      .sort({ createdAt: 1 });

    const normalizedQuestions = (test.questions || []).map((question) => ({
      ...(question.toObject ? question.toObject() : question),
      id: resolveEntityKey(question._id || question.id),
      questionId: resolveEntityKey(question._id || question.id)
    }));

    const resultsWithAttempts = buildAttemptNumberedResults(results).map((result) => ({
      constAnswers: result.answers || [],
      answers: (result.answers || []).map((answer, index) => {
        const plainAnswer = answer && typeof answer.toObject === 'function' ? answer.toObject() : answer;
        const rawAnswer = plainAnswer?.answer ?? '';
        return {
          ...plainAnswer,
          questionId: resolveEntityKey(plainAnswer?.questionId),
          answer: rawAnswer,
          questionIndex: index,
          selectedDisplayAnswer: formatSelectedAnswerText(normalizedQuestions[index], rawAnswer)
        };
      }),
      answersByQuestionId: normalizedQuestions.reduce((accumulator, question, index) => {
        const exactAnswer = (result.answers || []).find((answer) => resolveEntityKey(answer.questionId) === question.questionId);
        const fallbackAnswer = exactAnswer || result.answers?.[index];

        if (fallbackAnswer) {
          const plainAnswer = fallbackAnswer && typeof fallbackAnswer.toObject === 'function' ? fallbackAnswer.toObject() : fallbackAnswer;
          const rawAnswer = plainAnswer?.answer ?? '';

          accumulator[question.questionId] = {
            ...plainAnswer,
            questionId: question.questionId,
            answer: rawAnswer,
            questionIndex: index,
            selectedDisplayAnswer: formatSelectedAnswerText(question, rawAnswer)
          };
        }

        return accumulator;
      }, {}),
      ...result,
      student: result.student && typeof result.student.toObject === 'function' ? result.student.toObject() : result.student
    }));

    res.status(200).json({
      success: true,
      data: {
        test: {
          id: test._id,
          title: test.title,
          course: test.course && typeof test.course.toObject === 'function' ? test.course.toObject() : test.course,
          instructor: test.instructor && typeof test.instructor.toObject === 'function' ? test.instructor.toObject() : test.instructor,
          duration: test.duration,
          questions: normalizedQuestions,
          allowRetake: test.allowRetake,
          createdAt: test.createdAt
        },
        results: resultsWithAttempts
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Test nəticələri alınmadı', error: error.message });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ order: 1, createdAt: 1 });

    res.status(200).json({
      success: true,
      data: categories.map(formatCategory)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Kateqoriyalar alınmadı', error: error.message });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const name = req.body.name || '';

    if (!name.trim()) {
      return res.status(400).json({ success: false, message: 'Kateqoriya adı məcburidir' });
    }

    const slug = req.body.slug || normalizeText(name);

    const exists = await Category.findOne({ $or: [{ name: name.trim() }, { slug }] });

    if (exists) {
      return res.status(400).json({ success: false, message: 'Bu kateqoriya artıq mövcuddur' });
    }

    const category = await Category.create({
      name: name.trim(),
      slug,
      description: req.body.description || '',
      color: req.body.color || '#00D084',
      icon: req.body.icon || 'Tag',
      order: Number(req.body.order) || 0,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true
    });

    res.status(201).json({ success: true, data: formatCategory(category) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Kateqoriya yaradılmadı', error: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findOneAndDelete({ slug: req.params.categoryId });

    if (!category) {
      return res.status(404).json({ success: false, message: 'Kateqoriya tapılmadı' });
    }

    res.status(200).json({ success: true, data: formatCategory(category) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Kateqoriya silinmədi', error: error.message });
  }
};

exports.getContactCourseOptions = async (req, res) => {
  try {
    const options = await ContactCourseOption.find({}).sort({ order: 1, createdAt: 1 });

    res.status(200).json({
      success: true,
      data: options.map(formatContactCourseOption)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Əlaqə seçimləri alınmadı', error: error.message });
  }
};

exports.getPublicContactCourseOptions = async (req, res) => {
  try {
    const options = await ContactCourseOption.find({ isActive: true }).sort({ order: 1, createdAt: 1 });

    res.status(200).json({
      success: true,
      data: options.map(formatContactCourseOption)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Əlaqə seçimləri alınmadı', error: error.message });
  }
};

exports.createContactCourseOption = async (req, res) => {
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';

    if (!title) {
      return res.status(400).json({ success: false, message: 'Seçim başlığı məcburidir' });
    }

    const option = await ContactCourseOption.create({
      title,
      description: typeof req.body.description === 'string' ? req.body.description.trim() : '',
      order: Number(req.body.order) || 0,
      isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true
    });

    res.status(201).json({ success: true, data: formatContactCourseOption(option) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Seçim yaradılmadı', error: error.message });
  }
};

exports.deleteContactCourseOption = async (req, res) => {
  try {
    const option = await ContactCourseOption.findByIdAndDelete(req.params.optionId);

    if (!option) {
      return res.status(404).json({ success: false, message: 'Seçim tapılmadı' });
    }

    res.status(200).json({ success: true, data: formatContactCourseOption(option) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Seçim silinmədi', error: error.message });
  }
};