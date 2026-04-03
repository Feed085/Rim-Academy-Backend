const express = require('express');
const multer = require('multer');
const { uploadToR2, generatePresignedUrl } = require('../utils/s3Upload');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Yaddaşda (RAM) saxlayıb R2-yə atmaq üçün Storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// @route   GET /api/upload/presign
// @desc    Direct R2 upload üçün Pre-signed URL al
// @access  Private
router.get('/presign', protect, async (req, res) => {
  try {
    const { filename, contentType } = req.query;
    
    if (!filename || !contentType) {
      return res.status(400).json({ success: false, message: 'filename və contentType tələb olunur' });
    }

    const folder = contentType.startsWith('video') ? 'videos' : 'images';
    const { signedUrl, publicUrl } = await generatePresignedUrl(filename, contentType, folder);
    
    res.status(200).json({
      success: true,
      data: {
        signedUrl,
        publicUrl
      }
    });
  } catch (error) {
    console.error('Presigned URL Error:', error);
    res.status(500).json({ success: false, message: 'Presigned URL yaradıla bilmədi', error: error.message });
  }
});

// @route   POST /api/upload
// @desc    R2-yə fayl (şəkil və ya video) yüklə
// @access  Private
router.post('/', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Fayl tapılmadı' });
    }

    // Fayl növünə görə qovluq seçimi
    const folder = req.file.mimetype.startsWith('video') ? 'videos' : 'images';
    
    // R2-yə yüklə
    const fileUrl = await uploadToR2(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      folder
    );

    res.status(200).json({
      success: true,
      data: { url: fileUrl }
    });
  } catch (error) {
    console.error('S3 Upload Error:', error);
    res.status(500).json({ success: false, message: 'Fayl yüklənə bilmədi', error: error.message });
  }
});

module.exports = router;
