/* ==========================================================================
   Beacon Innovation Hub — Supabase Administrator Dashboard
   ========================================================================== */

(() => {
  'use strict';

  /* ==========================================================================
     Configuration
     ========================================================================== */

  const ADMIN_EMAIL = 'philanimaraps@gmail.com';

  const TYPE_LABELS = {
    update: 'Update',
    event: 'Event',
    article: 'Article',
    media: 'Gallery photograph'
  };

  let currentTab = 'update';
  let editingId = null;
  let pendingImage = '';
  let dashboardInitialised = false;

  /* ==========================================================================
     DOM helpers
     ========================================================================== */

  function getElement(id) {
    return document.getElementById(id);
  }

  function setMessage(element, message, type = 'error') {
    if (!element) {
      return;
    }

    element.textContent = message;
    element.dataset.type = type;

    if (type === 'success') {
      element.style.color = '#1b7f46';
    } else {
      element.style.color = '#b42318';
    }
  }

  function clearMessage(element) {
    if (!element) {
      return;
    }

    element.textContent = '';
    element.removeAttribute('data-type');
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
    }, 2600);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  /* ==========================================================================
     Supabase helpers
     ========================================================================== */

  function getSupabaseClient() {
    return window.supabaseClient;
  }

  function ensureSupabaseClient() {
    const client = getSupabaseClient();

    if (!client) {
      throw new Error(
        'Supabase is not configured. Check supabase-config.js and the script order in admin.html.'
      );
    }

    return client;
  }

  async function getCurrentSession() {
    const client = ensureSupabaseClient();

    const {
      data,
      error
    } = await client.auth.getSession();

    if (error) {
      throw error;
    }

    return data.session;
  }

  async function verifyAdministrator(user) {
    if (!user) {
      return false;
    }

    const userEmail = String(user.email || '')
      .trim()
      .toLowerCase();

    if (userEmail !== ADMIN_EMAIL.toLowerCase()) {
      return false;
    }

    const client = ensureSupabaseClient();

    /*
     * Preferred check:
     * Calls the public.is_admin() database function.
     */
    const {
      data: rpcResult,
      error: rpcError
    } = await client.rpc('is_admin');

    if (!rpcError) {
      return rpcResult === true;
    }

    console.warn(
      'The is_admin() RPC check failed. Trying admin_users table.',
      rpcError
    );

    /*
     * Fallback check:
     * Looks for the authenticated email in admin_users.
     */
    const {
      data: adminRecord,
      error: tableError
    } = await client
      .from('admin_users')
      .select('email, role')
      .eq('email', userEmail)
      .eq('role', 'admin')
      .maybeSingle();

    if (tableError) {
      console.error(
        'The admin_users fallback check failed:',
        tableError
      );

      throw new Error(
        'Your account was authenticated, but administrator permission could not be verified.'
      );
    }

    return Boolean(adminRecord);
  }

  async function requireAdministrator() {
    const session = await getCurrentSession();

    if (!session?.user) {
      return null;
    }

    const authorised = await verifyAdministrator(
      session.user
    );

    if (!authorised) {
      return null;
    }

    return session.user;
  }

  /* ==========================================================================
     Login and dashboard visibility
     ========================================================================== */

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

  function showDashboard(user) {
    const loginBox = getElement('login-box');
    const dashboard = getElement('dashboard');
    const sessionPill = document.querySelector(
      '.session-pill'
    );

    if (loginBox) {
      loginBox.hidden = true;
      loginBox.style.display = 'none';
    }

    if (dashboard) {
      dashboard.hidden = false;
      dashboard.style.display = 'block';
    }

    if (sessionPill) {
      sessionPill.textContent =
        user?.email || 'Administrator signed in';
    }

    if (!dashboardInitialised) {
      initialiseDashboard();
      dashboardInitialised = true;
    }
  }

  function setLoginButtonLoading(loading) {
    const loginForm = getElement('login-form');

    if (!loginForm) {
      return;
    }

    const button = loginForm.querySelector(
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

  async function handleLogin(event) {
    event.preventDefault();

    const client = getSupabaseClient();
    const emailInput = getElement('login-email');
    const passwordInput = getElement('login-pass');
    const loginError = getElement('login-error');

    clearMessage(loginError);

    if (!client) {
      setMessage(
        loginError,
        'Supabase failed to load. Check supabase-config.js.'
      );

      return;
    }

    if (!emailInput || !passwordInput) {
      setMessage(
        loginError,
        'The login form is missing the email or password field.'
      );

      return;
    }

    const email = emailInput.value
      .trim()
      .toLowerCase();

    const password = passwordInput.value;

    if (email !== ADMIN_EMAIL.toLowerCase()) {
      setMessage(
        loginError,
        'This email address is not registered as the website administrator.'
      );

      return;
    }

    if (!password) {
      setMessage(
        loginError,
        'Enter your administrator password.'
      );

      return;
    }

    setLoginButtonLoading(true);

    try {
      const {
        data,
        error
      } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error(
          'Supabase did not return an authenticated user.'
        );
      }

      const authorised = await verifyAdministrator(
        data.user
      );

      if (!authorised) {
        await client.auth.signOut();

        throw new Error(
          'Login succeeded, but this account does not have administrator permission.'
        );
      }

      passwordInput.value = '';

      showDashboard(data.user);
      showToast('Administrator login successful.');
    } catch (error) {
      console.error('Administrator login failed:', error);

      let message =
        error?.message ||
        'The administrator login failed.';

      if (
        message.toLowerCase().includes(
          'invalid login credentials'
        )
      ) {
        message =
          'Incorrect administrator email or password.';
      }

      if (
        message.toLowerCase().includes(
          'email not confirmed'
        )
      ) {
        message =
          'Your Supabase email address has not been confirmed.';
      }

      setMessage(loginError, message);
    } finally {
      setLoginButtonLoading(false);
    }
  }

  async function handleLogout() {
    const client = getSupabaseClient();

    try {
      if (client) {
        const { error } = await client.auth.signOut();

        if (error) {
          throw error;
        }
      }
    } catch (error) {
      console.error('Sign-out error:', error);
    } finally {
      dashboardInitialised = false;
      showLogin();
      showToast('Signed out successfully.');
    }
  }

  /* ==========================================================================
     Password change
     ========================================================================== */

  async function handlePasswordChange(event) {
    event.preventDefault();

    const client = getSupabaseClient();
    const passwordInput = getElement('pass-new');
    const messageBox = getElement('pass-msg');
    const submitButton = event.currentTarget.querySelector(
      'button[type="submit"]'
    );

    clearMessage(messageBox);

    if (!client) {
      setMessage(
        messageBox,
        'Supabase is not configured.'
      );

      return;
    }

    if (!passwordInput) {
      return;
    }

    const newPassword = passwordInput.value;

    if (newPassword.length < 8) {
      setMessage(
        messageBox,
        'Your password must contain at least eight characters.'
      );

      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Updating…';
    }

    try {
      const {
        data,
        error
      } = await client.auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error(
          'Supabase did not confirm the password update.'
        );
      }

      passwordInput.value = '';

      setMessage(
        messageBox,
        'Administrator password updated successfully.',
        'success'
      );

      showToast('Password updated successfully.');
    } catch (error) {
      console.error('Password update failed:', error);

      setMessage(
        messageBox,
        error?.message ||
          'The password could not be updated.'
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Update password';
      }
    }
  }

  /* ==========================================================================
     Dashboard setup
     ========================================================================== */

  function initialiseDashboard() {
    document.querySelectorAll('.admin-tab')
      .forEach(tab => {
        if (tab.dataset.listenerAttached === 'true') {
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
    currentTab = type;
    editingId = null;
    pendingImage = '';

    document.querySelectorAll('.admin-tab')
      .forEach(tab => {
        tab.classList.toggle(
          'active',
          tab.dataset.type === type
        );
      });

    const settingsPanel =
      getElement('settings-panel');

    const contentPanel =
      getElement('content-panel');

    const showingSettings = type === 'settings';

    if (settingsPanel) {
      settingsPanel.hidden = !showingSettings;
      settingsPanel.style.display =
        showingSettings ? 'block' : 'none';
    }

    if (contentPanel) {
      contentPanel.hidden = showingSettings;
      contentPanel.style.display =
        showingSettings ? 'none' : 'grid';
    }

    if (!showingSettings) {
      renderForm(type);
      renderTable(type);
    }
  }

  /* ==========================================================================
     Content form
     ========================================================================== */

  function getStoredType(type) {
    return type === 'media'
      ? 'photo'
      : type;
  }

  function getInterfaceType(type) {
    return type === 'photo'
      ? 'media'
      : type;
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
              ? 'Write a caption for the photograph'
              : 'Write a short preview summary'
          }"
        ></textarea>
      </div>
    `;

    const contentField = `
      <div class="field">
        <label for="f-content">
          Full content
        </label>

        <textarea
          id="f-content"
          required
          placeholder="Write the complete publication"
        ></textarea>
      </div>
    `;

    const tagsField = `
      <div class="field">
        <label for="f-tags">
          Tags
        </label>

        <input
          id="f-tags"
          type="text"
          placeholder="innovation, software, community"
        >

        <p class="hint">
          Separate multiple tags with commas.
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
          Location
        </label>

        <input
          id="f-location"
          type="text"
          placeholder="Enter the event location"
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

    return (
      commonFields +
      contentField +
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
        Complete the required fields before publishing.
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

    const imageInput = getElement('f-image');

    if (imageInput) {
      imageInput.addEventListener(
        'change',
        handleImageSelection
      );
    }

    const postForm = getElement('post-form');

    if (postForm) {
      postForm.addEventListener(
        'submit',
        event => {
          event.preventDefault();
          savePost(type);
        }
      );
    }
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
        'The image is too large. Select an image below 3.5 MB.'
      );

      event.target.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      pendingImage = String(reader.result || '');

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

  /* ==========================================================================
     Save content
     ========================================================================== */

  function ensureStore() {
    if (
      typeof window.STORE === 'undefined' ||
      !window.STORE
    ) {
      throw new Error(
        'store.js could not be loaded.'
      );
    }

    return window.STORE;
  }

  function savePost(type) {
    let store;

    try {
      store = ensureStore();
    } catch (error) {
      showToast(error.message);
      return;
    }

    const titleInput = getElement('f-title');
    const excerptInput = getElement('f-excerpt');

    const title =
      titleInput?.value.trim() || '';

    const excerpt =
      excerptInput?.value.trim() || '';

    if (!title || !excerpt) {
      showToast(
        'Complete the title and summary fields.'
      );

      return;
    }

    const storedType = getStoredType(type);

    const existingPost = editingId
      ? store.getById(editingId)
      : null;

    if (editingId && !existingPost) {
      showToast(
        'The selected publication could not be found.'
      );

      return;
    }

    const post = existingPost || {
      type: storedType
    };

    post.type = storedType;
    post.title = title;
    post.excerpt = excerpt;

    const contentInput =
      getElement('f-content');

    if (contentInput) {
      post.content =
        contentInput.value.trim();

      if (!post.content) {
        showToast(
          'Enter the full publication content.'
        );

        return;
      }
    } else {
      post.content = excerpt;
    }

    const tagsInput =
      getElement('f-tags');

    post.tags = tagsInput
      ? tagsInput.value
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean)
      : [];

    if (type === 'event') {
      const eventDateInput =
        getElement('f-eventdate');

      const locationInput =
        getElement('f-location');

      if (!eventDateInput?.value) {
        showToast(
          'Select the event date and time.'
        );

        return;
      }

      post.eventDate = new Date(
        eventDateInput.value
      ).toISOString();

      post.location =
        locationInput?.value.trim() || '';
    }

    if (pendingImage) {
      post.image = pendingImage;
    }

    if (
      type === 'media' &&
      !post.image
    ) {
      showToast(
        'Select an image for the gallery post.'
      );

      return;
    }

    post.image = post.image || '';

    if (!editingId) {
      post.date = new Date().toISOString();
    }

    store.upsert(post);

    showToast(
      editingId
        ? 'Changes saved successfully.'
        : `${TYPE_LABELS[type]} published successfully.`
    );

    editingId = null;
    pendingImage = '';

    renderForm(type);
    renderTable(type);
  }

  /* ==========================================================================
     Content list
     ========================================================================== */

  function renderTable(type) {
    let store;

    try {
      store = ensureStore();
    } catch (error) {
      showToast(error.message);
      return;
    }

    const tableWrap = getElement('table-wrap');

    if (!tableWrap) {
      return;
    }

    const storedType = getStoredType(type);
    const posts = store.byType(storedType) || [];

    if (posts.length === 0) {
      tableWrap.innerHTML = `
        <div class="empty">
          No ${TYPE_LABELS[type].toLowerCase()}
          publications are available yet.
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
                  post.eventDate
                    ? ` · Event: ${formatDate(post.eventDate)}`
                    : ''
                }
              </p>
            </div>

            <div class="row-actions">
              <button
                class="icon-btn"
                data-edit="${escapeHtml(post.id)}"
                type="button"
                title="Edit publication"
                aria-label="Edit publication"
              >
                ${editIcon()}
              </button>

              <button
                class="icon-btn del"
                data-delete="${escapeHtml(post.id)}"
                type="button"
                title="Delete publication"
                aria-label="Delete publication"
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
          loadPostForEditing(
            button.dataset.edit
          );
        });
      });

    tableWrap
      .querySelectorAll('[data-delete]')
      .forEach(button => {
        button.addEventListener('click', () => {
          deletePost(
            button.dataset.delete,
            type
          );
        });
      });
  }

  function deletePost(id, type) {
    const confirmed = window.confirm(
      'Delete this publication? This action cannot be undone.'
    );

    if (!confirmed) {
      return;
    }

    try {
      const store = ensureStore();

      store.remove(id);

      showToast(
        'Publication deleted successfully.'
      );

      renderTable(type);
    } catch (error) {
      showToast(error.message);
    }
  }

  /* ==========================================================================
     Edit content
     ========================================================================== */

  function loadPostForEditing(id) {
    let store;

    try {
      store = ensureStore();
    } catch (error) {
      showToast(error.message);
      return;
    }

    const post = store.getById(id);

    if (!post) {
      showToast(
        'The selected publication could not be found.'
      );

      return;
    }

    editingId = id;
    pendingImage = '';

    const type = getInterfaceType(post.type);

    currentTab = type;

    document.querySelectorAll('.admin-tab')
      .forEach(tab => {
        tab.classList.toggle(
          'active',
          tab.dataset.type === type
        );
      });

    renderForm(type);

    const formTitle =
      getElement('form-title');

    const submitButton =
      getElement('submit-btn');

    const cancelButton =
      getElement('cancel-edit');

    if (formTitle) {
      formTitle.textContent =
        `Edit ${TYPE_LABELS[type]}`;
    }

    if (submitButton) {
      submitButton.textContent =
        'Save changes';
    }

    if (cancelButton) {
      cancelButton.style.display =
        'inline-flex';

      cancelButton.addEventListener(
        'click',
        () => {
          switchTab(type);
        }
      );
    }

    const titleInput =
      getElement('f-title');

    const excerptInput =
      getElement('f-excerpt');

    const contentInput =
      getElement('f-content');

    const tagsInput =
      getElement('f-tags');

    if (titleInput) {
      titleInput.value =
        post.title || '';
    }

    if (excerptInput) {
      excerptInput.value =
        post.excerpt || '';
    }

    if (contentInput) {
      contentInput.value =
        post.content || '';
    }

    if (tagsInput) {
      tagsInput.value =
        Array.isArray(post.tags)
          ? post.tags.join(', ')
          : '';
    }

    if (type === 'event') {
      const eventDateInput =
        getElement('f-eventdate');

      const locationInput =
        getElement('f-location');

      if (eventDateInput) {
        eventDateInput.value =
          post.eventDate
            ? toDateTimeLocal(post.eventDate)
            : '';
      }

      if (locationInput) {
        locationInput.value =
          post.location || '';
      }
    }

    if (post.image) {
      const preview =
        getElement('f-image-preview');

      if (preview) {
        preview.innerHTML = `
          <img
            src="${post.image}"
            alt="Current publication image"
          >
        `;
      }
    }

    getElement('form-wrap')
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
  }

  /* ==========================================================================
     Formatting
     ========================================================================== */

  function formatDate(value) {
    if (!value) {
      return '';
    }

    if (typeof window.fmtDate === 'function') {
      return window.fmtDate(value);
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleDateString(
      'en-ZA',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }
    );
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

  function editIcon() {
    return `
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="M12 20h9"></path>
        <path
          d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"
        ></path>
      </svg>
    `;
  }

  function trashIcon() {
    return `
      <svg
        width="16"
        height="16"
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

  /* ==========================================================================
     Startup
     ========================================================================== */

  async function initialiseApplication() {
    const loginForm =
      getElement('login-form');

    const logoutButton =
      getElement('logout-btn');

    const passwordForm =
      getElement('pass-form');

    if (loginForm) {
      loginForm.addEventListener(
        'submit',
        handleLogin
      );
    }

    if (logoutButton) {
      logoutButton.addEventListener(
        'click',
        handleLogout
      );
    }

    if (passwordForm) {
      passwordForm.addEventListener(
        'submit',
        handlePasswordChange
      );
    }

    if (!getSupabaseClient()) {
      showLogin();

      setMessage(
        getElement('login-error'),
        'Supabase failed to load. Check supabase-config.js and the script paths.'
      );

      return;
    }

    try {
      const user =
        await requireAdministrator();

      if (user) {
        showDashboard(user);
      } else {
        showLogin();
      }
    } catch (error) {
      console.error(
        'Administrator session check failed:',
        error
      );

      showLogin();

      setMessage(
        getElement('login-error'),
        error?.message ||
          'The administrator session could not be verified.'
      );
    }

    /*
     * Keep this callback synchronous.
     * Do not await Supabase calls inside onAuthStateChange.
     */
    getSupabaseClient().auth.onAuthStateChange(
      event => {
        if (
          event === 'SIGNED_OUT'
        ) {
          showLogin();
        }
      }
    );
  }

  document.addEventListener(
    'DOMContentLoaded',
    initialiseApplication
  );
})();
