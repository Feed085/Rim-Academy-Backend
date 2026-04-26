const express = require('express');
const { protectAdmin } = require('../middleware/adminAuth');
const {
  getDashboard,
  getTeachers,
  updateTeacher,
  deleteTeacher,
  getStudents,
  getStudentTestResults,
  getTestResults,
  assignStudentItem,
  getCourses,
  getTests,
  getCategories,
  createCategory,
  deleteCategory,
  getContactCourseOptions,
  createContactCourseOption,
  deleteContactCourseOption
} = require('../controllers/adminController');

const router = express.Router();

router.use(protectAdmin);

router.get('/dashboard', getDashboard);
router.get('/teachers', getTeachers);
router.put('/teachers/:teacherId', updateTeacher);
router.delete('/teachers/:teacherId', deleteTeacher);
router.get('/students', getStudents);
router.get('/students/:studentId/test-results', getStudentTestResults);
router.post('/students/:studentId/assignments', assignStudentItem);
router.get('/courses', getCourses);
router.get('/tests', getTests);
router.get('/tests/:testId/results', getTestResults);
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.delete('/categories/:categoryId', deleteCategory);
router.get('/contact-course-options', getContactCourseOptions);
router.post('/contact-course-options', createContactCourseOption);
router.delete('/contact-course-options/:optionId', deleteContactCourseOption);

module.exports = router;