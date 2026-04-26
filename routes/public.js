const express = require('express');
const { getPublicStats, getPublicContactCourseOptions } = require('../controllers/adminController');

const router = express.Router();

router.get('/stats', getPublicStats);
router.get('/contact-course-options', getPublicContactCourseOptions);

module.exports = router;