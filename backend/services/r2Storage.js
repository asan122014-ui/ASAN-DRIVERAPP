import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';

const envNames = ['R2_ACCOUNT_ID', 'R2_BUCKET_NAME', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
export function r2Enabled(env = process.env) {
  const present = envNames.filter(name => env[name]);
  if (present.length && present.length !== envNames.length) throw new Error('R2 configuration is incomplete');
  return present.length === envNames.length;
}
let client;
function connection() {
  if (!r2Enabled()) throw new Error('R2 is not configured');
  if (!/^[a-f0-9]{32}$/i.test(process.env.R2_ACCOUNT_ID)) throw new Error('Invalid R2 account ID');
  client ||= new S3Client({ region: 'auto', endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }, maxAttempts: 3 });
  return { client, Bucket: process.env.R2_BUCKET_NAME };
}
export const isR2Reference = value => typeof value === 'string' && /^r2:\/\/asan\/[a-z-]+\/[a-f0-9-]{36}\.jpg$/.test(value);
function key(reference) {
  if (!isR2Reference(reference)) throw new Error('Invalid R2 file reference');
  return reference.slice(5);
}
export async function uploadR2Image(buffer, folder) {
  if (!/^[a-z-]+$/.test(folder)) throw new Error('Invalid storage folder');
  const image = await sharp(buffer, { limitInputPixels: 40000000 }).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  const { client, Bucket } = connection();
  const Key = `asan/${folder}/${randomUUID()}.jpg`;
  await client.send(new PutObjectCommand({ Bucket, Key, Body: image, ContentType: 'image/jpeg', CacheControl: 'private, no-store' }), { abortSignal: AbortSignal.timeout(30000) });
  return { public_id: `r2://${Key}`, format: 'jpg', bytes: image.length };
}
export async function r2ReadUrl(reference) {
  const { client, Bucket } = connection();
  return getSignedUrl(client, new GetObjectCommand({ Bucket, Key: key(reference), ResponseCacheControl: 'private, no-store' }), { expiresIn: 3600 });
}
export async function deleteR2Image(reference) {
  const { client, Bucket } = connection();
  await client.send(new DeleteObjectCommand({ Bucket, Key: key(reference) }), { abortSignal: AbortSignal.timeout(20000) });
}

// Keep persistent provider references in MongoDB; sign copies only after a route
// has selected the records its caller is entitled to receive.
export async function resolveMediaReferences(payload, sign = r2ReadUrl) {
  if (payload === undefined) return payload;
  const data = JSON.parse(JSON.stringify(payload));
  const urls = new Map();
  async function visit(value, field = '') {
    if (isR2Reference(value)) {
      if (['publicId', 'public_id', 'filename'].includes(field)) return value;
      if (!urls.has(value)) urls.set(value, sign(value));
      return urls.get(value);
    }
    if (Array.isArray(value)) return Promise.all(value.map(item => visit(item, field)));
    if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([name,item]) => [name, await visit(item,name)])));
    return value;
  }
  return visit(data);
}

export function privateMediaResponses(req, res, next) {
  const json = res.json.bind(res);
  res.json = payload => {
    if (!JSON.stringify(payload)?.includes('r2://')) return json(payload);
    resolveMediaReferences(payload).then(result => { res.set('Cache-Control','private, no-store'); json(result); }).catch(() => {
      if (!res.headersSent) res.status(503).send({ success: false, message: 'Documents are temporarily unavailable. Please refresh and try again.' });
    });
    return res;
  };
  next();
}

export function combinedStorage(cloudinaryStorage, folder, { profileOnCloudinary = false } = {}) {
  return {
    _handleFile(req, file, callback) {
      let completed = false;
      const done = (...args) => { if (!completed) { completed = true; callback(...args); } };
      let enabled;
      try { enabled = r2Enabled(); } catch (error) { return callback(error); }
      if (!enabled || (profileOnCloudinary && file.fieldname === 'profilePhoto')) return cloudinaryStorage._handleFile(req,file,callback);
      const chunks = [];
      let size = 0;
      file.stream.on('data', chunk => { size += chunk.length; if (size <= 10*1024*1024) chunks.push(chunk); });
      file.stream.on('error',done);
      file.stream.on('end', async () => {
        if (completed) return;
        if (file.stream.truncated || size > 10*1024*1024) return done(new Error('Image exceeds 10 MB'));
        try {
          const result = await uploadR2Image(Buffer.concat(chunks),folder);
          done(null,{ path: result.public_id, filename: result.public_id, size: result.bytes, format:'jpg', resource_type:'image' });
        } catch { done(new Error('Private document upload failed. Please retry.')); }
      });
    },
    _removeFile(req,file,callback) {
      if (isR2Reference(file.filename)) return deleteR2Image(file.filename).then(()=>callback(null)).catch(callback);
      return cloudinaryStorage._removeFile(req,file,callback);
    },
  };
}
