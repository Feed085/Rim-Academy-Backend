const { S3Client, PutObjectCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');
const crypto = require('crypto');

const normalizeBaseUrl = (value = '') => value.trim().replace(/\/+$/, '');

const splitBaseUrls = (value = '') => value
  .split(/[\s,]+/)
  .map(normalizeBaseUrl)
  .filter(Boolean);

const R2_PUBLIC_URL = normalizeBaseUrl(
  process.env.R2_PUBLIC_URL || process.env.R2_CUSTOM_DOMAIN || process.env.R2_PUBLIC_DOMAIN
);

const R2_PUBLIC_URL_ALIASES = new Set([
  ...splitBaseUrls(process.env.R2_PUBLIC_URL_ALIASES),
  ...splitBaseUrls(process.env.R2_DEV_PUBLIC_URL),
  ...splitBaseUrls(process.env.R2_DEV_DOMAIN)
]);

const isR2Host = (hostname = '') => hostname.endsWith('.r2.dev') || hostname.endsWith('.r2.cloudflarestorage.com');

const getPublicUrl = (fileName) => {
  if (!R2_PUBLIC_URL) {
    throw new Error('R2_PUBLIC_URL is not configured');
  }

  return `${R2_PUBLIC_URL}/${fileName}`;
};

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
  return getPublicUrl(fileName);
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
  const publicUrl = getPublicUrl(uniqueName);

  return { signedUrl, publicUrl };
};

exports.extractR2KeyFromUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const normalizedUrl = url.trim();
  if (!normalizedUrl) {
    return null;
  }

  const knownBaseUrls = [R2_PUBLIC_URL, ...R2_PUBLIC_URL_ALIASES].filter(Boolean);

  for (const baseUrl of knownBaseUrls) {
    if (normalizedUrl.startsWith(baseUrl)) {
      return normalizedUrl.slice(baseUrl.length).replace(/^\/+/, '');
    }
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    const pathname = parsedUrl.pathname.replace(/^\/+/, '');

    if (!pathname) {
      return null;
    }

    if (isR2Host(parsedUrl.hostname)) {
      const bucketPrefix = `${process.env.R2_BUCKET_NAME || ''}/`;

      if (bucketPrefix !== '/' && pathname.startsWith(bucketPrefix)) {
        return pathname.slice(bucketPrefix.length);
      }

      if (pathname === process.env.R2_BUCKET_NAME) {
        return '';
      }
    }

    return pathname;
  } catch {
    return null;
  }
};

exports.deleteR2ObjectsByUrls = async (urls = []) => {
  const keys = [...new Set(
    urls
      .map(exports.extractR2KeyFromUrl)
      .filter(Boolean)
  )];

  if (keys.length === 0) {
    return { deleted: 0 };
  }

  await s3Client.send(new DeleteObjectsCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Delete: {
      Objects: keys.map((key) => ({ Key: key })),
      Quiet: true
    }
  }));

  return { deleted: keys.length };
};
