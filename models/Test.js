const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionType: {
    type: String,
    enum: ['text', 'image'],
    required: true
  },
  content: {
    type: String, // Metn veya rəsm (image URL)
    required: true
  },
  answerType: {
    type: String,
    enum: ['multiple_choice', 'open_ended'],
    required: true
  },
  options: [{
    type: String // A, B, C, D variantları, "açıq tiplidə" boş qalır
  }],
  correctAnswer: {
    type: String,
    // "open_ended" - de bu boş ola bilər, manual yoxlanacaq
  }
});

const testSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Lütfən testin adını daxil edin']
  },
  course: {
    type: mongoose.Schema.ObjectId,
    ref: 'Course',
    required: true
  },
  instructor: {
    type: mongoose.Schema.ObjectId,
    ref: 'Teacher',
    required: true
  },
  duration: {
    type: Number, // Məsələn dəqiqə olaraq
    required: true
  },
  questions: [questionSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Test', testSchema);
