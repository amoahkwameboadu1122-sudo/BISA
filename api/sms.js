const { assert, endpoint, jsonResponse, requireAdmin, supabaseRequest } = require('../lib/bisa');

module.exports = endpoint(['POST'], async (req, res) => {
  const { user } = await requireAdmin(req, ['super_admin', 'application_manager']);
  const body = req.body || {};
  const applicationId = String(body.applicationId || '');
  const message = String(body.message || '').trim();
  assert(applicationId && message && message.length <= 1000, 'Choose an application and enter a message of 1,000 characters or fewer.');

  const applications = await supabaseRequest(
    `/rest/v1/business_applications?select=id,applicant_name,phone&id=eq.${encodeURIComponent(applicationId)}&limit=1`
  );
  assert(applications.length, 'Application not found.', 404);
  const application = applications[0];
  const apiKey = process.env.ARKESEL_API_KEY;
  const senderId = process.env.ARKESEL_SENDER_ID;
  assert(apiKey && senderId, 'SMS is not configured. Set ARKESEL_API_KEY and ARKESEL_SENDER_ID in Vercel.', 503);

  let response;
  let result;
  try {
    const params = new URLSearchParams({
      action: 'send-sms',
      api_key: apiKey,
      to: application.phone.replace(/^\+/, ''),
      from: senderId,
      sms: message
    });
    response = await fetch(`https://sms.arkesel.com/sms/api?${params}`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000)
    });
    result = await response.json();
  } catch (error) {
    result = { error: error.message || 'SMS provider request failed.' };
  }
  const accepted = Boolean(response?.ok && String(result?.code || '').toLowerCase() === 'ok');
  const notificationRows = await supabaseRequest('/rest/v1/notifications', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify([{
      application_id: application.id,
      recipient_phone: application.phone,
      template: String(body.template || 'Custom message'),
      message,
      type: 'sms',
      status: accepted ? 'sent' : 'failed',
      provider_message_id: result?.data?.message_id || result?.message_id || null,
      provider_response: result,
      sent_at: accepted ? new Date().toISOString() : null
    }])
  });
  if (!accepted) {
    const error = new Error(result?.message || result?.error || 'The SMS provider did not confirm delivery. The message was not marked as sent.');
    error.status = 502;
    error.deliveryStatus = notificationRows[0]?.status;
    throw error;
  }
  jsonResponse(res, 200, { sent: true, phone: application.phone, status: 'sent' });
});
