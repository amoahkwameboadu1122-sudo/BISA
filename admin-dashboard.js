(function () {
  const tokenKey = 'bisaAdminAccessToken';
  const roles = new Set();
  let applications = [];
  let businesses = [];
  let selectedApplication = null;
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));

  async function api(path, options) {
    const response = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionStorage.getItem(tokenKey) || ''}`,
        ...(options && options.headers ? options.headers : {})
      }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        sessionStorage.removeItem(tokenKey);
        window.location.href = 'admin-login.html';
      }
      throw new Error(result.error || 'The dashboard request could not be completed.');
    }
    return result;
  }

  function feedback(id, message, type) {
    const element = document.getElementById(id);
    if (!element) return;
    element.className = `feedback ${type}`;
    element.textContent = message;
  }

  function showDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
  }

  async function loadOverview() {
    const result = await api('/api/admin?resource=overview');
    const map = {
      totalApplications: result.total,
      pendingApplications: result.pending,
      approvedBusinesses: result.approved,
      rejectedApplications: result.rejected,
      publishedListings: result.published,
      recentActivities: result.recentActivities
    };
    document.querySelectorAll('[data-summary]').forEach((node) => {
      if (map[node.dataset.summary] !== undefined) node.textContent = map[node.dataset.summary];
    });
    result.roles.forEach((role) => roles.add(role));
    if (!roles.has('super_admin')) $('#teamInviteForm')?.closest('.panel-shell')?.setAttribute('hidden', '');
    if (!roles.has('super_admin') && !roles.has('application_manager') && !roles.has('moderator')) {
      $('#applicationsTableBody')?.closest('.admin-grid')?.setAttribute('hidden', '');
    }
    if (!roles.has('super_admin') && !roles.has('application_manager')) {
      $('#smsForm')?.closest('.panel-shell')?.setAttribute('hidden', '');
    }
    if (!roles.has('super_admin') && !roles.has('content_manager')) {
      $('#businessManagementList')?.closest('.panel-shell')?.setAttribute('hidden', '');
      $('#websiteContentForm')?.closest('.panel-shell')?.setAttribute('hidden', '');
    }
  }

  async function loadApplications() {
    if (!roles.has('super_admin') && !roles.has('application_manager') && !roles.has('moderator')) return;
    const params = new URLSearchParams({
      resource: 'applications',
      search: $('#applicationSearch')?.value || '',
      status: $('#applicationStatusFilter')?.value || ''
    });
    const result = await api(`/api/admin?${params}`);
    applications = result.applications || [];
    renderApplications();
    const current = selectedApplication && applications.find((item) => item.id === selectedApplication.id);
    if (current) {
      selectedApplication = current;
      renderDetails(current);
    } else if (applications.length) {
      selectedApplication = applications[0];
      renderDetails(selectedApplication);
    } else {
      selectedApplication = null;
      $('#applicationDetailPanel').innerHTML = '<div class="empty-state">No applications match this search.</div>';
      updateSmsRecipient(null);
    }
  }

  function renderApplications() {
    const body = $('#applicationsTableBody');
    if (!applications.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="empty-state">No applications match your search.</div></td></tr>';
      return;
    }
    body.innerHTML = applications.map((application) => `
      <tr>
        <td><div class="applicant-meta"><strong>${escapeHtml(application.applicant_name)}</strong><small>${escapeHtml(application.business_name)}</small></div></td>
        <td>${escapeHtml(application.categories?.name || 'Other')}</td>
        <td>${escapeHtml(application.campus_location || 'Not provided')}</td>
        <td><span class="status-pill status-${escapeHtml(application.status.toLowerCase().replace(/\s+/g, '-'))}">${escapeHtml(application.status)}</span></td>
        <td>${escapeHtml(showDate(application.created_at))}</td>
        <td><div class="table-actions">
          <button type="button" class="table-button" data-application-view="${escapeHtml(application.id)}">View</button>
          ${roles.has('super_admin') || roles.has('application_manager') ? `<button type="button" class="table-button subtle" data-application-status="${escapeHtml(application.id)}" data-status="APPROVED">Approve</button>` : ''}
        </div></td>
      </tr>`).join('');
  }

  function renderDetails(application) {
    const panel = $('#applicationDetailPanel');
    const history = (application.application_activity_logs || [])
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    panel.innerHTML = `
      <div class="detail-header">
        <div><p class="eyebrow">Application details</p><h3>${escapeHtml(application.business_name)}</h3></div>
        <span class="status-pill status-${escapeHtml(application.status.toLowerCase().replace(/\s+/g, '-'))}">${escapeHtml(application.status)}</span>
      </div>
      <dl class="detail-list">
        <div><dt>Reference</dt><dd>${escapeHtml(application.reference_code)}</dd></div>
        <div><dt>Applicant</dt><dd>${escapeHtml(application.applicant_name)}</dd></div>
        <div><dt>Email</dt><dd><a href="mailto:${escapeHtml(application.email)}">${escapeHtml(application.email)}</a></dd></div>
        <div><dt>Phone</dt><dd><a href="tel:${escapeHtml(application.phone)}">${escapeHtml(application.phone)}</a></dd></div>
        <div><dt>Category</dt><dd>${escapeHtml(application.categories?.name || 'Other')}</dd></div>
        <div><dt>Location</dt><dd>${escapeHtml(application.campus_location || 'Not provided')}</dd></div>
        <div class="span-two"><dt>Offerings</dt><dd>${escapeHtml(application.offerings)}</dd></div>
        <div class="span-two"><dt>About</dt><dd>${escapeHtml(application.description)}</dd></div>
      </dl>
      <div class="detail-media"><h4>Submitted media</h4>
        <ul id="applicationMediaList"><li>Loading secure media links…</li></ul>
      </div>
      ${history.length ? `<div class="detail-media"><h4>Status and activity history</h4>
        <ul>${history.map((entry) => `<li>${escapeHtml(entry.action.replaceAll('_', ' '))}: ${escapeHtml(entry.details || '')} — ${escapeHtml(showDate(entry.created_at))}</li>`).join('')}</ul>
      </div>` : ''}
      ${roles.has('super_admin') || roles.has('application_manager') ? `
        <label for="applicationNotes">Internal notes</label>
        <textarea id="applicationNotes" rows="3">${escapeHtml(application.notes || '')}</textarea>
        <label for="applicationStatus">Application status</label>
        <select id="applicationStatus">
          ${['PENDING', 'UNDER REVIEW', 'APPROVED', 'REJECTED', 'CHANGES REQUESTED'].map((status) =>
            `<option${application.status === status ? ' selected' : ''}>${status}</option>`).join('')}
        </select>
        <div class="detail-actions">
          <button type="button" class="table-button" data-save-application="${escapeHtml(application.id)}">Save review</button>
          <button type="button" class="table-button subtle" data-application-status="${escapeHtml(application.id)}" data-status="UNDER REVIEW">Mark under review</button>
        </div>` : ''}
    `;
    updateSmsRecipient(application);
    loadApplicationMedia(application.id);
  }

  async function loadApplicationMedia(applicationId) {
    const list = $('#applicationMediaList');
    if (!list) return;
    try {
      const result = await api(`/api/admin?resource=application-media&applicationId=${encodeURIComponent(applicationId)}`);
      if (selectedApplication?.id !== applicationId || !$('#applicationMediaList')) return;
      $('#applicationMediaList').innerHTML = result.media.length ? result.media.map((media) => `
        <li><a href="${escapeHtml(media.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(media.file_name)} (${escapeHtml(media.media_type)})</a></li>
      `).join('') : '<li>No uploaded media</li>';
    } catch (error) {
      if (selectedApplication?.id === applicationId && $('#applicationMediaList')) {
        $('#applicationMediaList').textContent = error.message;
      }
    }
  }

  function updateSmsRecipient(application) {
    $('#smsApplicationId').value = application?.id || '';
    $('#smsPhone').value = application?.phone || '';
    $('#smsConfirm').checked = false;
    const template = $('#smsTemplate')?.value || 'Application received';
    const message = $('#smsMessage');
    if (message) message.value = application ? buildMessage(template, application.applicant_name) : '';
  }

  function buildMessage(template, name) {
    const messages = {
      'Application received': `Hello ${name}, your BISA business application has been received and is currently under review. We will update you soon.`,
      'Application approved': `Hello ${name}, congratulations! Your business application to BISA has been approved. Your business can now be published on our campus marketplace. Thank you for choosing BISA!`,
      'Application rejected': `Hello ${name}, thank you for applying to BISA. Unfortunately, your application has not been approved at this time. Reason: Please contact us for further clarification.`,
      'Additional information required': `Hello ${name}, we need a little more information before we can process your BISA application. Please review the missing details and send them back to us.`,
      'Application correction requested': `Hello ${name}, your BISA application needs a few corrections before we can continue. Please update the highlighted details and resubmit.`,
      'Custom message': ''
    };
    return messages[template] || '';
  }

  async function updateStatus(applicationId, status, notes) {
    await api('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action: 'update-application', applicationId, status, notes })
    });
    await Promise.all([loadOverview(), loadApplications(), loadActivity(), loadBusinesses()]);
  }

  async function loadBusinesses() {
    if (!roles.has('super_admin') && !roles.has('content_manager')) return;
    const result = await api('/api/admin?resource=businesses');
    businesses = result.businesses || [];
    renderBusinesses();
  }

  async function loadCategories() {
    if (!roles.has('super_admin') && !roles.has('content_manager')) return;
    const result = await api('/api/admin?resource=categories');
    const select = $('#newBusinessCategory');
    select.innerHTML = '<option value="">Select a category</option>'
      + result.categories.map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join('');
  }

  function renderBusinesses() {
    const panel = $('#businessManagementList');
    if (!panel) return;
    if (!businesses.length) {
      panel.innerHTML = '<p class="empty-state">Approved applications and admin-created listings will appear here.</p>';
      return;
    }
    panel.innerHTML = businesses.map((business) => `
      <article class="management-card">
        <h3>${escapeHtml(business.business_name)}</h3>
        <form class="business-update-form" data-business-id="${escapeHtml(business.id)}">
          <label>Business description<textarea name="description" rows="2" required>${escapeHtml(business.description)}</textarea></label>
          <label>Products or services<textarea name="offerings" rows="2" required>${escapeHtml(business.offerings)}</textarea></label>
          <label>Location<input name="campus_location" value="${escapeHtml(business.campus_location || '')}"></label>
          <label>Contact phone<input name="contact_phone" value="${escapeHtml(business.contact_phone || '')}" required></label>
          <label>Contact email<input name="contact_email" type="email" value="${escapeHtml(business.contact_email || '')}" required></label>
          <label>Publication status<select name="status">
            ${['draft', 'published', 'archived'].map((status) => `<option${business.status === status ? ' selected' : ''}>${status}</option>`).join('')}
          </select></label>
          <label class="confirmation-label"><input name="is_featured" type="checkbox"${business.is_featured ? ' checked' : ''}> Feature listing</label>
          <button type="submit" class="table-button">Save listing</button>
        </form>
        <h4>Products and services</h4>
        ${(business.products_services || []).map((product) => productForm(business.id, product)).join('')}
        ${productForm(business.id, null)}
        <h4>Business photos and video</h4>
        <ul class="business-media-list" data-business-media-list="${escapeHtml(business.id)}">
          ${(business.business_media || []).map((media) => `
            <li>${escapeHtml(media.file_name)} (${escapeHtml(media.media_type)})
              <button type="button" class="table-button warning" data-delete-business-media="${escapeHtml(media.id)}" data-business-id="${escapeHtml(business.id)}">Remove</button>
            </li>`).join('') || '<li>No business media has been saved.</li>'}
        </ul>
        <button type="button" class="table-button subtle" data-view-business-media="${escapeHtml(business.id)}">Open media links</button>
        <form class="business-media-form" data-business-id="${escapeHtml(business.id)}">
          <label>Photos<input name="images" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" multiple></label>
          <label>Optional video<input name="video" type="file" accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"></label>
          <small>JPG, PNG, WEBP, GIF up to 5MB each; one MP4, WEBM or MOV video up to 25MB.</small>
          <button type="submit" class="table-button">Upload business media</button>
        </form>
      </article>`).join('');
  }

  function productForm(businessId, product) {
    const id = product?.id || '';
    return `<form class="product-update-form" data-business-id="${escapeHtml(businessId)}" data-product-id="${escapeHtml(id)}">
      <label>Name<input name="title" value="${escapeHtml(product?.title || '')}" maxlength="160" required></label>
      <label>Description<input name="description" value="${escapeHtml(product?.description || '')}"></label>
      <label>Price<input name="price" type="number" min="0" step="0.01" value="${escapeHtml(product?.price ?? '')}"></label>
      <label class="confirmation-label"><input name="is_featured" type="checkbox"${product?.is_featured ? ' checked' : ''}> Featured</label>
      <button type="submit" class="table-button">${product ? 'Save' : 'Add'}</button>
      ${product ? `<button type="button" class="table-button warning" data-delete-product="${escapeHtml(id)}" data-business-id="${escapeHtml(businessId)}">Remove</button>` : ''}
    </form>`;
  }

  async function loadActivity() {
    const result = await api('/api/admin?resource=activity');
    const panel = $('#activityList');
    panel.innerHTML = result.activities.length ? result.activities.map((activity) => `
      <article class="management-card">
        <strong>${escapeHtml(activity.action.replaceAll('_', ' ').toLowerCase())}</strong>
        <p>${escapeHtml(activity.details || activity.business_applications?.business_name || '')}</p>
        <small>${escapeHtml(activity.profiles?.full_name || 'BISA administrator')} · ${escapeHtml(showDate(activity.created_at))}</small>
      </article>`).join('') : '<p class="empty-state">No recent activity has been recorded.</p>';
  }

  async function loadTeam() {
    if (!roles.has('super_admin')) return;
    const result = await api('/api/admin?resource=team');
    $('#teamList').innerHTML = result.team.length ? result.team.map((entry) => `
      <article class="management-card team-card">
        <div><strong>${escapeHtml(entry.profiles?.full_name || 'Invited administrator')}</strong><small>${escapeHtml(entry.profiles?.email || '')}</small><small>${escapeHtml(entry.role_name.replaceAll('_', ' '))}</small></div>
        <button type="button" class="table-button warning" data-remove-role="${escapeHtml(entry.id)}">Remove role</button>
      </article>`).join('') : '<p class="empty-state">No administrators have been invited yet.</p>';
  }

  async function loadSmsHistory() {
    if (!roles.has('super_admin') && !roles.has('application_manager')) return;
    const result = await api('/api/admin?resource=sms');
    $('#smsHistory').innerHTML = result.messages.length ? `
      <h3>Recent SMS messages</h3>
      ${result.messages.map((message) => `
        <article class="management-card">
          <strong>${escapeHtml(message.status.toUpperCase())} · ${escapeHtml(message.recipient_phone || '')}</strong>
          <p>${escapeHtml(message.message)}</p>
          <small>${escapeHtml(showDate(message.created_at))}</small>
        </article>`).join('')}` : '<p class="empty-state">No SMS messages have been recorded.</p>';
  }

  async function loadWebsiteContent() {
    if (!roles.has('super_admin') && !roles.has('content_manager')) return;
    const result = await api('/api/admin?resource=content');
    const values = Object.fromEntries((result.content || []).map((entry) => [entry.key, entry.value]));
    const form = $('#websiteContentForm');
    form.elements.hero_title.value = values['home.hero_title'] || '';
    form.elements.hero_text.value = values['home.hero_text'] || '';
    form.elements.announcement.value = values['home.announcement'] || '';
    form.elements.contact_email.value = values['contact.email'] || '';
    form.elements.contact_phone.value = values['contact.phone'] || '';
    form.elements.contact_location.value = values['contact.location'] || '';
  }

  $('#applicationsTableBody').addEventListener('click', async (event) => {
    const viewButton = event.target.closest('[data-application-view]');
    if (viewButton) {
      selectedApplication = applications.find((application) => application.id === viewButton.dataset.applicationView) || null;
      if (selectedApplication) renderDetails(selectedApplication);
      return;
    }
    const statusButton = event.target.closest('[data-application-status]');
    if (statusButton) {
      const application = applications.find((item) => item.id === statusButton.dataset.applicationStatus);
      if (application) {
        try {
          await updateStatus(application.id, statusButton.dataset.status, application.notes);
        } catch (error) {
          feedback('smsResult', error.message, 'error');
        }
      }
    }
  });

  $('#applicationDetailPanel').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-save-application]');
    if (!button) return;
    button.disabled = true;
    try {
      await updateStatus(button.dataset.saveApplication, $('#applicationStatus').value, $('#applicationNotes').value);
    } catch (error) {
      feedback('smsResult', error.message, 'error');
      try {
        await loadSmsHistory();
      } catch (historyError) {
        console.error('Unable to refresh SMS history:', historyError);
      }
    } finally {
      button.disabled = false;
    }
  });

  let searchTimer;
  $('#applicationSearch')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadApplications().catch((error) => feedback('smsResult', error.message, 'error')), 250);
  });
  $('#applicationStatusFilter')?.addEventListener('change', () => {
    loadApplications().catch((error) => feedback('smsResult', error.message, 'error'));
  });

  $('#smsTemplate')?.addEventListener('change', () => {
    if (selectedApplication) updateSmsRecipient(selectedApplication);
  });
  $('#smsForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const phone = $('#smsPhone').value;
    if (!window.confirm(`Send this SMS to ${phone}?`)) return;
    const button = event.currentTarget.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const result = await api('/api/sms', {
        method: 'POST',
        body: JSON.stringify({
          applicationId: $('#smsApplicationId').value,
          template: $('#smsTemplate').value,
          message: $('#smsMessage').value.trim()
        })
      });
      feedback('smsResult', `SMS provider accepted the message for ${result.phone}.`, 'success');
      await loadSmsHistory();
    } catch (error) {
      feedback('smsResult', error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  $('#businessManagementList')?.addEventListener('submit', async (event) => {
    const form = event.target.closest('.business-update-form');
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    const original = businesses.find((business) => business.id === form.dataset.businessId);
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await api('/api/admin', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update-business',
          business: {
            ...original,
            description: data.get('description'),
            offerings: data.get('offerings'),
            campus_location: data.get('campus_location'),
            contact_phone: data.get('contact_phone'),
            contact_email: data.get('contact_email'),
            status: data.get('status'),
            is_featured: data.has('is_featured')
          }
        })
      });
      await Promise.all([loadBusinesses(), loadOverview()]);
    } catch (error) {
      window.alert(error.message);
    } finally {
      button.disabled = false;
    }
  });

  $('#businessCreateForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await api('/api/admin', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create-business',
          business: {
            business_name: data.get('business_name'),
            category_id: data.get('category_id'),
            description: data.get('description'),
            offerings: data.get('offerings'),
            campus_location: data.get('campus_location'),
            contact_phone: data.get('contact_phone'),
            contact_email: data.get('contact_email'),
            status: 'draft'
          }
        })
      });
      form.reset();
      feedback('businessCreateResult', 'Draft listing created. Add at least three photos before publishing.', 'success');
      await loadBusinesses();
    } catch (error) {
      feedback('businessCreateResult', error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  $('#businessManagementList')?.addEventListener('submit', async (event) => {
    const form = event.target.closest('.business-media-form');
    if (!form) return;
    event.preventDefault();
    const images = Array.from(form.elements.images.files || []);
    const videos = Array.from(form.elements.video.files || []);
    const files = [...images, ...videos];
    if (!files.length) {
      window.alert('Select at least one photo or video to upload.');
      return;
    }
    if (videos.length > 1) {
      window.alert('Select no more than one optional business video.');
      return;
    }
    const types = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
      gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime'
    };
    const uploads = [];
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      for (const file of files) {
        const type = file.type || types[file.name.split('.').pop().toLowerCase()];
        const signed = await api('/api/business-media', {
          method: 'POST',
          body: JSON.stringify({
            action: 'create-upload',
            businessId: form.dataset.businessId,
            contentType: type,
            size: file.size
          })
        });
        const response = await fetch(signed.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': type, 'x-upsert': 'false' },
          body: file
        });
        if (!response.ok) throw new Error('A media file could not be uploaded.');
        uploads.push({ path: signed.path, name: file.name });
      }
      await api('/api/business-media', {
        method: 'POST',
        body: JSON.stringify({ action: 'save', businessId: form.dataset.businessId, media: uploads })
      });
      await loadBusinesses();
    } catch (error) {
      window.alert(error.message);
    } finally {
      button.disabled = false;
    }
  });

  $('#businessManagementList')?.addEventListener('submit', async (event) => {
    const form = event.target.closest('.product-update-form');
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await api('/api/admin', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save-product',
          businessId: form.dataset.businessId,
          product: {
            id: form.dataset.productId || null,
            title: data.get('title'),
            description: data.get('description'),
            price: data.get('price'),
            is_featured: data.has('is_featured')
          }
        })
      });
      await loadBusinesses();
    } catch (error) {
      window.alert(error.message);
    } finally {
      button.disabled = false;
    }
  });

  $('#businessManagementList')?.addEventListener('click', async (event) => {
    const viewButton = event.target.closest('[data-view-business-media]');
    if (viewButton) {
      viewButton.disabled = true;
      try {
        const result = await api(`/api/admin?resource=business-media&businessId=${encodeURIComponent(viewButton.dataset.viewBusinessMedia)}`);
        const list = document.querySelector(`[data-business-media-list="${viewButton.dataset.viewBusinessMedia}"]`);
        if (list) {
          list.innerHTML = result.media.map((media) => `
            <li><a href="${escapeHtml(media.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(media.file_name)}</a> (${escapeHtml(media.media_type)})</li>
          `).join('') || '<li>No business media has been saved.</li>';
        }
      } catch (error) {
        window.alert(error.message);
      } finally {
        viewButton.disabled = false;
      }
      return;
    }
    const removeMediaButton = event.target.closest('[data-delete-business-media]');
    if (removeMediaButton) {
      if (!window.confirm('Remove this media file from the business profile?')) return;
      removeMediaButton.disabled = true;
      try {
        await api('/api/admin', {
          method: 'POST',
          body: JSON.stringify({
            action: 'delete-business-media',
            businessId: removeMediaButton.dataset.businessId,
            mediaId: removeMediaButton.dataset.deleteBusinessMedia
          })
        });
        await loadBusinesses();
      } catch (error) {
        window.alert(error.message);
        removeMediaButton.disabled = false;
      }
      return;
    }
    const button = event.target.closest('[data-delete-product]');
    if (!button || !window.confirm('Remove this product or service?')) return;
    button.disabled = true;
    try {
      await api('/api/admin', {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete-product',
          businessId: button.dataset.businessId,
          productId: button.dataset.deleteProduct
        })
      });
      await loadBusinesses();
    } catch (error) {
      window.alert(error.message);
      button.disabled = false;
    }
  });

  $('#teamInviteForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await api('/api/admin', {
        method: 'POST',
        body: JSON.stringify({
          action: 'invite-admin',
          fullName: form.elements.fullName.value.trim(),
          email: form.elements.email.value.trim(),
          role: form.elements.role.value
        })
      });
      form.reset();
      feedback('teamResult', 'Invitation sent. The team member must accept it and sign in to access the dashboard.', 'success');
      await loadTeam();
    } catch (error) {
      feedback('teamResult', error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  $('#teamList')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-remove-role]');
    if (!button || !window.confirm('Remove this administrator role?')) return;
    button.disabled = true;
    try {
      await api('/api/admin', {
        method: 'POST',
        body: JSON.stringify({ action: 'remove-admin-role', roleId: button.dataset.removeRole })
      });
      await loadTeam();
    } catch (error) {
      feedback('teamResult', error.message, 'error');
      button.disabled = false;
    }
  });

  $('#websiteContentForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await api('/api/admin', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save-content',
          content: {
            'home.hero_title': form.elements.hero_title.value,
            'home.hero_text': form.elements.hero_text.value,
            'home.announcement': form.elements.announcement.value,
            'contact.email': form.elements.contact_email.value,
            'contact.phone': form.elements.contact_phone.value,
            'contact.location': form.elements.contact_location.value
          }
        })
      });
      feedback('contentResult', 'Homepage content saved.', 'success');
    } catch (error) {
      feedback('contentResult', error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  $('#adminLogoutButton')?.addEventListener('click', async () => {
    const token = sessionStorage.getItem(tokenKey);
    try {
      const response = await fetch('/api/config');
      const config = await response.json();
      await fetch(`${config.url}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` }
      });
    } finally {
      sessionStorage.removeItem(tokenKey);
      window.location.href = 'admin-login.html';
    }
  });

  loadOverview()
    .then(() => Promise.all([
      loadApplications(),
      loadActivity(),
      loadBusinesses(),
      loadCategories(),
      loadTeam(),
      loadSmsHistory(),
      loadWebsiteContent()
    ]))
    .catch((error) => {
      $('#applicationDetailPanel').innerHTML = `<p class="feedback error">${escapeHtml(error.message)}</p>`;
      if (/sign in|session|permission/i.test(error.message)) {
        sessionStorage.removeItem(tokenKey);
        window.location.href = 'admin-login.html';
      }
    });
})();
