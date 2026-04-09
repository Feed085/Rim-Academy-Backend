const Course = require('../models/Course');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Test = require('../models/Test');
const Category = require('../models/Category');

const defaultCategories = [
  { name: 'Dil Kursları', slug: 'language', color: '#00D084', icon: 'BookOpen', order: 1 },
  { name: 'Komputer Kursları', slug: 'computer', color: '#2563EB', icon: 'Laptop', order: 2 },
  { name: 'Programlaşdırma Kursları', slug: 'programming', color: '#7C3AED', icon: 'Code2', order: 3 },
  { name: 'İmtahan Hazırlığı', slug: 'exam', color: '#F97316', icon: 'GraduationCap', order: 4 }
];

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

const ensureCategories = async () => {
  const count = await Category.countDocuments();

  if (count === 0) {
    await Category.insertMany(defaultCategories.map((category) => ({
      ...category,
      order: category.order || 0
    })));
  }
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
      Course.countDocuments({ isActive: true, publishDate: { $lte: now } }),
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
      Teacher.find().sort({ createdAt: -1 }).limit(5),
      Course.find({ isActive: true, publishDate: { $lte: now } })
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
          {
            key: 'revenue',
            label: 'Aylıq Gəlir',
            value: null,
            displayValue: 'Hazırlanır',
            trendLabel: 'Sonra aktivləşəcək',
            trendType: 'neutral',
            note: 'Kazanç sistemi tam qurulmayıb'
          }
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

exports.getTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find().sort({ createdAt: -1 });
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

    Object.keys(updateData).forEach((key) => updateData[key] === undefined && delete updateData[key]);

    const teacher = await Teacher.findByIdAndUpdate(req.params.teacherId, updateData, {
      new: true,
      runValidators: true
    });

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Müəllim tapılmadı' });
    }

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

    await Course.updateMany(
      { instructor: teacher._id },
      { $set: { isActive: false } }
    );

    await Test.deleteMany({ instructor: teacher._id });
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
      .populate('assignedTests', 'title course instructor duration')
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

exports.assignStudentItem = async (req, res) => {
  try {
    const { type, targetId } = req.body;

    if (!type || !targetId) {
      return res.status(400).json({ success: false, message: 'type və targetId mütləqdir' });
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

      if (alreadyAssigned) {
        return res.status(400).json({ success: false, message: 'Bu kurs artıq tələbəyə verilib' });
      }

      student.activeCourses.push(course._id);
    } else if (type === 'test') {
      const test = await Test.findById(targetId);

      if (!test) {
        return res.status(404).json({ success: false, message: 'Test tapılmadı' });
      }

      const alreadyAssigned = (student.assignedTests || []).some((testId) => testId.toString() === targetId);

      if (alreadyAssigned) {
        return res.status(400).json({ success: false, message: 'Bu test artıq tələbəyə verilib' });
      }

      student.assignedTests = student.assignedTests || [];
      student.assignedTests.push(test._id);
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
    res.status(500).json({ success: false, message: 'Atama tamamlanmadı', error: error.message });
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

exports.getCategories = async (req, res) => {
  try {
    await ensureCategories();
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
      return res.status(400).json({ success: false, message: 'Kateqoriya adı zorunludur' });
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