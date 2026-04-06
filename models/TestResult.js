const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.ObjectId,
    required: true
  },
  answer: {
    type: String, // Tələbənin seçdiyi şıq və ya yazdığı "açıq tipli" cavab
  },
  isCorrect: {
    type: Boolean, // Açıq tiplilər üçün default olaraq boş, sonradan true/false olur. Qapalı testlərdə anında yoxlanacaq.
  },
  status: {
    type: String,
    enum: ['graded', 'pending'], // Gözləmədəki sualları Teacher UI-də sarı edə biləcəyik
    default: 'graded'
  }
});

const testResultSchema = new mongoose.Schema({
  test: {
    type: mongoose.Schema.ObjectId,
    ref: 'Test',
    required: true
  },
  student: {
    type: mongoose.Schema.ObjectId,
    ref: 'Student',
    required: true
  },
  answers: [answerSchema],
  scorePercentage: {
    type: Number,
    // Yekun nəticə %. Əvvəlcə ancaq qapalı testlərin hesabından veriləcək, "pending" bitsə dəyişə bilər.
  },
  hasPendingAnswers: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('TestResult', testResultSchema);
