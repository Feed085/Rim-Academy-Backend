const express = require('express');
const {
  createCourse,
  getCourses,
  getCourse,
  getTeacherCourses,
  updateCourse
} = require('../controllers/courseController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.route('/')
  .get(getCourses) // Public: Aktiv kursları siyahılar
  .post(protect, createCourse); // Private: Müəllim kurs yaradır

router.route('/my-courses')
  .get(protect, getTeacherCourses); // Private: Öz kurslarını idarə panelində görmək

router.route('/:id')
  .get(getCourse) // Public: Detaylar
  .put(protect, updateCourse); // Private: Müəllim öz kursunu güncəlləyir

module.exports = router;
