const express = require('express');
const {
  createTest,
  updateTest,
  deleteTest,
  getTestsByCourse,
  getMyTests,
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

router.route('/results/my')
  .get(protect, getMyTestResults);

router.route('/results/:resultId/evaluate')
  .put(protect, evaluateOpenEnded);

router.route('/course/:courseId')
  .get(protect, getTestsByCourse);

router.route('/my')
  .get(protect, getMyTests);

router.route('/:id/submit')
  .post(protect, submitTest);

router.route('/:id/results')
  .get(protect, getTestResultsForTeacher);

router.route('/:id')
  .get(protect, getTestById)
  .put(protect, updateTest)
  .delete(protect, deleteTest);

module.exports = router;
