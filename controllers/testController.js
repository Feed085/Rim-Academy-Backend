const Test = require('../models/Test');
const TestResult = require('../models/TestResult');

const normalizeNumericAnswer = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const parsedValue = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const isNumericOpenEndedQuestion = (question) => {
  if (!question || question.answerType !== 'open_ended') {
    return false;
  }

  if (question.openEndedAnswerType === 'number' || question.openEndedAnswerType === 'selective') {
    return true;
  }

  return normalizeNumericAnswer(question.correctAnswer) !== null;
};

const normalizeMultipleChoiceAnswer = (value) => {
  const parsedValue = Number(String(value).trim());
  return Number.isInteger(parsedValue) && parsedValue >= 0 ? parsedValue : null;
};

const getMultipleChoiceCorrectAnswerIndex = (question) => {
  const storedIndex = normalizeMultipleChoiceAnswer(question?.correctAnswer);
  if (storedIndex !== null) {
    return storedIndex;
  }

  if (!question?.options?.length) {
    return null;
  }

  const fallbackIndex = question.options.findIndex(option => option === question.correctAnswer);
  return fallbackIndex >= 0 ? fallbackIndex : null;
};

// @desc    Müəllim üçün yeni test yarat
// @route   POST /api/tests
// @access  Private (Teacher)
exports.createTest = async (req, res) => {
  try {
    const { title, course, duration, allowRetake, questions } = req.body;

    const newTest = await Test.create({
      title,
      course,
      instructor: req.user.id,
      duration,
      allowRetake: allowRetake ?? false,
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

// @desc    Müəllim üçün testi yenilə
// @route   PUT /api/tests/:id
// @access  Private (Teacher)
exports.updateTest = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, duration, allowRetake, questions } = req.body;

    const test = await Test.findById(id);

    if (!test) {
      return res.status(404).json({ success: false, message: 'Test tapılmadı' });
    }

    if (test.instructor.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'İcazə rədd edildi' });
    }

    test.title = title ?? test.title;
    test.duration = duration ?? test.duration;
    test.allowRetake = allowRetake ?? test.allowRetake;
    if (Array.isArray(questions)) {
      test.questions = questions;
    }

    const updatedTest = await test.save();

    res.status(200).json({
      success: true,
      data: updatedTest
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Hatası', error: error.message });
  }
};

// @desc    Müəllim üçün testi sil
// @route   DELETE /api/tests/:id
// @access  Private (Teacher)
exports.deleteTest = async (req, res) => {
  try {
    const { id } = req.params;

    const test = await Test.findById(id);

    if (!test) {
      return res.status(404).json({ success: false, message: 'Test tapılmadı' });
    }

    if (test.instructor.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'İcazə rədd edildi' });
    }

    await Test.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Test silindi'
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

// @desc    Müəllimin bütün testlərini gətir
// @route   GET /api/tests/my
// @access  Private (Teacher)
exports.getMyTests = async (req, res) => {
  try {
    const tests = await Test.find({ instructor: req.user.id })
      .populate('course', 'title category image instructor');

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

    const existingResult = await TestResult.findOne({ test: testId, student: req.user.id });
    if (existingResult && !test.allowRetake) {
      return res.status(409).json({
        success: false,
        message: 'Bu test yalnız bir dəfə yazıla bilər'
      });
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
          const studentAnswerIndex = normalizeMultipleChoiceAnswer(studentAns.answer);
          const correctAnswerIndex = getMultipleChoiceCorrectAnswerIndex(q);

          if (studentAnswerIndex !== null && correctAnswerIndex !== null && studentAnswerIndex === correctAnswerIndex) {
            isCorrect = true;
            correctCount++;
          } else if (studentAnswerIndex === null && q.correctAnswer === studentAns.answer) {
            isCorrect = true;
            correctCount++;
          }
        } else if (q.answerType === 'open_ended') {
          if (isNumericOpenEndedQuestion(q)) {
            const studentNumericAnswer = normalizeNumericAnswer(studentAns.answer);
            const correctNumericAnswer = normalizeNumericAnswer(q.correctAnswer);

            if (studentNumericAnswer !== null && correctNumericAnswer !== null && studentNumericAnswer === correctNumericAnswer) {
              isCorrect = true;
              correctCount++;
            }
          } else {
            status = 'pending';
            hasPending = true;
            // Open ended text sayılmır başlanğıcda (Müəllim düz xallayanda ümumi bal hesabı dəyişəcək)
          }
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
         select: 'title course duration allowRetake',
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
