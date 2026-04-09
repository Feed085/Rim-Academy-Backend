const mongoose = require('mongoose');
require('dotenv').config();
const Student = require('./models/Student');
const Course = require('./models/Course');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/rim-academy', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
   console.log('Verilənlər bazasına qoşuldu...');
   
   const courses = await Course.find();
   const courseIds = courses.map(c => c._id);
   
   if (courseIds.length === 0) {
      console.log('Heç bir kurs tapılmadı.');
      process.exit(0);
   }

    await Student.updateMany({}, {
         $set: {
            activeCourses: courseIds,
            courseProgress: courseIds.map(courseId => ({
               course: courseId,
               completedLessonIds: [],
               lastAccessed: new Date()
            }))
         }
    });
   
   console.log('Bütün tələbə hesablarına mövcud olan bütün kurslar (test üçün) verildi!');
   process.exit(0);
}).catch(err => {
   console.error(err);
   process.exit(1);
});
