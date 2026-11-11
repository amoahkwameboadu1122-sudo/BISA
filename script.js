(function () {
  const appStorageKey = 'bisaApplications';
  const activityStorageKey = 'bisaActivityLog';
  const smsStorageKey = 'bisaSmsLog';

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function formatDate(dateValue) {
    return new Date(dateValue).toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function generateReference() {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `BISA-${stamp}-${random}`;
  }

  function allowedImageFormat(file) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    return allowed.includes(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
  }

  function allowedVideoFormat(file) {
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime'];
    return allowed.includes(file.type) || /\.(mp4|webm|mov)$/i.test(file.name);
  }

  function validPhone(phone) {
    const digits = String(phone || '').replace(/[^\d+]/g, '').replace(/\s+/g, '');
    return /^(\+233|233|0)\d{9}$/.test(digits);
  }

  function getStoredApplications() {
    const apps = readJson(appStorageKey, []);
    if (!apps.length) {
      const seeded = [
        {
          reference: 'BISA-20261110-ALPHA',
          applicantName: 'Mawusi Boakye',
          businessName: 'Fruitful Bites',
          phone: '+233 245 112 345',
          email: 'mawusi@example.com',
          category: 'Food and Drinks',
          location: 'Main Campus',
          description: 'Healthy smoothies and fast campus snacks prepared daily by student entrepreneurs.',
          offerings: 'Smoothies, wraps, snack packs',
          submissionDate: '2026-11-10T08:30:00.000Z',
          status: 'PENDING',
          media: [{ name: 'fruitful-bites-1.jpg', type: 'image' }, { name: 'fruitful-bites-2.jpg', type: 'image' }, { name: 'fruitful-bites-3.jpg', type: 'image' }],
          notes: 'Waiting for business verification.'
        },
        {
          reference: 'BISA-20261109-BRAVO',
          applicantName: 'Ama Mensah',
          businessName: 'Glow Studio',
          phone: '+233 591 768 902',
          email: 'ama@example.com',
          category: 'Beauty and Personal Care',
          location: 'Hostel Zone',
          description: 'Beauty and grooming services tailored to student schedules.',
          offerings: 'Braiding, makeup, facials',
          submissionDate: '2026-11-09T13:05:00.000Z',
          status: 'APPROVED',
          media: [{ name: 'glow-studio-1.jpg', type: 'image' }, { name: 'glow-studio-2.jpg', type: 'image' }, { name: 'glow-studio-3.jpg', type: 'image' }],
          notes: 'Approved and published.'
        },
        {
          reference: 'BISA-20261108-CHARLIE',
          applicantName: 'Kojo Osei',
          businessName: 'FixHub Campus',
          phone: '+233 200 998 221',
          email: 'kojo@example.com',
          category: 'Technology',
          location: 'Engineering Block',
          description: 'Repairs, accessories and student tech support for everyday gadgets.',
          offerings: 'Phone repairs, charger sales, laptop support',
          submissionDate: '2026-11-08T11:55:00.000Z',
          status: 'REJECTED',
          media: [{ name: 'fixhub-1.jpg', type: 'image' }, { name: 'fixhub-2.jpg', type: 'image' }, { name: 'fixhub-3.jpg', type: 'image' }],
          notes: 'Missing operating details and location proof.'
        }
      ];
      saveJson(appStorageKey, seeded);
      return seeded;
    }
    return apps;
  }

  function recordActivity(text) {
    const logs = readJson(activityStorageKey, []);
    logs.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      timestamp: new Date().toISOString()
    });
    if (logs.length > 12) {
      logs.length = 12;
    }
    saveJson(activityStorageKey, logs);
  }

  function recordSms(message, phone, status, template) {
    const logs = readJson(smsStorageKey, []);
    logs.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      phone,
      status,
      template,
      message,
      date: new Date().toISOString()
    });
    if (logs.length > 20) {
      logs.length = 20;
    }
    saveJson(smsStorageKey, logs);
  }

  function setFeedback(elementId, message, type) {
    const target = document.getElementById(elementId);
    if (!target) return;
    target.className = `feedback ${type}`;
    target.textContent = message;
  }

  function populateBusinessFormPreview(files, previewTargetId) {
    const previewTarget = document.getElementById(previewTargetId);
    if (!previewTarget) return;
    previewTarget.innerHTML = '';

    files.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'file-preview-item';
      item.innerHTML = `
        <span>${file.name}</span>
        <button type="button" data-remove-file="${index}" class="remove-file">Remove</button>
      `;
      previewTarget.appendChild(item);
    });

    previewTarget.querySelectorAll('[data-remove-file]').forEach((button) => {
      button.addEventListener('click', () => {
        const removeIndex = Number(button.getAttribute('data-remove-file'));
        const updatedFiles = Array.from(files);
        updatedFiles.splice(removeIndex, 1);
        const input = document.getElementById(previewTargetId === 'imagePreviews' ? 'businessPhotos' : 'businessVideo');
        const dataTransfer = new DataTransfer();
        updatedFiles.forEach((file) => dataTransfer.items.add(file));
        if (input) {
          input.files = dataTransfer.files;
        }
        populateBusinessFormPreview(updatedFiles, previewTargetId);
      });
    });
  }

  function handleBusinessFormSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const imageInput = document.getElementById('businessPhotos');
    const videoInput = document.getElementById('businessVideo');
    const imageFiles = Array.from(imageInput?.files || []);
    const videoFiles = Array.from(videoInput?.files || []);

    if (imageFiles.length < 3) {
      setFeedback('submissionResult', 'Please upload at least three business photos before submitting.', 'error');
      return;
    }

    const invalidImage = imageFiles.find((file) => !allowedImageFormat(file) || file.size > 5 * 1024 * 1024);
    if (invalidImage) {
      setFeedback('submissionResult', 'Image uploads must be JPG, JPEG, PNG, WEBP or GIF and under 5MB each.', 'error');
      return;
    }

    if (videoFiles.length > 1) {
      setFeedback('submissionResult', 'Please upload only one optional video for your business profile.', 'error');
      return;
    }

    if (videoFiles[0] && (!allowedVideoFormat(videoFiles[0]) || videoFiles[0].size > 25 * 1024 * 1024)) {
      setFeedback('submissionResult', 'Video uploads must be MP4, WEBM or MOV and under 25MB.', 'error');
      return;
    }

    const app = {
      reference: generateReference(),
      applicantName: form.owner.value.trim(),
      businessName: form.businessName.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      category: form.category.value,
      location: form.location.value.trim(),
      description: form.description.value.trim(),
      offerings: form.offering.value.trim(),
      submissionDate: new Date().toISOString(),
      status: 'PENDING',
      media: imageFiles.map((file) => ({ name: file.name, type: 'image', size: file.size })),
      video: videoFiles[0] ? { name: videoFiles[0].name, type: 'video', size: videoFiles[0].size } : null,
      notes: 'Application received and awaiting administrator review.'
    };

    const apps = readJson(appStorageKey, []);
    apps.unshift(app);
    saveJson(appStorageKey, apps);
    recordActivity(`${app.applicantName} submitted a new application reference ${app.reference}.`);

    setFeedback('submissionResult', `Application submitted successfully. Your reference is ${app.reference}.`, 'success');
    form.reset();
    const imagePreview = document.getElementById('imagePreviews');
    if (imagePreview) imagePreview.innerHTML = '';
    const videoPreview = document.getElementById('videoPreview');
    if (videoPreview) videoPreview.textContent = 'No video selected';
  }

  function handleFileInputChange(event) {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    const previewTargetId = input.id === 'businessPhotos' ? 'imagePreviews' : 'videoPreview';

    if (input.id === 'businessPhotos') {
      const previewList = document.getElementById('imagePreviews');
      if (previewList) {
        previewList.innerHTML = '';
        files.forEach((file) => {
          const item = document.createElement('div');
          item.className = 'file-preview-item';
          item.innerHTML = `<span>${file.name}</span>`;
          previewList.appendChild(item);
        });
      }
      return;
    }

    const target = document.getElementById(previewTargetId);
    if (target) {
      target.textContent = files[0] ? files[0].name : 'No video selected';
    }
  }

  function renderOverviewCards() {
    const summaryMap = document.querySelectorAll('[data-summary]');
    if (!summaryMap.length) return;

    const applications = getStoredApplications();
    const totals = {
      total: applications.length,
      pending: applications.filter((app) => app.status === 'PENDING').length,
      approved: applications.filter((app) => app.status === 'APPROVED').length,
      rejected: applications.filter((app) => app.status === 'REJECTED').length,
      published: applications.filter((app) => app.status === 'APPROVED').length
    };

    const map = {
      totalApplications: totals.total,
      pendingApplications: totals.pending,
      approvedBusinesses: totals.approved,
      rejectedApplications: totals.rejected,
      publishedListings: totals.published,
      recentActivities: readJson(activityStorageKey, []).length
    };

    summaryMap.forEach((node) => {
      const key = node.dataset.summary;
      if (map[key] !== undefined) {
        node.textContent = map[key];
      }
    });
  }

  function renderAdminTable() {
    const tableBody = document.getElementById('applicationsTableBody');
    const searchInput = document.getElementById('applicationSearch');
    if (!tableBody) return;

    const applications = getStoredApplications();
    const filterValue = (searchInput ? searchInput.value : '').trim().toLowerCase();

    const filtered = applications.filter((app) => {
      const haystack = `${app.applicantName} ${app.businessName} ${app.category} ${app.reference}`.toLowerCase();
      return haystack.includes(filterValue);
    });

    if (!filtered.length) {
      tableBody.innerHTML = '<tr><td colspan="6"><div class="empty-state">No applications match your search.</div></td></tr>';
      return;
    }

    tableBody.innerHTML = filtered.map((app) => `
      <tr>
        <td>
          <div class="applicant-meta">
            <strong>${app.applicantName}</strong>
            <small>${app.businessName}</small>
          </div>
        </td>
        <td>${app.category}</td>
        <td>${app.location || 'Not provided'}</td>
        <td><span class="status-pill status-${String(app.status).toLowerCase().replace(/\s+/g, '-')}">${app.status}</span></td>
        <td>${formatDate(app.submissionDate)}</td>
        <td>
          <div class="table-actions">
            <button type="button" class="table-button" data-app-action="view" data-reference="${app.reference}">View</button>
            <button type="button" class="table-button subtle" data-app-action="approve" data-reference="${app.reference}">Approve</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function renderDetailPanel(reference) {
    const detailPanel = document.getElementById('applicationDetailPanel');
    const applications = getStoredApplications();
    const app = applications.find((item) => item.reference === reference) || applications[0];
    if (!app || !detailPanel) return;

    detailPanel.innerHTML = `
      <div class="detail-header">
        <div>
          <p class="eyebrow">Application details</p>
          <h3>${app.businessName}</h3>
        </div>
        <span class="status-pill status-${String(app.status).toLowerCase().replace(/\s+/g, '-')}">${app.status}</span>
      </div>
      <dl class="detail-list">
        <div><dt>Reference</dt><dd>${app.reference}</dd></div>
        <div><dt>Applicant</dt><dd>${app.applicantName}</dd></div>
        <div><dt>Email</dt><dd>${app.email}</dd></div>
        <div><dt>Phone</dt><dd>${app.phone}</dd></div>
        <div><dt>Category</dt><dd>${app.category}</dd></div>
        <div><dt>Location</dt><dd>${app.location}</dd></div>
        <div class="span-two"><dt>Offerings</dt><dd>${app.offerings || 'Not provided'}</dd></div>
        <div class="span-two"><dt>About</dt><dd>${app.description || 'No description provided yet.'}</dd></div>
      </dl>
      <div class="detail-media">
        <h4>Submitted media</h4>
        <ul>
          ${(app.media || []).map((media) => `<li>${media.name}</li>`).join('') || '<li>No uploaded media</li>'}
        </ul>
      </div>
      <div class="detail-actions">
        <button type="button" class="table-button" data-app-action="approve" data-reference="${app.reference}">Approve</button>
        <button type="button" class="table-button warning" data-app-action="reject" data-reference="${app.reference}">Reject</button>
        <button type="button" class="table-button subtle" data-app-action="changes" data-reference="${app.reference}">Request changes</button>
      </div>
    `;

    const smsPhoneInput = document.getElementById('smsPhone');
    if (smsPhoneInput) {
      smsPhoneInput.value = app.phone || '';
    }

    const smsTemplateInput = document.getElementById('smsTemplate');
    if (smsTemplateInput) {
      const template = smsTemplateInput.value || 'Application received';
      const message = buildSmsMessage(template, app.applicantName, 'Thank you for your patience.');
      const smsMessage = document.getElementById('smsMessage');
      if (smsMessage) {
        smsMessage.value = message;
      }
    }
  }

  function buildSmsMessage(template, applicantName, reasonText) {
    const name = applicantName || 'Applicant';
    const templates = {
      'Application received': `Hello ${name}, your BISA business application has been received and is currently under review. We will update you soon.`,
      'Application approved': `Hello ${name}, congratulations! Your business application to BISA has been approved. Your business can now be published on our campus marketplace. Thank you for choosing BISA!`,
      'Application rejected': `Hello ${name}, thank you for applying to BISA. Unfortunately, your application has not been approved at this time. Reason: ${reasonText || 'Please contact us for more information.'} You may contact us for further clarification.`,
      'Additional information required': `Hello ${name}, we need a little more information before we can process your BISA application. Please review the missing details and send them back to us.`,
      'Correction requested': `Hello ${name}, your BISA application needs a few corrections before we can continue. Please update the highlighted details and resubmit.`,
      'Application update': `Hello ${name}, an update has been made to your BISA application. Please check your dashboard or contact our team for details.`
    };

    return templates[template] || templates['Application received'];
  }

  function updateApplicationStatus(reference, status, noteText) {
    const apps = getStoredApplications();
    const target = apps.find((app) => app.reference === reference);
    if (!target) return;

    target.status = status;
    target.notes = noteText || target.notes || 'Status updated by administrator.';
    saveJson(appStorageKey, apps);
    recordActivity(`Application ${reference} was marked as ${status}.`);
    renderOverviewCards();
    renderAdminTable();
    renderDetailPanel(reference);
  }

  function attachAdminActions() {
    document.body.addEventListener('click', (event) => {
      const button = event.target.closest('[data-app-action]');
      if (!button) return;

      const reference = button.dataset.reference;
      const action = button.dataset.appAction;
      const apps = getStoredApplications();
      const app = apps.find((item) => item.reference === reference);
      if (!app) return;

      if (action === 'view') {
        renderDetailPanel(reference);
        return;
      }

      if (action === 'approve') {
        updateApplicationStatus(reference, 'APPROVED', 'Approved by the administrator and ready for publication.');
        return;
      }

      if (action === 'reject') {
        updateApplicationStatus(reference, 'REJECTED', 'Rejected after review.');
        return;
      }

      if (action === 'changes') {
        updateApplicationStatus(reference, 'CHANGES REQUESTED', 'Applicant asked to update details before approval.');
      }
    });
  }

  function attachApplicationForm() {
    const businessForm = document.getElementById('businessForm');
    if (!businessForm) return;

    businessForm.addEventListener('submit', handleBusinessFormSubmit);

    const photoInput = document.getElementById('businessPhotos');
    if (photoInput) {
      photoInput.addEventListener('change', handleFileInputChange);
    }

    const videoInput = document.getElementById('businessVideo');
    if (videoInput) {
      videoInput.addEventListener('change', handleFileInputChange);
    }
  }

  function attachContactForm() {
    const contactForm = document.getElementById('contactForm');
    if (!contactForm) return;

    contactForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = document.getElementById('contactName').value.trim();
      const email = document.getElementById('contactEmail').value.trim();
      const message = document.getElementById('contactMessage').value.trim();

      if (!name || !email || !message) {
        setFeedback('contactResult', 'Please complete all contact form fields before sending your message.', 'error');
        return;
      }

      setFeedback('contactResult', `Thanks ${name}! Your message has been prepared and can be sent to the BISA team via your preferred inbox.`, 'success');
      contactForm.reset();
    });
  }

  function attachAdminDashboard() {
    const searchInput = document.getElementById('applicationSearch');
    if (searchInput) {
      searchInput.addEventListener('input', renderAdminTable);
    }

    const smsForm = document.getElementById('smsForm');
    if (smsForm) {
      smsForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const apps = getStoredApplications();
        const phone = document.getElementById('smsPhone').value;
        const template = document.getElementById('smsTemplate').value;
        const message = document.getElementById('smsMessage').value.trim();
        const app = apps.find((item) => item.phone === phone) || apps[0];

        if (!app) {
          setFeedback('smsResult', 'No application matched the selected recipient.', 'error');
          return;
        }

        if (!phone || !validPhone(phone)) {
          setFeedback('smsResult', 'Please select a valid Ghanaian phone number before sending the SMS.', 'error');
          return;
        }

        const isSuccess = !(phone.includes('000') || phone.includes('999'));
        if (!isSuccess) {
          setFeedback('smsResult', 'SMS provider returned an error. The message was not sent.', 'error');
          recordSms(message, phone, 'failed', template);
          return;
        }

        recordSms(message, phone, 'sent', template);
        setFeedback('smsResult', `SMS sent successfully to ${phone}.`, 'success');
        recordActivity(`SMS sent to ${app.applicantName} (${phone}) using the ${template} template.`);
      });
    }

    const smsTemplate = document.getElementById('smsTemplate');
    if (smsTemplate) {
      smsTemplate.addEventListener('change', () => {
        const apps = getStoredApplications();
        const currentPhone = document.getElementById('smsPhone')?.value || apps[0]?.phone || '';
        const name = apps[0]?.applicantName || 'Applicant';
        const message = buildSmsMessage(smsTemplate.value, name, 'Please contact us for clarification.');
        const smsMessage = document.getElementById('smsMessage');
        if (smsMessage) {
          smsMessage.value = message;
        }
        if (currentPhone) {
          document.getElementById('smsPhone').value = currentPhone;
        }
      });
    }
  }

  function attachAdminLogin() {
    const loginForm = document.getElementById('adminLoginForm');
    if (!loginForm) return;

    loginForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const email = document.getElementById('adminEmail').value.trim();
      const password = document.getElementById('adminPassword').value;

      if (email === 'admin@bisa.com' && password === 'BISAadmin!') {
        localStorage.setItem('bisaAdminSession', 'true');
        window.location.href = 'admin.html';
        return;
      }

      setFeedback('loginResult', 'Invalid administrator credentials. Please use the demo admin login.', 'error');
    });
  }

  function attachAdminLogout() {
    const logoutButton = document.getElementById('adminLogoutButton');
    if (!logoutButton) return;

    logoutButton.addEventListener('click', () => {
      localStorage.removeItem('bisaAdminSession');
      window.location.href = 'admin-login.html';
    });
  }

  function initialise() {
    const isAdminPage = document.body.dataset.page === 'admin';
    const isAdminLoginPage = document.body.dataset.page === 'admin-login';

    if (isAdminPage && localStorage.getItem('bisaAdminSession') !== 'true') {
      window.location.href = 'admin-login.html';
      return;
    }

    const businessForm = document.getElementById('businessForm');
    if (businessForm) {
      attachApplicationForm();
    }

    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
      attachContactForm();
    }

    if (isAdminLoginPage) {
      attachAdminLogin();
      return;
    }

    renderOverviewCards();
    if (document.getElementById('applicationsTableBody')) {
      attachAdminDashboard();
      attachAdminActions();
      attachAdminLogout();
      renderAdminTable();
      const firstApp = getStoredApplications()[0];
      if (firstApp) {
        renderDetailPanel(firstApp.reference);
      }
    }
  }

  initialise();
})();
