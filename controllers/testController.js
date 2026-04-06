const Test = require('../models/Test');
const TestResult = require('../models/TestResult');

// @desc    Müəllim üçün yeni test yarat
// @route   POST /api/tests
// @access  Private (Teacher)
exports.createTest = async (req, res) => {
  try {
    const { title, course, duration, questions } = req.body;

    const newTest = await Test.create({
      title,
      course,
      instructor: req.user.id,
      duration,
      questions
    });

    res.status(201).json({
      success: true,
      data: newTest
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Hatası', error: error.message });
  }
};

// @desc    Kursun bütün testlərini gətir
// @route   GET /api/tests/course/:courseId
// @access  Private
exports.getTestsByCourse = async (req, res) => {
  try {
    const tests = await Test.find({ course: req.params.courseId });
    res.status(200).json({
      success: true,
      data: tests
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Hatası', error: error.message });
  }
};

// @desc    Test məlumatlarını gətir
// @route   GET /api/tests/:id
// @access  Private
exports.getTestById = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test tapılmadı' });
    }
    res.status(200).json({
      success: true,
      data: test
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Hatası', error: error.message });
  }
};

// @desc    Tələbə testi cavablayıb təslim edir
// @route   POST /api/tests/:id/submit
// @access  Private (Student)
exports.submitTest = async (req, res) => {
  try {
    const { answers } = req.body; // array of { questionId, answer }
    const testId = req.params.id;

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test tapılmadı' });
    }

    let correctCount = 0;
    let totalQuestions = test.questions.length;
    let hasPending = false;

    const processedAnswers = answers.map(studentAns => {
      const q = test.questions.find(x => x._id.toString() === studentAns.questionId);
      
      let isCorrect = false;
      let status = 'graded';

      if (q) {
        if (q.answerType === 'multiple_choice') {
          if (q.correctAnswer === studentAns.answer) {
            isCorrect = true;
            correctCount++;
          }
        } else if (q.answerType === 'open_ended') {
          status = 'pending';
          hasPending = true;
          // Open ended sayılmır başlanğıcda (Müəllim düz xallayanda ümumi bal hesabı dəyişəcək)
        }
      }

      return {
        questionId: studentAns.questionId,
        answer: studentAns.answer,
        isCorrect,
        status
      };
    });

    const scorePercentage = (correctCount / totalQuestions) * 100;

    const result = await TestResult.create({
      test: testId,
      student: req.user.id,
      answers: processedAnswers,
      scorePercentage: scorePercentage,
      hasPendingAnswers: hasPending
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Hatası', error: error.message });
  }
};

// @desc    Müəllim gözləmədəki (open_ended) sualları dəyərləndirir
// @route   PUT /api/tests/results/:resultId/evaluate
// @access  Private (Teacher)
exports.evaluateOpenEnded = async (req, res) => {
  try {
    const { evaluations } = req.body; // [{ questionId, isCorrect: true/false }]
    const resultId = req.params.resultId;

    const testResult = await TestResult.findById(resultId).populate('test');
    if (!testResult) {
      return res.status(404).json({ success: false, message: 'Nəticə tapılmadı' });
    }

    // Əgər müəllim bu testə aid deyilsə yoxlayaq:
    if (testResult.test.instructor.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'İcazə rədd edildi' });
    }

    evaluations.forEach(entry => {
      const ans = testResult.answers.find(a => a.questionId.toString() === entry.questionId);
      if (ans && ans.status === 'pending') {
        ans.isCorrect = entry.isCorrect;
        ans.status = 'graded';
      }
    });

    // Yenidən hesabla
    let correctCount = testResult.answers.filter(a => a.isCorrect).length;
    let totalQuestions = testResult.test.questions.length;

    testResult.scorePercentage = (correctCount / totalQuestions) * 100;
    
    // Hələ pending varmı?
    testResult.hasPendingAnswers = testResult.answers.some(a => a.status === 'pending');
    
    await testResult.save();

    res.status(200).json({
      success: true,
      data: testResult
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Hatası', error: error.message });
  }
};

// @desc    Tələbə öz testlərinin nəticələrini alır
// @route   GET /api/tests/results/my
// @access  Private (Student)
exports.getMyTestResults = async (req, res) => {
  try {
    const results = await TestResult.find({ student: req.user.id })
       .populate({
         path: 'test',
         select: 'title course duration',
         populate: {
           path: 'course',
           select: 'title instructor',
           populate: {
             path: 'instructor',
             select: 'name surname'
           }
         }
       });
    
    res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Hatası', error: error.message });
  }
};

// @desc    Müəllim öz testlərinin tələbə nəticələrini alır
// @route   GET /api/tests/:id/results
// @access  Private (Teacher)
exports.getTestResultsForTeacher = async (req, res) => {
  try {
    const results = await TestResult.find({ test: req.params.id })
      .populate('student', 'name surname email');

    res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Hatası', error: error.message });
  }
};
