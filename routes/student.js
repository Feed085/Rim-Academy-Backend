const express = require('express');
const { getMe, updateProfile, markLessonCompleted } = require('../controllers/studentController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.route('/me')
  .get(protect, getMe)
  .put(protect, updateProfile);

router.post('/progress', protect, markLessonCompleted);

module.exports = router;
