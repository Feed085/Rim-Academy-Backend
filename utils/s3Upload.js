const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');
const crypto = require('crypto');

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true, // R2 virtual-hosted style dəstəkləmir, path-style məcburidir
});

exports.uploadToR2 = async (fileBuffer, originalName, mimeType, folder = 'uploads') => {
  const extension = path.extname(originalName);
  const randomName = crypto.randomBytes(16).toString('hex');
  // Fayl adı nümunə: uploads/a1b2c3d4.jpg
  const fileName = `${folder}/${randomName}${extension}`;

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: fileName,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);

  // Return the full public URL
  return `${process.env.R2_PUBLIC_URL}/${fileName}`;
};

exports.generatePresignedUrl = async (filename, contentType, folder = 'videos') => {
  const fileExt = path.extname(filename);
  const fileNameWithoutExt = path.basename(filename, fileExt).replace(/[^a-zA-Z0-9]/g, '');
  const uniqueName = `${folder}/${fileNameWithoutExt}-${Date.now()}${fileExt}`;

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: uniqueName,
    ContentType: contentType,
  });

  // Pre-signed URL generation (Expiries in 1 hour)
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  const publicUrl = `${process.env.R2_PUBLIC_URL}/${uniqueName}`;

  return { signedUrl, publicUrl };
};
