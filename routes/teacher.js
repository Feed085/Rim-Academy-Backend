const express = require('express');
const { getMe, updateProfile, getTeacherStudents, getPublicTeacher, getPublicTeachers, addTeacherReview } = require('../controllers/teacherProfileController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.route('/me')
  .get(protect, getMe)
  .put(protect, updateProfile);

router.route('/students')
  .get(protect, getTeacherStudents);

router.route('/public')
  .get(getPublicTeachers);

router.route('/public/:id')
  .get(getPublicTeacher);

router.route('/public/:id/reviews')
  .post(protect, addTeacherReview);

module.exports = router;
