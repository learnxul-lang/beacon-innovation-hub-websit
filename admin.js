/* Beacon Innovation Hub — Password-only Administrator Dashboard */

(() => {
  'use strict';

  const ADMIN_PASSWORD = 'BeaconAdmin@2026';
  const SESSION_KEY = 'bih_admin_logged_in';

  const TYPE_LABELS = {
    update: 'Update',
    event: 'Event',
    article: 'Article',
    media: 'Gallery photograph'
  };

  let editingId = null;
  let pendingImage = '';
  let dashboardInitialised = false;

  function getElement(id) {
    return document.getElementById(id);
  }

  function ensureStore() {
    if (!window.STORE) {
      throw new Error(
        'store.js could not be loaded. Make sure store.js loads before admin.js.'
      );
    }

    return window.STORE;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function setMessage(element, message, type = 'error') {
    if (!element) {
      return;
    }

    element.textContent = message;
    element.style.color =
      type === 'success'
        ? '#18794e'
        : '#b42318';
  }

  function clearMessage(element) {
    if (element) {
      element.textContent = '';
    }
  }

  function showToast(message) {
    let toast = document.querySelector('.toast');

    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(toast._timer);

    toast._timer = window.setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  function formatDate(value) {
    if (!value) {
      return '';
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

  function toDateTimeLocal(value) {
    const date = new Date(value);

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

  function showLogin() {
    const loginBox = getElement('login-box');
    const dashboard = getElement('dashboard');

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
    const loginBox = getElement('login-box');
    const dashboard = getElement('dashboard');
    const sessionPill = document.querySelector('.session-pill');

    if (loginBox) {
      loginBox.hidden = true;
      loginBox.style.display = 'none';
    }

    if (dashboard) {
      dashboard.hidden = false;
      dashboard.style.display = 'block';
    }

    if (sessionPill) {
      sessionPill.textContent = 'Administrator signed in';
    }

    if (!dashboardInitialised) {
      initialiseDashboard();
      dashboardInitialised = true;
    }
  }

  function setLoginLoading(loading) {
    const loginForm = getElement('login-form');
    const button = loginForm?.querySelector(
      'button[type="submit"]'
    );

    if (!button) {
      return;
    }

    button.disabled = loading;
    button.textContent = loading
      ? 'Signing in…'
      : 'Sign in';
  }

  function handleLogin(event) {
    event.preventDefault();

    const loginError = getElement('login-error');
    const passwordInput = getElement('login-pass');

    clearMessage(loginError);

    if (!passwordInput) {
      setMessage(
        loginError,
        'The password field is missing.'
      );
      return;
    }

    const password = passwordInput.value;

    if (!password) {
      setMessage(
        loginError,
        'Enter the administrator password.'
      );
      return;
    }

    setLoginLoading(true);

    try {
      if (password !== ADMIN_PASSWORD) {
        throw new Error(
          'Incorrect administrator password.'
        );
      }

      sessionStorage.setItem(
        SESSION_KEY,
        'true'
      );

      passwordInput.value = '';

      showDashboard();
      showToast('Administrator login successful.');
    } catch (error) {
      setMessage(
        loginError,
        error?.message ||
          'The administrator login failed.'
      );
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);

    dashboardInitialised = false;
    editingId = null;
    pendingImage = '';

    showLogin();
    showToast('Signed out successfully.');
  }

  function restoreSession() {
    const loggedIn =
      sessionStorage.getItem(SESSION_KEY) === 'true';

    if (loggedIn) {
      showDashboard();
    } else {
      showLogin();
    }
  }

  function initialiseDashboard() {
    document
      .querySelectorAll('.admin-tab')
      .forEach(tab => {
        if (
          tab.dataset.listenerAttached === 'true'
        ) {
          return;
        }

        tab.addEventListener('click', () => {
          switchTab(tab.dataset.type);
        });

        tab.dataset.listenerAttached = 'true';
      });

    switchTab('update');
  }

  function switchTab(type) {
    editingId = null;
    pendingImage = '';

    document
      .querySelectorAll('.admin-tab')
      .forEach(tab => {
        tab.classList.toggle(
          'active',
          tab.dataset.type === type
        );
      });

    const contentPanel = getElement('content-panel');
    const settingsPanel = getElement('settings-panel');

    const showingSettings =
      type === 'settings';

    if (contentPanel) {
      contentPanel.hidden = showingSettings;
      contentPanel.style.display =
        showingSettings ? 'none' : 'grid';
    }

    if (settingsPanel) {
      settingsPanel.hidden = !showingSettings;
      settingsPanel.style.display =
        showingSettings ? 'block' : 'none';
    }

    if (!showingSettings) {
      renderForm(type);
      void renderTable(type);
    }
  }

  function buildFormFields(type) {
    const media = type === 'media';

    const commonFields = `
      <div class="field">
        <label for="f-title">Title</label>

        <input
          id="f-title"
          type="text"
          required
          maxlength="120"
          placeholder="Enter the publication title"
        >
      </div>

      <div class="field">
        <label for="f-excerpt">
          ${media ? 'Caption' : 'Short summary'}
        </label>

        <textarea
          id="f-excerpt"
          required
          maxlength="220"
          style="min-height:80px"
          placeholder="${
            media
              ? 'Write a caption for this photograph'
              : 'Write a short preview summary'
          }"
        ></textarea>
      </div>
    `;

    const categoryField = `
      <div class="field">
        <label for="f-category">Category</label>

        <input
          id="f-category"
          type="text"
          maxlength="80"
          placeholder="For example: Software Development"
        >
      </div>
    `;

    const contentField = `
      <div class="field">
        <label for="f-content">Full content</label>

        <textarea
          id="f-content"
          required
          placeholder="Write the complete publication"
        ></textarea>
      </div>
    `;

    const tagsField = `
      <div class="field">
        <label for="f-tags">Tags</label>

        <input
          id="f-tags"
          type="text"
          placeholder="innovation, technology, community"
        >

        <p class="hint">
          Separate tags using commas.
        </p>
      </div>
    `;

    const imageField = `
      <div class="field">
        <label for="f-image">
          Image ${media ? '(required)' : '(optional)'}
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

    const relatedFields = `
      <div class="field">
        <label for="f-linkurl">Related link</label>

        <input
          id="f-linkurl"
          type="url"
          placeholder="https://example.com"
        >
      </div>

      <div class="field">
        <label for="f-linklabel">
          Related link label
        </label>

        <input
          id="f-linklabel"
          type="text"
          maxlength="80"
          placeholder="For example: Read more"
        >
      </div>
    `;

    const eventFields = `
      <div class="field">
        <label for="f-eventdate">
          Event date and time
        </label>

        <input
          id="f-eventdate"
          type="datetime-local"
          required
        >
      </div>

      <div class="field">
        <label for="f-location">
          Event location
        </label>

        <input
          id="f-location"
          type="text"
          placeholder="Enter the event venue"
        >
      </div>

      <div class="field">
        <label for="f-registration">
          Registration link
        </label>

        <input
          id="f-registration"
          type="url"
          placeholder="https://example.com/register"
        >
      </div>
    `;

    const youtubeField = `
      <div class="field">
        <label for="f-youtube">
          YouTube video URL
        </label>

        <input
          id="f-youtube"
          type="url"
          placeholder="https://youtube.com/watch?v=..."
        >
      </div>
    `;

    if (type === 'media') {
      return (
        commonFields +
        categoryField +
        imageField +
        tagsField
      );
    }

    if (type === 'event') {
      return (
        commonFields +
        categoryField +
        eventFields +
        contentField +
        relatedFields +
        tagsField +
        imageField
      );
    }

    if (type === 'article') {
      return (
        commonFields +
        categoryField +
        contentField +
        youtubeField +
        relatedFields +
        tagsField +
        imageField
      );
    }

    return (
      commonFields +
      categoryField +
      contentField +
      relatedFields +
      tagsField +
      imageField
    );
  }

  function renderForm(type) {
    const formWrap = getElement('form-wrap');

    if (!formWrap) {
      return;
    }

    formWrap.innerHTML = `
      <h3 id="form-title">
        New ${TYPE_LABELS[type]}
      </h3>

      <p class="hint">
        Complete all required fields before publishing.
      </p>

      <form id="post-form">
        ${buildFormFields(type)}

        <div class="form-actions">
          <button
            type="submit"
            class="btn btn-primary btn-block"
            id="submit-btn"
          >
            Publish ${TYPE_LABELS[type]}
          </button>

          <button
            type="button"
            class="btn btn-ghost"
            id="cancel-edit"
            style="display:none"
          >
            Cancel editing
          </button>
        </div>
      </form>
    `;

    getElement('f-image')
      ?.addEventListener(
        'change',
        handleImageSelection
      );

    getElement('post-form')
      ?.addEventListener(
        'submit',
        event => {
          event.preventDefault();
          void savePost(type);
        }
      );
  }

  function handleImageSelection(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('Select a valid image file.');
      event.target.value = '';
      return;
    }

    const maximumSize =
      3.5 * 1024 * 1024;

    if (file.size > maximumSize) {
      showToast(
        'The image is too large. Select an image smaller than 3.5 MB.'
      );

      event.target.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      pendingImage =
        String(reader.result || '');

      const preview =
        getElement('f-image-preview');

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
      showToast(
        'The selected image could not be read.'
      );
    };

    reader.readAsDataURL(file);
  }

  async function savePost(type) {
    const titleInput = getElement('f-title');
    const excerptInput = getElement('f-excerpt');
    const submitButton = getElement('submit-btn');

    const title =
      titleInput?.value.trim() || '';

    const excerpt =
      excerptInput?.value.trim() || '';

    if (!title) {
      showToast('Enter a publication title.');
      titleInput?.focus();
      return;
    }

    if (!excerpt) {
      showToast(
        'Enter a short summary or caption.'
      );
      excerptInput?.focus();
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent =
        editingId
          ? 'Saving changes…'
          : 'Publishing…';
    }

    try {
      const store = ensureStore();

      let post = {};

      if (editingId) {
        post = await store.getById(editingId);

        if (!post) {
          throw new Error(
            'The selected publication could not be found.'
          );
        }
      }

      post.type = type;
      post.title = title;
      post.excerpt = excerpt;

      const contentInput =
        getElement('f-content');

      if (contentInput) {
        post.content =
          contentInput.value.trim();

        if (!post.content) {
          throw new Error(
            'Enter the full publication content.'
          );
        }
      } else {
        post.content = excerpt;
      }

      post.category =
        getElement('f-category')
          ?.value.trim() || '';

      const tagsInput =
        getElement('f-tags');

      post.tags = tagsInput
        ? tagsInput.value
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean)
        : [];

      post.youtubeUrl =
        getElement('f-youtube')
          ?.value.trim() || '';

      post.linkUrl =
        getElement('f-linkurl')
          ?.value.trim() || '';

      post.linkLabel =
        getElement('f-linklabel')
          ?.value.trim() || '';

      if (
        post.linkLabel &&
        !post.linkUrl
      ) {
        throw new Error(
          'Enter a related link URL or remove the related link label.'
        );
      }

      if (type === 'event') {
        const eventDateInput =
          getElement('f-eventdate');

        if (!eventDateInput?.value) {
          throw new Error(
            'Select the event date and time.'
          );
        }

        post.eventDate =
          new Date(
            eventDateInput.value
          ).toISOString();

        post.location =
          getElement('f-location')
            ?.value.trim() || '';

        post.registrationUrl =
          getElement('f-registration')
            ?.value.trim() || '';
      } else {
        post.eventDate = '';
        post.location = '';
        post.registrationUrl = '';
      }

      if (pendingImage) {
        post.image = pendingImage;
      }

      if (
        type === 'media' &&
        !post.image
      ) {
        throw new Error(
          'Select an image for the gallery publication.'
        );
      }

      post.image = post.image || '';
      post.imagePath = post.imagePath || '';
      post.status = 'published';

      if (!editingId) {
        post.date =
          new Date().toISOString();
      }

      await store.upsert(post);

      const wasEditing =
        Boolean(editingId);

      editingId = null;
      pendingImage = '';

      showToast(
        wasEditing
          ? 'Changes saved successfully.'
          : `${TYPE_LABELS[type]} published successfully.`
      );

      renderForm(type);
      await renderTable(type);
    } catch (error) {
      console.error(
        'Publication failed:',
        error
      );

      showToast(
        error?.message ||
          'The publication could not be saved.'
      );
    } finally {
      if (
        submitButton &&
        document.body.contains(submitButton)
      ) {
        submitButton.disabled = false;
        submitButton.textContent =
          editingId
            ? 'Save changes'
            : `Publish ${TYPE_LABELS[type]}`;
      }
    }
  }

  async function renderTable(type) {
    const tableWrap =
      getElement('table-wrap');

    if (!tableWrap) {
      return;
    }

    tableWrap.innerHTML = `
      <div class="empty">
        Loading publications…
      </div>
    `;

    try {
      const posts =
        await ensureStore().byType(type);

      if (!posts.length) {
        tableWrap.innerHTML = `
          <div class="empty">
            No ${TYPE_LABELS[
              type
            ].toLowerCase()} publications are available yet.
          </div>
        `;

        return;
      }

      tableWrap.innerHTML = `
        <div class="admin-list">
          ${posts
            .map(
              post => `
                <div class="admin-row">

                  ${
                    post.image
                      ? `
                        <img
                          class="thumb"
                          src="${escapeHtml(
                            post.image
                          )}"
                          alt=""
                        >
                      `
                      : `
                        <div
                          class="thumb"
                          aria-hidden="true"
                        ></div>
                      `
                  }

                  <div class="info">
                    <h4>
                      ${escapeHtml(post.title)}
                    </h4>

                    <p>
                      ${formatDate(post.date)}

                      ${
                        post.category
                          ? ` · ${escapeHtml(
                              post.category
                            )}`
                          : ''
                      }

                      ${
                        post.eventDate
                          ? ` · Event: ${formatDate(
                              post.eventDate
                            )}`
                          : ''
                      }
                    </p>

                    <p>
                      ${escapeHtml(
                        post.excerpt || ''
                      )}
                    </p>
                  </div>

                  <div class="row-actions">
                    <button
                      class="icon-btn"
                      data-edit="${escapeHtml(
                        post.id
                      )}"
                      type="button"
                    >
                      Edit
                    </button>

                    <button
                      class="icon-btn del"
                      data-delete="${escapeHtml(
                        post.id
                      )}"
                      type="button"
                    >
                      Delete
                    </button>
                  </div>

                </div>
              `
            )
            .join('')}
        </div>
      `;

      tableWrap
        .querySelectorAll('[data-edit]')
        .forEach(button => {
          button.addEventListener(
            'click',
            () => {
              void loadPostForEditing(
                button.dataset.edit
              );
            }
          );
        });

      tableWrap
        .querySelectorAll('[data-delete]')
        .forEach(button => {
          button.addEventListener(
            'click',
            () => {
              void deletePost(
                button.dataset.delete,
                type
              );
            }
          );
        });
    } catch (error) {
      console.error(
        'Could not load publications:',
        error
      );

      tableWrap.innerHTML = `
        <div class="empty">
          ${escapeHtml(
            error?.message ||
              'Publications could not be loaded.'
          )}
        </div>
      `;
    }
  }

  async function loadPostForEditing(id) {
    try {
      const post =
        await ensureStore().getById(id);

      if (!post) {
        throw new Error(
          'The selected publication could not be found.'
        );
      }

      editingId = id;
      pendingImage = '';

      const type =
        post.type === 'gallery'
          ? 'media'
          : post.type;

      renderForm(type);

      getElement('form-title').textContent =
        `Edit ${TYPE_LABELS[type]}`;

      getElement('submit-btn').textContent =
        'Save changes';

      const cancelButton =
        getElement('cancel-edit');

      cancelButton.style.display =
        'inline-flex';

      cancelButton.addEventListener(
        'click',
        () => {
          switchTab(type);
        }
      );

      getElement('f-title').value =
        post.title || '';

      getElement('f-excerpt').value =
        post.excerpt || '';

      if (getElement('f-content')) {
        getElement('f-content').value =
          post.content || '';
      }

      if (getElement('f-category')) {
        getElement('f-category').value =
          post.category || '';
      }

      if (getElement('f-tags')) {
        getElement('f-tags').value =
          Array.isArray(post.tags)
            ? post.tags.join(', ')
            : '';
      }

      if (getElement('f-youtube')) {
        getElement('f-youtube').value =
          post.youtubeUrl || '';
      }

      if (getElement('f-linkurl')) {
        getElement('f-linkurl').value =
          post.linkUrl || '';
      }

      if (getElement('f-linklabel')) {
        getElement('f-linklabel').value =
          post.linkLabel || '';
      }

      if (type === 'event') {
        getElement('f-eventdate').value =
          post.eventDate
            ? toDateTimeLocal(post.eventDate)
            : '';

        getElement('f-location').value =
          post.location || '';

        getElement('f-registration').value =
          post.registrationUrl || '';
      }

      if (post.image) {
        getElement(
          'f-image-preview'
        ).innerHTML = `
          <img
            src="${escapeHtml(post.image)}"
            alt="Current publication image"
          >
        `;
      }

      getElement('form-wrap')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
    } catch (error) {
      showToast(
        error?.message ||
          'The publication could not be opened.'
      );
    }
  }

  async function deletePost(id, type) {
    const confirmed = window.confirm(
      'Delete this publication? This action cannot be undone.'
    );

    if (!confirmed) {
      return;
    }

    try {
      await ensureStore().remove(id);

      showToast(
        'Publication deleted successfully.'
      );

      if (editingId === id) {
        editingId = null;
        pendingImage = '';
        renderForm(type);
      }

      await renderTable(type);
    } catch (error) {
      showToast(
        error?.message ||
          'The publication could not be deleted.'
      );
    }
  }

  function initialiseApplication() {
    getElement('login-form')
      ?.addEventListener(
        'submit',
        handleLogin
      );

    getElement('logout-btn')
      ?.addEventListener(
        'click',
        handleLogout
      );

    restoreSession();
  }

  document.addEventListener(
    'DOMContentLoaded',
    initialiseApplication
  );
})();
