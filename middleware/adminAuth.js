const jwt = require('jsonwebtoken');

exports.protectAdmin = (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Bu rotaya erişmek üçün admin girişi tələb olunur' });
  }

  try {
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET);

    if (decoded.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Bu rotaya erişim icazəsi yoxdur' });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Geçersiz admin token' });
  }
};