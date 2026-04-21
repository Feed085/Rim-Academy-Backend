const express = require('express');
const { register, login, googleLogin } = require('../controllers/teacherAuthController');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);

module.exports = router;
