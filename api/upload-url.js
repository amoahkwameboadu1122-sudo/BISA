const { assert, encodeStoragePath, endpoint, getSupabaseConfig, jsonResponse, supabaseRequest } = require('../lib/bisa');

const imageTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif']
]);
const videoTypes = new Map([
  ['video/mp4', 'mp4'],
  ['video/webm', 'webm'],
  ['video/quicktime', 'mov']
]);

module.exports = endpoint(['POST'], async (req, res) => {
  const { batchId, contentType, size } = req.body || {};
  const extension = imageTypes.get(contentType) || videoTypes.get(contentType);
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(batchId || ''), 'Invalid upload session.');
  assert(extension, 'This file format is not supported. Use JPG, PNG, WEBP, GIF, MP4, WEBM or MOV.');
  const isImage = imageTypes.has(contentType);
  assert(Number.isFinite(size) && size > 0 && size <= (isImage ? 5 : 25) * 1024 * 1024, `The ${isImage ? 'image' : 'video'} exceeds the allowed file size.`);

  const path = `applications/${batchId}/${crypto.randomUUID()}.${extension}`;
  const result = await supabaseRequest(
    `/storage/v1/object/upload/sign/business-media/${encodeStoragePath(path)}`,
    { method: 'POST', body: JSON.stringify({ upsert: false }) }
  );
  const { url } = getSupabaseConfig();
  jsonResponse(res, 200, {
    path,
    signedUrl: `${url}${result.url.startsWith('/') ? result.url : `/${result.url}`}`,
    token: result.token,
    contentType
  });
});
