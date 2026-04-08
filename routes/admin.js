const express = require('express');
const {
  getDashboard,
  getTeachers,
  updateTeacher,
  deleteTeacher,
  getStudents,
  assignStudentItem,
  getCourses,
  getTests,
  getCategories,
  createCategory,
  deleteCategory
} = require('../controllers/adminController');

const router = express.Router();

router.get('/dashboard', getDashboard);
router.get('/teachers', getTeachers);
router.put('/teachers/:teacherId', updateTeacher);
router.delete('/teachers/:teacherId', deleteTeacher);
router.get('/students', getStudents);
router.post('/students/:studentId/assignments', assignStudentItem);
router.get('/courses', getCourses);
router.get('/tests', getTests);
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.delete('/categories/:categoryId', deleteCategory);

module.exports = router;