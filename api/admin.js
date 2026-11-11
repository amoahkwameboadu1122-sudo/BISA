const {
  assert,
  endpoint,
  jsonResponse,
  recordActivity,
  requireAdmin,
  signStorageObject,
  supabaseRequest
} = require('../lib/bisa');

const reviewRoles = ['super_admin', 'application_manager', 'moderator'];
const contentRoles = ['super_admin', 'content_manager'];
const allRoles = [...reviewRoles, 'content_manager'];

async function getApplications() {
  return supabaseRequest(
    '/rest/v1/business_applications?select=*,categories(name),business_media(id,media_type,file_name,storage_path),application_activity_logs(id,action,details,created_at)&order=created_at.desc&limit=300'
  );
}

async function signedMedia(items) {
  return Promise.all((items || []).map(async (item) => ({
    ...item,
    url: await signStorageObject(item.storage_path)
  })));
}

module.exports = endpoint(['GET', 'POST'], async (req, res) => {
  if (req.method === 'GET') {
    const resource = String(req.query.resource || 'overview');
    const requiredRoles = resource === 'overview' || resource === 'activity' ? allRoles
      : resource === 'team' ? ['super_admin']
        : resource === 'businesses' ? contentRoles
          : resource === 'business-media' ? contentRoles
          : resource === 'content' ? contentRoles
            : reviewRoles;
    const access = await requireAdmin(req, requiredRoles);

    if (resource === 'application-media') {
      const applicationId = String(req.query.applicationId || '');
      assert(applicationId, 'Select an application.');
      const media = await supabaseRequest(
        `/rest/v1/business_media?select=id,media_type,file_name,storage_path&application_id=eq.${encodeURIComponent(applicationId)}&order=created_at.asc`
      );
      return jsonResponse(res, 200, { media: await signedMedia(media) });
    }

    if (resource === 'overview') {
      const applications = await getApplications();
      const businesses = await supabaseRequest('/rest/v1/businesses?select=id,status&limit=1000');
      const activities = await supabaseRequest('/rest/v1/application_activity_logs?select=id&limit=12&order=created_at.desc');
      return jsonResponse(res, 200, {
        total: applications.length,
        pending: applications.filter((app) => app.status === 'PENDING' || app.status === 'UNDER REVIEW').length,
        approved: applications.filter((app) => app.status === 'APPROVED').length,
        rejected: applications.filter((app) => app.status === 'REJECTED').length,
        published: businesses.filter((business) => business.status === 'published').length,
        recentActivities: activities.length,
        roles: access.roles
      });
    }

    if (resource === 'applications') {
      const applications = await getApplications();
      const search = String(req.query.search || '').trim().toLowerCase();
      const status = String(req.query.status || '').trim().toUpperCase();
      const filtered = applications.filter((application) => {
        const matchesSearch = !search || [
          application.applicant_name,
          application.business_name,
          application.email,
          application.phone,
          application.reference_code
        ].some((value) => String(value || '').toLowerCase().includes(search));
        return matchesSearch && (!status || application.status === status);
      });
      return jsonResponse(res, 200, { applications: filtered });
    }

    if (resource === 'businesses') {
      const businesses = await supabaseRequest(
        '/rest/v1/businesses?select=*,categories(name),products_services(*),business_media(id,media_type,file_name,storage_path)&order=updated_at.desc&limit=300'
      );
      return jsonResponse(res, 200, { businesses });
    }

    if (resource === 'categories') {
      const categories = await supabaseRequest('/rest/v1/categories?select=id,name&order=name.asc');
      return jsonResponse(res, 200, { categories });
    }

    if (resource === 'business-media') {
      const businessId = String(req.query.businessId || '');
      assert(businessId, 'Select a business listing.');
      const media = await supabaseRequest(
        `/rest/v1/business_media?select=id,media_type,file_name,storage_path&business_id=eq.${encodeURIComponent(businessId)}&order=created_at.asc`
      );
      return jsonResponse(res, 200, { media: await signedMedia(media) });
    }

    if (resource === 'activity') {
      const logs = await supabaseRequest(
        '/rest/v1/application_activity_logs?select=*,business_applications(reference_code,business_name),profiles(full_name)&order=created_at.desc&limit=100'
      );
      return jsonResponse(res, 200, { activities: logs });
    }

    if (resource === 'sms') {
      const logs = await supabaseRequest(
        '/rest/v1/notifications?select=id,application_id,recipient_phone,template,message,status,provider_message_id,created_at,sent_at&order=created_at.desc&limit=100'
      );
      return jsonResponse(res, 200, { messages: logs });
    }

    if (resource === 'content') {
      const entries = await supabaseRequest('/rest/v1/site_content?select=key,value,updated_at,profiles(full_name)&order=key.asc');
      return jsonResponse(res, 200, { content: entries });
    }

    if (resource === 'team') {
      const roles = await supabaseRequest(
        '/rest/v1/admin_roles?select=id,profile_id,role_name,granted_at,profiles(email,full_name)&order=granted_at.asc&limit=300'
      );
      return jsonResponse(res, 200, { team: roles });
    }

    const error = new Error('Unknown dashboard resource.');
    error.status = 404;
    throw error;
  }

  const body = req.body || {};
  const action = String(body.action || '');

  if (action === 'update-application' || action === 'set-status') {
    const { user } = await requireAdmin(req, reviewRoles);
    const status = String(body.status || '').toUpperCase();
    assert(['PENDING', 'UNDER REVIEW', 'APPROVED', 'REJECTED', 'CHANGES REQUESTED'].includes(status), 'Select a valid application status.');
    assert(body.applicationId, 'The application is missing.');
    const notes = String(body.notes || '').trim();
    assert(notes.length <= 2000, 'Internal notes must be 2,000 characters or fewer.');
    await supabaseRequest('/rest/v1/rpc/review_business_application', {
      method: 'POST',
      body: JSON.stringify({
        p_application_id: body.applicationId,
        p_status: status,
        p_notes: notes || null,
        p_actor_id: user.id
      })
    });
    return jsonResponse(res, 200, { updated: true });
  }

  if (action === 'update-business' || action === 'create-business') {
    const { user } = await requireAdmin(req, contentRoles);
    const business = body.business || {};
    const status = String(business.status || 'draft');
    assert(['draft', 'published', 'archived'].includes(status), 'Select a valid listing status.');
    if (business.application_id) {
      const applications = await supabaseRequest(
        `/rest/v1/business_applications?select=status&id=eq.${encodeURIComponent(business.application_id)}&limit=1`
      );
      assert(applications[0]?.status === 'APPROVED', 'Only an approved application can be used for a business listing.');
    }
    const values = {
      business_name: String(business.business_name || '').trim(),
      description: String(business.description || '').trim(),
      offerings: String(business.offerings || '').trim(),
      campus_location: String(business.campus_location || '').trim(),
      contact_phone: String(business.contact_phone || '').trim(),
      contact_email: String(business.contact_email || '').trim(),
      category_id: business.category_id || null,
      is_featured: Boolean(business.is_featured),
      status
    };
    assert(values.business_name && values.description && values.offerings && values.contact_phone && values.contact_email, 'Complete the required business details.');
    if (status === 'published') {
      const businessId = business.id;
      if (businessId) {
        const media = await supabaseRequest(`/rest/v1/business_media?select=media_type&business_id=eq.${encodeURIComponent(businessId)}`);
        assert(media.filter((item) => item.media_type === 'image').length >= 3, 'Add at least three business photos before publishing this listing.');
      }
    }
    let rows;
    if (action === 'create-business') {
      assert(status !== 'published', 'Save the new listing as a draft, add at least three photos, then publish it.');
      rows = await supabaseRequest('/rest/v1/businesses', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify([{ ...values, application_id: business.application_id || null }])
      });
    } else {
      assert(business.id, 'The business listing is missing.');
      rows = await supabaseRequest(`/rest/v1/businesses?id=eq.${encodeURIComponent(business.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(values)
      });
      assert(rows.length, 'Business listing not found.', 404);
    }
    await recordActivity(rows[0].application_id, user.id, `BUSINESS_${status.toUpperCase()}`, rows[0].business_name);
    return jsonResponse(res, 200, { business: rows[0] });
  }

  if (action === 'delete-business-media') {
    const { user } = await requireAdmin(req, contentRoles);
    const businessId = String(body.businessId || '');
    const mediaId = String(body.mediaId || '');
    assert(businessId && mediaId, 'Select a business photo or video to remove.');
    const mediaRows = await supabaseRequest(
      `/rest/v1/business_media?select=id,application_id,business_id,media_type,storage_path&business_id=eq.${encodeURIComponent(businessId)}&id=eq.${encodeURIComponent(mediaId)}&limit=1`
    );
    assert(mediaRows.length, 'Business media not found.', 404);
    const media = mediaRows[0];
    if (media.media_type === 'image') {
      const allMedia = await supabaseRequest(`/rest/v1/business_media?select=id,media_type&business_id=eq.${encodeURIComponent(businessId)}`);
      assert(allMedia.filter((item) => item.media_type === 'image').length > 3, 'Keep at least three photos on each business listing.');
    }
    if (media.application_id) {
      await supabaseRequest(`/rest/v1/business_media?id=eq.${encodeURIComponent(media.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ business_id: null })
      });
    } else {
      await supabaseRequest('/storage/v1/object/business-media', {
        method: 'DELETE',
        body: JSON.stringify({ prefixes: [media.storage_path] })
      });
      await supabaseRequest(`/rest/v1/business_media?id=eq.${encodeURIComponent(media.id)}`, { method: 'DELETE' });
    }
    const businessRows = await supabaseRequest(`/rest/v1/businesses?select=application_id&id=eq.${encodeURIComponent(businessId)}&limit=1`);
    if (businessRows[0]?.application_id) {
      await recordActivity(businessRows[0].application_id, user.id, 'BUSINESS_MEDIA_REMOVED', 'A business media file was removed.');
    }
    return jsonResponse(res, 200, { removed: true });
  }

  if (action === 'invite-admin') {
    const { url, serviceKey } = require('../lib/bisa').getSupabaseConfig();
    const { user } = await requireAdmin(req, ['super_admin']);
    const email = String(body.email || '').trim().toLowerCase();
    const fullName = String(body.fullName || '').trim();
    const role = String(body.role || '');
    assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && fullName, 'Enter the team member name and a valid email address.');
    assert(['super_admin', 'application_manager', 'content_manager', 'moderator'].includes(role), 'Select a valid administrator role.');
    const inviteResponse = await fetch(`${url}/auth/v1/invite`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, data: { full_name: fullName } })
    });
    const invitedUser = await inviteResponse.json();
    assert(inviteResponse.ok, invitedUser.msg || invitedUser.message || 'The administrator invitation could not be sent.', inviteResponse.status);
    await supabaseRequest('/rest/v1/admin_roles', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify([{ profile_id: invitedUser.id, role_name: role }])
    });
    await recordActivity(null, user.id, 'ADMIN_INVITED', `${email} was invited as ${role}.`);
    return jsonResponse(res, 201, { invited: true });
  }

  if (action === 'remove-admin-role') {
    const { user } = await requireAdmin(req, ['super_admin']);
    const roleId = String(body.roleId || '');
    assert(roleId, 'Select a team role to remove.');
    const rows = await supabaseRequest(`/rest/v1/admin_roles?id=eq.${encodeURIComponent(roleId)}&select=id,profile_id,role_name`);
    assert(rows.length, 'Administrator role not found.', 404);
    assert(rows[0].profile_id !== user.id, 'You cannot remove your own administrator role.');
    if (rows[0].role_name === 'super_admin') {
      const superAdmins = await supabaseRequest('/rest/v1/admin_roles?select=id&role_name=eq.super_admin');
      assert(superAdmins.length > 1, 'At least one super administrator must remain.');
    }
    await supabaseRequest(`/rest/v1/admin_roles?id=eq.${encodeURIComponent(roleId)}`, { method: 'DELETE' });
    await recordActivity(null, user.id, 'ADMIN_ROLE_REMOVED', rows[0].role_name);
    return jsonResponse(res, 200, { removed: true });
  }

  if (action === 'save-product' || action === 'delete-product') {
    const { user } = await requireAdmin(req, contentRoles);
    const businessId = String(body.businessId || '');
    assert(businessId, 'Select a business listing.');
    const businesses = await supabaseRequest(`/rest/v1/businesses?select=id,application_id&id=eq.${encodeURIComponent(businessId)}&limit=1`);
    assert(businesses.length, 'Business listing not found.', 404);
    if (action === 'delete-product') {
      assert(body.productId, 'Select a product or service to remove.');
      await supabaseRequest(`/rest/v1/products_services?id=eq.${encodeURIComponent(body.productId)}&business_id=eq.${encodeURIComponent(businessId)}`, {
        method: 'DELETE'
      });
      await recordActivity(businesses[0].application_id, user.id, 'PRODUCT_REMOVED', 'A product or service was removed.');
      return jsonResponse(res, 200, { removed: true });
    }
    const product = body.product || {};
    const values = {
      business_id: businessId,
      title: String(product.title || '').trim(),
      description: String(product.description || '').trim() || null,
      price: product.price === '' || product.price == null ? null : Number(product.price),
      is_featured: Boolean(product.is_featured)
    };
    assert(values.title && values.title.length <= 160, 'Enter a product or service name (up to 160 characters).');
    assert(values.price === null || (Number.isFinite(values.price) && values.price >= 0), 'Enter a valid non-negative price.');
    let rows;
    if (product.id) {
      rows = await supabaseRequest(`/rest/v1/products_services?id=eq.${encodeURIComponent(product.id)}&business_id=eq.${encodeURIComponent(businessId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(values)
      });
      assert(rows.length, 'Product or service not found.', 404);
    } else {
      rows = await supabaseRequest('/rest/v1/products_services', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify([values])
      });
    }
    await recordActivity(businesses[0].application_id, user.id, 'PRODUCT_UPDATED', values.title);
    return jsonResponse(res, 200, { product: rows[0] });
  }

  if (action === 'save-content') {
    const { user } = await requireAdmin(req, contentRoles);
    const content = body.content || {};
    const allowedKeys = [
      'home.hero_title',
      'home.hero_text',
      'home.announcement',
      'contact.email',
      'contact.phone',
      'contact.location'
    ];
    const values = Object.entries(content)
      .filter(([key]) => allowedKeys.includes(key))
      .map(([key, value]) => ({ key, value: JSON.stringify(String(value || '').trim()), updated_by: user.id }));
    assert(values.length > 0, 'Enter at least one supported homepage content field.');
    assert(Object.values(content).every((value) => String(value || '').length <= 500), 'Homepage content must be 500 characters or fewer.');
    await supabaseRequest('/rest/v1/site_content', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(values)
    });
    await recordActivity(null, user.id, 'SITE_CONTENT_UPDATED', values.map((entry) => entry.key).join(', '));
    return jsonResponse(res, 200, { saved: true });
  }

  const error = new Error('Unknown dashboard action.');
  error.status = 404;
  throw error;
});
