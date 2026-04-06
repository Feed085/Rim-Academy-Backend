const express = require('express');
const {
  createTest,
  getTestsByCourse,
  getTestById,
  submitTest,
  evaluateOpenEnded,
  getMyTestResults,
  getTestResultsForTeacher
} = require('../controllers/testController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.route('/')
  .post(protect, createTest);

router.route('/course/:courseId')
  .get(protect, getTestsByCourse);

router.route('/:id')
  .get(protect, getTestById);

router.route('/:id/submit')
  .post(protect, submitTest);

router.route('/results/my')
  .get(protect, getMyTestResults);

router.route('/:id/results')
  .get(protect, getTestResultsForTeacher);

router.route('/results/:resultId/evaluate')
  .put(protect, evaluateOpenEnded);

module.exports = router;
