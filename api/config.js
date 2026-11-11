const { endpoint, getSupabaseConfig, jsonResponse } = require('../lib/bisa');

module.exports = endpoint(['GET'], (req, res) => {
  const { url, anonKey } = getSupabaseConfig();
  jsonResponse(res, 200, { url, anonKey });
});
