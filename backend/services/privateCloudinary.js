import { v2 as cloudinary } from 'cloudinary';
export function privateCloudinaryReference(publicId, format = 'jpg') {
  if (!publicId || !/^(jpg|jpeg|png|webp)$/i.test(format)) throw new Error('Invalid private image');
  return `clda://${encodeURIComponent(publicId)}/${format.toLowerCase()}`;
}
export function parsePrivateCloudinary(value) {
  if (typeof value !== 'string') return null;
  const match = /^clda:\/\/([A-Za-z0-9_%~.!'()*-]+)\/(jpg|jpeg|png|webp)$/.exec(value);
  if (!match) return null;
  try { return { publicId: decodeURIComponent(match[1]), format: match[2] }; } catch { return null; }
}
export function privateCloudinaryUrl(reference) {
  const image = parsePrivateCloudinary(reference);
  if (!image) throw new Error('Invalid private image reference');
  return cloudinary.utils.private_download_url(image.publicId, image.format, {
    type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 60,
  });
}
export async function deletePrivateCloudinary(reference) {
  const image = parsePrivateCloudinary(reference);
  if (!image) throw new Error('Invalid private image reference');
  return cloudinary.uploader.destroy(image.publicId, { type: 'authenticated', invalidate: true });
}
