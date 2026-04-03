const express = require('express');
const { getMe, updateProfile } = require('../controllers/teacherProfileController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.route('/me')
  .get(protect, getMe)
  .put(protect, updateProfile);

module.exports = router;
