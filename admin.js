/* ==========================================================================
   Beacon Innovation Hub — Password-only Admin Dashboard
   ========================================================================== */

(() => {
  'use strict';

  /* --------------------------------------------------------------------------
     Configuration
     -------------------------------------------------------------------------- */

  const ADMIN_PASSWORD = 'BeaconAdmin@2026';
  const ADMIN_SESSION_KEY = 'bih_admin_session';

  const TYPE_LABEL = {
    update: 'Update',
    event: 'Event',
    article: 'Article',
    media: 'Photo'
  };

  let currentTab = 'update';
  let editingId = null;
  let pendingImage = '';
  let dashboardInitialised = false;

  /* --------------------------------------------------------------------------
     General utilities
     -------------------------------------------------------------------------- */

  function showToast(message) {
    let toast = document.querySelector('.toast');

    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(toast._timer);

    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }

  function getStorageType(type) {
    return type === 'media' ? 'photo' : type;
  }

  function getInterfaceType(type) {
    return type === 'photo' ? 'media' : type;
  }

  function showLogin() {
    const loginBox = document.getElementById('login-box');
    const dashboard = document.getElementById('dashboard');

    if (loginBox) {
      loginBox.hidden = false;
      loginBox.style.display = 'block';
    }

    if (dashboard) {
      dashboard.hidden = true;
      dashboard.style.display = 'none';
    }
  }

  function showDashboard() {
    const loginBox = document.getElementById('login-box');
    const dashboard = document.getElementById('dashboard');

    if (loginBox) {
      loginBox.hidden = true;
      loginBox.style.display = 'none';
    }

    if (dashboard) {
      dashboard.hidden = false;
      dashboard.style.display = 'block';
    }

    if (!dashboardInitialised) {
      initialiseDashboard();
      dashboardInitialised = true;
    }
  }

  function isSignedIn() {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
  }

  /* --------------------------------------------------------------------------
     Password-only login
     -------------------------------------------------------------------------- */

  function handleLogin(event) {
    event.preventDefault();

    const passwordInput = document.getElementById('login-pass');
    const loginError = document.getElementById('login-error');

    if (!passwordInput || !loginError) {
      return;
    }

    const enteredPassword = passwordInput.value;

    loginError.textContent = '';

    if (enteredPassword !== ADMIN_PASSWORD) {
      loginError.textContent = 'Incorrect administrator password.';
      passwordInput.value = '';
      passwordInput.focus();
      return;
    }

    sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');

    passwordInput.value = '';

    showDashboard();
    showToast('Administrator login successful');
  }

  function handleLogout() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);

    dashboardInitialised = false;

    showLogin();
    showToast('Signed out successfully');
  }

  /* --------------------------------------------------------------------------
     Application startup
     -------------------------------------------------------------------------- */

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof initThemeControls === 'function') {
      initThemeControls();
    }

    const loginForm = document.getElementById('login-form');
    const logoutButton = document.getElementById('logout-btn');

    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    }

    if (logoutButton) {
      logoutButton.addEventListener('click', handleLogout);
    }

    if (isSignedIn()) {
      showDashboard();
    } else {
      showLogin();
    }
  });

  /* --------------------------------------------------------------------------
     Dashboard setup
     -------------------------------------------------------------------------- */

  function initialiseDashboard() {
    document.querySelectorAll('.admin-tab').forEach(tab => {
      if (tab.dataset.initialised === 'true') {
        return;
      }

      tab.addEventListener('click', () => {
        switchTab(tab.dataset.type);
      });

      tab.dataset.initialised = 'true';
    });

    switchTab('update');
  }

  function switchTab(type) {
    currentTab = type;
    editingId = null;
    pendingImage = '';

    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.classList.toggle(
        'active',
        tab.dataset.type === type
      );
    });

    const settingsPanel = document.getElementById('settings-panel');
    const contentPanel = document.getElementById('content-panel');

    if (settingsPanel) {
      settingsPanel.hidden = type !== 'settings';
      settingsPanel.style.display =
        type === 'settings' ? 'block' : 'none';
    }

    if (contentPanel) {
      contentPanel.hidden = type === 'settings';
      contentPanel.style.display =
        type === 'settings' ? 'none' : 'grid';
    }

    if (type !== 'settings') {
      renderForm(type);
      renderTable(type);
    }
  }

  /* --------------------------------------------------------------------------
     Form fields
     -------------------------------------------------------------------------- */

  function fieldsFor(type) {
    const isMedia = type === 'media';

    const commonFields = `
      <div class="field">
        <label for="f-title">Title</label>
        <input
          id="f-title"
          required
          maxlength="120"
          placeholder="e.g. Systems Design Night"
        >
      </div>

      <div class="field">
        <label for="f-excerpt">
          ${isMedia ? 'Caption' : 'Short summary'}
        </label>

        <textarea
          id="f-excerpt"
          required
          maxlength="220"
          style="min-height:70px"
          placeholder="One or two sentences for the card preview"
        ></textarea>
      </div>
    `;

    const contentField = `
      <div class="field">
        <label for="f-content">Full content</label>

        <textarea
          id="f-content"
          required
          placeholder="Write the full post. Use blank lines for paragraphs."
        ></textarea>
      </div>
    `;

    const tagsField = `
      <div class="field">
        <label for="f-tags">Tags (comma separated)</label>

        <input
          id="f-tags"
          placeholder="e.g. architecture, workshop"
        >
      </div>
    `;

    const imageField = `
      <div class="field">
        <label for="f-image">
          Image ${isMedia ? '(required)' : '(optional)'}
        </label>

        <input
          id="f-image"
          type="file"
          accept="image/*"
        >

        <div
          class="img-preview"
          id="f-image-preview"
        >
          No image selected
        </div>
      </div>
    `;

    const eventFields = `
      <div class="field">
        <label for="f-eventdate">Event date and time</label>

        <input
          id="f-eventdate"
          type="datetime-local"
          required
        >
      </div>

      <div class="field">
        <label for="f-location">Location</label>

        <input
          id="f-location"
          placeholder="e.g. Beacon Hub — Main Floor"
        >
      </div>
    `;

    if (type === 'media') {
      return commonFields + imageField + tagsField;
    }

    if (type === 'event') {
      return (
        commonFields +
        eventFields +
        contentField +
        tagsField +
        imageField
      );
    }

    return commonFields + contentField + tagsField + imageField;
  }

  /* --------------------------------------------------------------------------
     Render publishing form
     -------------------------------------------------------------------------- */

  function renderForm(type) {
    const formWrap = document.getElementById('form-wrap');

    if (!formWrap) {
      return;
    }

    formWrap.innerHTML = `
      <h3 id="form-title">
        New ${TYPE_LABEL[type]}
      </h3>

      <p class="hint">
        Complete all required fields before publishing.
      </p>

      <form id="post-form">
        ${fieldsFor(type)}

        <div class="form-actions">
          <button
            type="submit"
            class="btn btn-primary btn-block"
            id="submit-btn"
          >
            Publish ${TYPE_LABEL[type]}
          </button>

          <button
            type="button"
            class="btn btn-ghost"
            id="cancel-edit"
            style="display:none"
          >
            Cancel
          </button>
        </div>
      </form>
    `;

    const imageInput = document.getElementById('f-image');

    if (imageInput) {
      imageInput.addEventListener('change', () => {
        const file = imageInput.files[0];

        if (!file) {
          return;
        }

        if (!file.type.startsWith('image/')) {
          showToast('Please select a valid image file.');
          imageInput.value = '';
          return;
        }

        if (file.size > 3.5 * 1024 * 1024) {
          showToast('Image too large. Use an image under 3.5 MB.');
          imageInput.value = '';
          return;
        }

        const reader = new FileReader();

        reader.onload = () => {
          pendingImage = reader.result;

          const preview = document.getElementById(
            'f-image-preview'
          );

          if (preview) {
            preview.innerHTML = `
              <img
                src="${pendingImage}"
                alt="Selected image preview"
              >
            `;
          }
        };

        reader.onerror = () => {
          showToast('The selected image could not be read.');
        };

        reader.readAsDataURL(file);
      });
    }

    const postForm = document.getElementById('post-form');

    if (postForm) {
      postForm.addEventListener('submit', event => {
        event.preventDefault();
        savePost(type);
      });
    }
  }

  /* --------------------------------------------------------------------------
     Save posts
     -------------------------------------------------------------------------- */

  function savePost(type) {
    if (typeof STORE === 'undefined') {
      showToast('The content store could not be loaded.');
      return;
    }

    const titleInput = document.getElementById('f-title');
    const excerptInput = document.getElementById('f-excerpt');

    if (!titleInput || !excerptInput) {
      return;
    }

    const title = titleInput.value.trim();
    const excerpt = excerptInput.value.trim();

    if (!title || !excerpt) {
      showToast('Complete all required fields.');
      return;
    }

    const storageType = getStorageType(type);

    const post = editingId
      ? STORE.getById(editingId)
      : { type: storageType };

    if (!post) {
      showToast('The selected post could not be found.');
      return;
    }

    post.type = storageType;
    post.title = title;
    post.excerpt = excerpt;

    const contentInput = document.getElementById('f-content');

    if (contentInput) {
      post.content = contentInput.value.trim();

      if (!post.content) {
        showToast('Enter the full content.');
        return;
      }
    } else if (type === 'media') {
      post.content = excerpt;
    }

    const tagsInput = document.getElementById('f-tags');

    if (tagsInput) {
      post.tags = tagsInput.value
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean);
    }

    if (type === 'event') {
      const eventDateInput =
        document.getElementById('f-eventdate');

      const locationInput =
        document.getElementById('f-location');

      if (!eventDateInput || !eventDateInput.value) {
        showToast('Select an event date and time.');
        return;
      }

      post.eventDate = new Date(
        eventDateInput.value
      ).toISOString();

      post.location = locationInput
        ? locationInput.value.trim()
        : '';
    }

    if (pendingImage) {
      post.image = pendingImage;
    } else if (type === 'media' && !post.image) {
      showToast('Please add an image for the gallery post.');
      return;
    }

    post.image = post.image || '';

    if (!editingId) {
      post.date = new Date().toISOString();
    }

    STORE.upsert(post);

    showToast(
      editingId
        ? 'Changes saved.'
        : `${TYPE_LABEL[type]} published.`
    );

    editingId = null;
    pendingImage = '';

    renderForm(type);
    renderTable(type);
  }

  /* --------------------------------------------------------------------------
     Render posts
     -------------------------------------------------------------------------- */

  function renderTable(type) {
    if (typeof STORE === 'undefined') {
      return;
    }

    const storageType = getStorageType(type);
    const posts = STORE.byType(storageType);
    const tableWrap = document.getElementById('table-wrap');

    if (!tableWrap) {
      return;
    }

    if (!posts.length) {
      tableWrap.innerHTML = `
        <div class="empty">
          No ${TYPE_LABEL[type].toLowerCase()} posts yet.
          Use the form to publish the first one.
        </div>
      `;

      return;
    }

    tableWrap.innerHTML = `
      <div class="admin-list">
        ${posts.map(post => `
          <div class="admin-row">

            ${
              post.image
                ? `
                  <img
                    class="thumb"
                    src="${post.image}"
                    alt=""
                  >
                `
                : '<div class="thumb"></div>'
            }

            <div class="info">
              <h4>
                ${safeText(post.title)}
              </h4>

              <p>
                ${formatPostDate(post.date)}

                ${
                  post.eventDate
                    ? ` · event: ${formatPostDate(post.eventDate)}`
                    : ''
                }
              </p>
            </div>

            <div class="row-actions">
              <button
                class="icon-btn"
                data-edit="${post.id}"
                title="Edit"
                type="button"
              >
                ${editIcon()}
              </button>

              <button
                class="icon-btn del"
                data-delete="${post.id}"
                title="Delete"
                type="button"
              >
                ${trashIcon()}
              </button>
            </div>

          </div>
        `).join('')}
      </div>
    `;

    tableWrap
      .querySelectorAll('[data-edit]')
      .forEach(button => {
        button.addEventListener('click', () => {
          loadPostForEditing(button.dataset.edit);
        });
      });

    tableWrap
      .querySelectorAll('[data-delete]')
      .forEach(button => {
        button.addEventListener('click', () => {
          const confirmed = window.confirm(
            'Delete this post? This action cannot be undone.'
          );

          if (!confirmed) {
            return;
          }

          STORE.remove(button.dataset.delete);

          showToast('Post deleted.');
          renderTable(type);
        });
      });
  }

  /* --------------------------------------------------------------------------
     Edit posts
     -------------------------------------------------------------------------- */

  function loadPostForEditing(id) {
    if (typeof STORE === 'undefined') {
      return;
    }

    const post = STORE.getById(id);

    if (!post) {
      showToast('The selected post could not be found.');
      return;
    }

    editingId = id;
    pendingImage = '';

    const interfaceType = getInterfaceType(post.type);

    currentTab = interfaceType;

    renderForm(interfaceType);

    const formTitle = document.getElementById('form-title');
    const submitButton = document.getElementById('submit-btn');
    const cancelButton = document.getElementById('cancel-edit');

    if (formTitle) {
      formTitle.textContent =
        `Edit ${TYPE_LABEL[interfaceType]}`;
    }

    if (submitButton) {
      submitButton.textContent = 'Save changes';
    }

    if (cancelButton) {
      cancelButton.style.display = 'inline-flex';

      cancelButton.addEventListener('click', () => {
        switchTab(interfaceType);
      });
    }

    const titleInput = document.getElementById('f-title');
    const excerptInput = document.getElementById('f-excerpt');
    const contentInput = document.getElementById('f-content');
    const tagsInput = document.getElementById('f-tags');

    if (titleInput) {
      titleInput.value = post.title || '';
    }

    if (excerptInput) {
      excerptInput.value = post.excerpt || '';
    }

    if (contentInput) {
      contentInput.value = post.content || '';
    }

    if (tagsInput) {
      tagsInput.value = (post.tags || []).join(', ');
    }

    if (interfaceType === 'event') {
      const eventDateInput =
        document.getElementById('f-eventdate');

      const locationInput =
        document.getElementById('f-location');

      if (eventDateInput) {
        eventDateInput.value = post.eventDate
          ? toLocalDateTimeInput(post.eventDate)
          : '';
      }

      if (locationInput) {
        locationInput.value = post.location || '';
      }
    }

    if (post.image) {
      const preview =
        document.getElementById('f-image-preview');

      if (preview) {
        preview.innerHTML = `
          <img
            src="${post.image}"
            alt="Current post image"
          >
        `;
      }
    }

    const formWrap = document.getElementById('form-wrap');

    if (formWrap) {
      formWrap.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }

  /* --------------------------------------------------------------------------
     Formatting helpers
     -------------------------------------------------------------------------- */

  function safeText(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatPostDate(value) {
    if (!value) {
      return '';
    }

    if (typeof fmtDate === 'function') {
      return fmtDate(value);
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function toLocalDateTimeInput(isoDate) {
    const date = new Date(isoDate);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const pad = number =>
      String(number).padStart(2, '0');

    return (
      `${date.getFullYear()}-` +
      `${pad(date.getMonth() + 1)}-` +
      `${pad(date.getDate())}T` +
      `${pad(date.getHours())}:` +
      `${pad(date.getMinutes())}`
    );
  }

  /* --------------------------------------------------------------------------
     Icons
     -------------------------------------------------------------------------- */

  function editIcon() {
    return `
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="M12 20h9"></path>
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
      </svg>
    `;
  }

  function trashIcon() {
    return `
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="M3 6h18"></path>
        <path d="M8 6V4h8v2"></path>
        <path d="M19 6l-1 14H6L5 6"></path>
      </svg>
    `;
  }
})();
