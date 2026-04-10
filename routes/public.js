const express = require('express');
const { getPublicStats } = require('../controllers/adminController');

const router = express.Router();

router.get('/stats', getPublicStats);

module.exports = router;