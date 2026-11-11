const {
  assert,
  downloadStoragePrefix,
  endpoint,
  jsonResponse,
  recordActivity,
  supabaseRequest
} = require('../lib/bisa');

function normalizeGhanaPhone(phone) {
  const normalized = String(phone || '').trim().replace(/[^\d+]/g, '');
  if (/^0\d{9}$/.test(normalized)) return `+233${normalized.slice(1)}`;
  if (/^233\d{9}$/.test(normalized)) return `+${normalized}`;
  return normalized;
}

module.exports = endpoint(['POST'], async (req, res) => {
  const body = req.body || {};
  const applicantName = String(body.applicantName || '').trim();
  const businessName = String(body.businessName || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = normalizeGhanaPhone(body.phone);
  const category = String(body.category || '').trim();
  const location = String(body.location || '').trim();
  const description = String(body.description || '').trim();
  const offerings = String(body.offerings || '').trim();
  const batchId = String(body.batchId || '');
  const requestedMedia = Array.isArray(body.media) ? body.media : [];

  assert(applicantName && businessName && email && phone && category && location && description && offerings, 'Complete all required application fields.');
  assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Enter a valid email address.');
  assert(/^\+233\d{9}$/.test(phone), 'Enter a valid Ghanaian phone number.');
  assert(applicantName.length <= 160 && businessName.length <= 160 && location.length <= 200, 'A name or location is too long.');
  assert(description.length <= 5000 && offerings.length <= 3000, 'The business description or offerings are too long.');
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(batchId), 'The upload session is invalid. Please select your files again.');

  const objects = await supabaseRequest('/storage/v1/object/list/business-media', {
    method: 'POST',
    body: JSON.stringify({ prefix: `applications/${batchId}`, limit: 100, offset: 0 })
  });
  const uploads = (objects || []).filter((item) => item.name && item.metadata);
  const requestedPaths = new Set(requestedMedia.map((item) => String(item.path || '')));
  assert(requestedMedia.length === uploads.length, 'One or more selected files were not uploaded.');
  assert(uploads.every((item) => requestedPaths.has(`applications/${batchId}/${item.name}`)), 'Uploaded files do not match this application.');
  const images = uploads.filter((item) => /^image\/(jpeg|png|webp|gif)$/.test(item.metadata.mimetype || ''));
  const videos = uploads.filter((item) => /^video\/(mp4|webm|quicktime)$/.test(item.metadata.mimetype || ''));
  assert(images.length >= 3, 'Upload at least three supported business photos before submitting.');
  assert(images.length + videos.length === uploads.length, 'One or more uploaded files use an unsupported format.');
  assert(images.every((item) => Number(item.metadata.size) <= 5 * 1024 * 1024), 'Each business photo must be under 5MB.');
  assert(videos.length <= 1 && videos.every((item) => Number(item.metadata.size) <= 25 * 1024 * 1024), 'Only one video up to 25MB is allowed.');
  for (const file of uploads) {
    const prefix = await downloadStoragePrefix(`applications/${batchId}/${file.name}`);
    const mimeType = file.metadata.mimetype;
    const is = (text, offset = 0) => Array.from(text).every((character, index) => prefix[offset + index] === character.charCodeAt(0));
    const valid = mimeType === 'image/jpeg' ? prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff
      : mimeType === 'image/png' ? is('\x89PNG\r\n\x1a\n')
        : mimeType === 'image/gif' ? is('GIF8')
          : mimeType === 'image/webp' ? is('RIFF') && is('WEBP', 8)
            : mimeType === 'video/webm' ? is('\x1aE\xdf\xa3')
              : ['video/mp4', 'video/quicktime'].includes(mimeType) && is('ftyp', 4);
    assert(valid, `An uploaded file does not match its stated ${mimeType || 'file'} format.`);
  }

  const categoryRows = await supabaseRequest(
    `/rest/v1/categories?select=id&name=eq.${encodeURIComponent(category)}&limit=1`
  );
  assert(categoryRows.length, 'Select a valid business category.');

  const referenceCode = `BISA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const applications = await supabaseRequest('/rest/v1/business_applications', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify([{
      applicant_name: applicantName,
      business_name: businessName,
      email,
      phone,
      category_id: categoryRows[0].id,
      campus_location: location,
      description,
      offerings,
      status: 'PENDING',
      reference_code: referenceCode
    }])
  });
  const application = applications[0];

  try {
    await supabaseRequest('/rest/v1/business_media', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(uploads.map((file) => ({
        application_id: application.id,
        media_type: images.includes(file) ? 'image' : 'video',
        file_name: String(requestedMedia.find((item) => item.path === `applications/${batchId}/${file.name}`)?.name || file.name).slice(0, 255),
        bucket_name: 'business-media',
        storage_path: `applications/${batchId}/${file.name}`
      })))
    });
    await recordActivity(application.id, null, 'APPLICATION_SUBMITTED', `Application ${referenceCode} received.`);
  } catch (error) {
    await supabaseRequest(`/rest/v1/business_applications?id=eq.${encodeURIComponent(application.id)}`, {
      method: 'DELETE'
    });
    throw error;
  }

  jsonResponse(res, 201, { reference: referenceCode, status: 'PENDING' });
});
