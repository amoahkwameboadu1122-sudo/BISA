const { endpoint, jsonResponse, signStorageObject, supabaseRequest } = require('../lib/bisa');

module.exports = endpoint(['GET'], async (req, res) => {
  const businesses = await supabaseRequest(
    '/rest/v1/businesses?select=*,categories(name),products_services(*),business_media(id,media_type,file_name,storage_path)&status=eq.published&order=is_featured.desc,created_at.desc&limit=100'
  );
  const listings = await Promise.all((businesses || []).map(async (business) => {
    const media = await Promise.all((business.business_media || [])
      .filter((item) => item.media_type === 'image')
        .slice(0, 1)
      .map(async (item) => ({ ...item, url: await signStorageObject(item.storage_path) })));
    return { ...business, business_media: media };
  }));
  jsonResponse(res, 200, { businesses: listings });
});
