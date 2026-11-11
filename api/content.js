const { endpoint, jsonResponse, supabaseRequest } = require('../lib/bisa');

const publicKeys = [
  'home.hero_title',
  'home.hero_text',
  'home.announcement',
  'contact.email',
  'contact.phone',
  'contact.location'
];

module.exports = endpoint(['GET'], async (req, res) => {
  const query = publicKeys.map(encodeURIComponent).join(',');
  const values = await supabaseRequest(`/rest/v1/site_content?select=key,value&key=in.(${query})`);
  const content = {};
  values.forEach((entry) => {
    content[entry.key] = entry.value;
  });
  jsonResponse(res, 200, { content });
});
