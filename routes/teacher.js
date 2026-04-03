const express = require('express');
const { getMe, updateProfile, getTeacherStudents } = require('../controllers/teacherProfileController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.route('/me')
  .get(protect, getMe)
  .put(protect, updateProfile);

router.route('/students')
  .get(protect, getTeacherStudents);

module.exports = router;
