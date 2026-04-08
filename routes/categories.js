const express = require('express');
const { getCategories } = require('../controllers/adminController');

const router = express.Router();

router.get('/', getCategories);

module.exports = router;