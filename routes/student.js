const express = require('express');
const { getMe } = require('../controllers/studentController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/me', protect, getMe);

module.exports = router;
