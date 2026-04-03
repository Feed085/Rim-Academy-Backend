const jwt = require('jsonwebtoken');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');

exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Bu rotaya erişmek için yetkiniz yok (Token eksik)' });
  }

  try {
    // Tokeni onayla
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === 'teacher') {
      req.user = await Teacher.findById(decoded.id);
    } else {
      req.user = await Student.findById(decoded.id);
    }

    if (!req.user) {
       return res.status(401).json({ success: false, message: 'Bu tokena ait kullanıcı bulunamadı' });
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Geçersiz token veya yetkisiz erişim' });
  }
};
