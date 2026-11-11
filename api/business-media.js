const {
  assert,
  downloadStoragePrefix,
  encodeStoragePath,
  endpoint,
  getSupabaseConfig,
  jsonResponse,
  requireAdmin,
  supabaseRequest
} = require('../lib/bisa');

const fileTypes = new Map([
  ['image/jpeg', { extension: 'jpg', mediaType: 'image', maxSize: 5 * 1024 * 1024 }],
  ['image/png', { extension: 'png', mediaType: 'image', maxSize: 5 * 1024 * 1024 }],
  ['image/webp', { extension: 'webp', mediaType: 'image', maxSize: 5 * 1024 * 1024 }],
  ['image/gif', { extension: 'gif', mediaType: 'image', maxSize: 5 * 1024 * 1024 }],
  ['video/mp4', { extension: 'mp4', mediaType: 'video', maxSize: 25 * 1024 * 1024 }],
  ['video/webm', { extension: 'webm', mediaType: 'video', maxSize: 25 * 1024 * 1024 }],
  ['video/quicktime', { extension: 'mov', mediaType: 'video', maxSize: 25 * 1024 * 1024 }]
]);

function isValidFile(bytes, mimeType) {
  const is = (text, offset = 0) => Array.from(text).every((character, index) => bytes[offset + index] === character.charCodeAt(0));
  if (mimeType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return is('\x89PNG\r\n\x1a\n');
  if (mimeType === 'image/gif') return is('GIF8');
  if (mimeType === 'image/webp') return is('RIFF') && is('WEBP', 8);
  if (mimeType === 'video/webm') return is('\x1aE\xdf\xa3');
  return ['video/mp4', 'video/quicktime'].includes(mimeType) && is('ftyp', 4);
}

module.exports = endpoint(['POST'], async (req, res) => {
  const { user } = await requireAdmin(req, ['super_admin', 'content_manager']);
  const body = req.body || {};
  const businessId = String(body.businessId || '');
  const action = String(body.action || '');
  assert(businessId, 'Select a business listing.');
  const businesses = await supabaseRequest(`/rest/v1/businesses?select=id,application_id&id=eq.${encodeURIComponent(businessId)}&limit=1`);
  assert(businesses.length, 'Business listing not found.', 404);

  if (action === 'create-upload') {
    const type = fileTypes.get(String(body.contentType || ''));
    assert(type && Number.isFinite(body.size) && body.size > 0 && body.size <= type.maxSize, 'The selected file type or size is not supported.');
    const path = `businesses/${businessId}/${crypto.randomUUID()}.${type.extension}`;
    const result = await supabaseRequest(
      `/storage/v1/object/upload/sign/business-media/${encodeStoragePath(path)}`,
      { method: 'POST', body: JSON.stringify({ upsert: false }) }
    );
    const { url } = getSupabaseConfig();
    return jsonResponse(res, 200, {
      path,
      signedUrl: `${url}${result.url.startsWith('/') ? result.url : `/${result.url}`}`,
      contentType: body.contentType
    });
  }

  if (action === 'save') {
    const media = Array.isArray(body.media) ? body.media : [];
    assert(media.length > 0, 'Select at least one photo or video.');
    assert(media.every((item) => String(item.path || '').startsWith(`businesses/${businessId}/`)), 'Media does not belong to this business.');
    const objects = await supabaseRequest('/storage/v1/object/list/business-media', {
      method: 'POST',
      body: JSON.stringify({ prefix: `businesses/${businessId}`, limit: 100, offset: 0 })
    });
    const files = media.map((item) => {
      const name = String(item.path).split('/').pop();
      const object = (objects || []).find((entry) => entry.name === name && entry.metadata);
      assert(object, 'A selected media file was not uploaded.');
      const mimeType = object.metadata.mimetype;
      const type = fileTypes.get(mimeType);
      assert(type && Number(object.metadata.size) <= type.maxSize, 'A selected file type or size is not supported.');
      return { item, name, mimeType, type };
    });
    const existing = await supabaseRequest(`/rest/v1/business_media?select=id,media_type&business_id=eq.${encodeURIComponent(businessId)}`);
    const imageCount = existing.filter((item) => item.media_type === 'image').length
      + files.filter((file) => file.type.mediaType === 'image').length;
    const videoCount = existing.filter((item) => item.media_type === 'video').length
      + files.filter((file) => file.type.mediaType === 'video').length;
    assert(imageCount >= 3, 'A published business profile must have at least three photos.');
    assert(videoCount <= 1, 'A business profile can have only one video.');
    for (const file of files) {
      const bytes = await downloadStoragePrefix(file.item.path);
      assert(isValidFile(bytes, file.mimeType), 'An uploaded file does not match its stated format.');
    }
    await supabaseRequest('/rest/v1/business_media', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(files.map(({ item, name, type }) => ({
        business_id: businessId,
        media_type: type.mediaType,
        file_name: String(item.name || name).slice(0, 255),
        bucket_name: 'business-media',
        storage_path: item.path
      })))
    });
    await supabaseRequest('/rest/v1/application_activity_logs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify([{
        application_id: businesses[0].application_id,
        actor_profile_id: user.id,
        action: 'BUSINESS_MEDIA_ADDED',
        details: `${files.length} media file(s) added.`
      }])
    });
    return jsonResponse(res, 201, { saved: files.length });
  }

  const error = new Error('Unknown business media action.');
  error.status = 404;
  throw error;
});
