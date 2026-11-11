(function () {
  const sessionKey = 'bisaAdminAccessToken';
  let configPromise;
  let contactEmail = 'hello@bisa-campus.com';

  function loadConfig() {
    if (!configPromise) {
      configPromise = fetch('/api/config')
        .then(async (response) => {
          const config = await response.json();
          if (!response.ok) throw new Error(config.error || 'BISA backend configuration is unavailable.');
          return config;
        });
    }
    return configPromise;
  }

  function showFeedback(id, message, type) {
    const target = document.getElementById(id);
    if (!target) return;
    target.className = `feedback ${type}`;
    target.textContent = message;
  }

  async function request(path, options) {
    const token = sessionStorage.getItem(sessionKey);
    const response = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options && options.headers ? options.headers : {})
      }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) sessionStorage.removeItem(sessionKey);
      throw new Error(result.error || 'The request could not be completed.');
    }
    return result;
  }

  function selectedMimeType(file) {
    if (file.type) return file.type;
    const extension = file.name.split('.').pop().toLowerCase();
    const types = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime'
    };
    return types[extension] || '';
  }

  function previewFiles(input, targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.querySelectorAll('img').forEach((image) => URL.revokeObjectURL(image.src));
    target.replaceChildren();
    const files = Array.from(input.files || []);
    files.forEach((file, index) => {
      const row = document.createElement('div');
      row.className = 'file-preview-item';
      const name = document.createElement('span');
      name.textContent = file.name;
      if (selectedMimeType(file).startsWith('image/')) {
        const image = document.createElement('img');
        image.src = URL.createObjectURL(file);
        image.alt = `Preview of ${file.name}`;
        image.className = 'file-preview-image';
        row.appendChild(image);
      }
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-file';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        const updated = Array.from(input.files || []);
        updated.splice(index, 1);
        const transfer = new DataTransfer();
        updated.forEach((selected) => transfer.items.add(selected));
        input.files = transfer.files;
        previewFiles(input, targetId);
      });
      row.append(name, remove);
      target.appendChild(row);
    });
  }

  async function uploadFile(batchId, file) {
    const contentType = selectedMimeType(file);
    const signed = await request('/api/upload-url', {
      method: 'POST',
      body: JSON.stringify({ batchId, contentType, size: file.size })
    });
    const upload = await fetch(signed.signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType, 'x-upsert': 'false' },
      body: file
    });
    if (!upload.ok) {
      const result = await upload.json().catch(() => ({}));
      throw new Error(result.message || 'A file could not be uploaded. Check your connection and try again.');
    }
    return { path: signed.path, name: file.name };
  }

  function attachBusinessForm() {
    const form = document.getElementById('businessForm');
    if (!form) return;
    const images = document.getElementById('businessPhotos');
    const video = document.getElementById('businessVideo');
    images?.addEventListener('change', () => previewFiles(images, 'imagePreviews'));
    video?.addEventListener('change', () => {
      const target = document.getElementById('videoPreview');
      if (target) target.textContent = video.files[0]?.name || 'No video selected';
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const imageFiles = Array.from(images?.files || []);
      const videoFiles = Array.from(video?.files || []);
      const allFiles = [...imageFiles, ...videoFiles];
      if (imageFiles.length < 3) {
        showFeedback('submissionResult', 'Please upload at least three business photos before submitting.', 'error');
        return;
      }
      if (videoFiles.length > 1) {
        showFeedback('submissionResult', 'Please upload only one optional business video.', 'error');
        return;
      }
      const allowedImages = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
      const allowedVideos = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
      if (imageFiles.some((file) => !allowedImages.has(selectedMimeType(file)) || file.size > 5 * 1024 * 1024)) {
        showFeedback('submissionResult', 'Photos must be JPG, PNG, WEBP or GIF and no larger than 5MB each.', 'error');
        return;
      }
      if (videoFiles.some((file) => !allowedVideos.has(selectedMimeType(file)) || file.size > 25 * 1024 * 1024)) {
        showFeedback('submissionResult', 'The optional video must be MP4, WEBM or MOV and no larger than 25MB.', 'error');
        return;
      }

      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      showFeedback('submissionResult', 'Uploading your files securely…', 'success');
      try {
        await loadConfig();
        const batchId = crypto.randomUUID();
        const media = [];
        for (const file of allFiles) {
          media.push(await uploadFile(batchId, file));
        }
        const values = {
          applicantName: form.elements.owner.value.trim(),
          businessName: form.elements.businessName.value.trim(),
          email: form.elements.email.value.trim(),
          phone: form.elements.phone.value.trim(),
          category: form.elements.category.value,
          location: form.elements.location.value.trim(),
          description: form.elements.description.value.trim(),
          offerings: form.elements.offering.value.trim(),
          batchId,
          media
        };
        const result = await request('/api/applications', {
          method: 'POST',
          body: JSON.stringify(values)
        });
        showFeedback('submissionResult', `Application received. Your reference is ${result.reference}. It is pending administrator review.`, 'success');
        form.reset();
        previewFiles(images, 'imagePreviews');
        const videoPreview = document.getElementById('videoPreview');
        if (videoPreview) videoPreview.textContent = 'No video selected';
      } catch (error) {
        showFeedback('submissionResult', error.message, 'error');
      } finally {
        button.disabled = false;
      }
    });
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character]));
  }

  function attachExplore() {
    const grid = document.querySelector('.listing-grid');
    if (!grid) return;
    const search = document.querySelector('.market-search input[type="search"]');
    const searchButton = document.querySelector('.market-search button');
    const filterButton = document.querySelector('.filter-panel .full-button');
    const sort = document.querySelector('.listings-heading select');
    let businesses = [];

    function render() {
      const term = (search?.value || '').trim().toLowerCase();
      const locations = Array.from(document.querySelectorAll('input[name="location"]:checked'))
        .map((input) => input.value);
      let filtered = businesses.filter((business) => {
        const searchable = [
          business.business_name,
          business.description,
          business.offerings,
          business.categories?.name,
          business.campus_location
        ].join(' ').toLowerCase();
        const locationMatch = !locations.length || locations.some((location) =>
          location === 'campus' ? /campus/i.test(business.campus_location || '') : !/campus/i.test(business.campus_location || '')
        );
        return searchable.includes(term) && locationMatch;
      });
      if (sort?.value === 'Newest') {
        filtered = filtered.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
      if (sort?.value === 'Featured') {
        filtered = filtered.slice().sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
      }
      if (!filtered.length) {
        grid.innerHTML = '<p class="empty-state">No approved businesses match your search yet.</p>';
        return;
      }
      grid.innerHTML = filtered.map((business) => {
        const image = business.business_media?.[0];
        const products = (business.products_services || []).map((product) =>
          `<li>${escapeHtml(product.title)}${product.price != null ? ` — ${escapeHtml(product.price)}` : ''}</li>`
        ).join('');
        return `
          <article class="listing-card">
            ${image ? `<img class="listing-image" src="${escapeHtml(image.url)}" alt="${escapeHtml(business.business_name)}" loading="lazy">` : '<div class="image-placeholder">BISA business</div>'}
            <div class="listing-content">
              <p class="listing-category">${escapeHtml(business.categories?.name || 'Student business')}</p>
              <h3>${escapeHtml(business.business_name)}</h3>
              <p>${escapeHtml(business.description)}</p>
              ${products ? `<ul class="listing-offerings">${products}</ul>` : `<p>${escapeHtml(business.offerings)}</p>`}
              <div class="listing-footer">
                <span>${escapeHtml(business.campus_location || 'Campus')}</span>
                <a class="contact-link" href="mailto:${encodeURIComponent(business.contact_email)}">Contact</a>
              </div>
            </div>
          </article>`;
      }).join('');
    }

    search?.addEventListener('search', render);
    searchButton?.addEventListener('click', render);
    filterButton?.addEventListener('click', render);
    sort?.addEventListener('change', render);
    search?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') render();
    });

    request('/api/businesses')
      .then((result) => {
        businesses = result.businesses || [];
        render();
      })
      .catch((error) => {
        grid.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
      });
  }

  function attachHomeContent() {
    const home = Boolean(document.querySelector('.home-hero'));
    const contact = Boolean(document.querySelector('.contact-info'));
    if (!home && !contact) return;
    request('/api/content')
      .then(({ content }) => {
        const title = document.querySelector('.home-hero h1');
        const text = document.querySelector('.home-hero .hero-text');
        const announcement = document.querySelector('[data-site-announcement]');
        if (content['home.hero_title'] && title) title.textContent = content['home.hero_title'];
        if (content['home.hero_text'] && text) text.textContent = content['home.hero_text'];
        if (content['home.announcement'] && announcement) {
          announcement.textContent = content['home.announcement'];
          announcement.hidden = false;
        }
        if (content['contact.email']) {
          contactEmail = content['contact.email'];
          const email = document.querySelector('.contact-info .contact-item:nth-of-type(1) p');
          if (email) email.textContent = contactEmail;
        }
        const phone = document.querySelector('.contact-info .contact-item:nth-of-type(2) p');
        const location = document.querySelector('.contact-info .contact-item:nth-of-type(3) p');
        if (content['contact.phone'] && phone) phone.textContent = content['contact.phone'];
        if (content['contact.location'] && location) location.textContent = content['contact.location'];
      })
      .catch((error) => console.error('Could not load BISA site content:', error));

    const featured = document.querySelector('[data-featured-list]');
    if (featured) {
      request('/api/businesses')
        .then(({ businesses }) => {
          const selected = (businesses || []).filter((business) => business.is_featured).slice(0, 3);
          featured.innerHTML = selected.length ? selected.map((business) => `
            <article class="listing-card">
              ${business.business_media?.[0] ? `<img class="listing-image" src="${escapeHtml(business.business_media[0].url)}" alt="${escapeHtml(business.business_name)}" loading="lazy">` : '<div class="image-placeholder">BISA business</div>'}
              <div class="listing-content">
                <p class="listing-category">${escapeHtml(business.categories?.name || 'Student business')}</p>
                <h3>${escapeHtml(business.business_name)}</h3>
                <p>${escapeHtml(business.description)}</p>
                <div class="listing-footer"><span>${escapeHtml(business.campus_location || 'Campus')}</span><a href="mailto:${encodeURIComponent(business.contact_email)}">Contact</a></div>
              </div>
            </article>`).join('') : '<p class="empty-state">Featured businesses will appear here after the BISA team publishes them.</p>';
        })
        .catch((error) => {
          featured.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
        });
    }
  }

  async function attachAdminLogin() {
    const form = document.getElementById('adminLoginForm');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        const config = await loadConfig();
        const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: document.getElementById('adminEmail').value.trim(),
            password: document.getElementById('adminPassword').value
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.msg || result.message || 'Sign-in failed. Check your email and password.');
        sessionStorage.setItem(sessionKey, result.access_token);
        await request('/api/admin?resource=overview');
        window.location.href = 'admin.html';
      } catch (error) {
        sessionStorage.removeItem(sessionKey);
        showFeedback('loginResult', error.message, 'error');
      } finally {
        button.disabled = false;
      }
    });
  }

  function attachContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const subject = form.elements.subject?.value.trim() || 'BISA website enquiry';
      const body = [
        `Name: ${form.elements.name.value.trim()}`,
        `Email: ${form.elements.email.value.trim()}`,
        '',
        form.elements.message.value.trim()
      ].join('\n');
      const link = document.createElement('a');
      link.href = `mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      link.click();
      showFeedback('contactResult', 'Your email app has been opened with the message ready to send.', 'success');
    });
  }

  attachBusinessForm();
  attachExplore();
  attachHomeContent();
  attachAdminLogin();
  attachContactForm();
  if (document.getElementById('applicationsTableBody')) {
    const script = document.createElement('script');
    script.src = 'admin-dashboard.js';
    script.defer = true;
    document.body.appendChild(script);
  }
})();
