/* ==========================================================================
   Beacon Innovation Hub — Supabase-secured Admin Dashboard
   ========================================================================== */

const supabaseClient = window.supabaseClient;

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

/* ==========================================================================
   General utilities
   ========================================================================== */

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
    initDashboard();
    dashboardInitialised = true;
  }
}

function setLoginLoading(isLoading) {
  const submitButton = document.querySelector(
    '#login-form button[type="submit"]'
  );

  if (!submitButton) {
    return;
  }

  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading
    ? 'Signing in...'
    : 'Sign in';
}

/* ==========================================================================
   Supabase administrator authentication
   ========================================================================== */

async function verifyAdminAccess() {
  const loginError = document.getElementById('login-error');

  try {
    const {
      data: { session },
      error: sessionError
    } = await supabaseClient.auth.getSession();

    if (sessionError) {
      console.error('Session error:', sessionError);

      if (loginError) {
        loginError.textContent =
          `Session error: ${sessionError.message}`;
      }

      showLogin();
      return false;
    }

    if (!session?.user) {
      showLogin();
      return false;
    }

    const {
      data: isAdmin,
      error: adminError
    } = await supabaseClient.rpc('is_admin');

    if (adminError) {
      console.error(
        'Administrator verification failed:',
        adminError
      );

      if (loginError) {
        loginError.textContent =
          `Administrator verification failed: ${adminError.message}`;
      }

      showLogin();
      return false;
    }

    if (isAdmin !== true) {
      if (loginError) {
        loginError.textContent =
          'This account is signed in but is not registered as an administrator.';
      }

      await supabaseClient.auth.signOut();
      showLogin();

      return false;
    }

    if (loginError) {
      loginError.textContent = '';
    }

    showDashboard();
    return true;
  } catch (error) {
    console.error(
      'Unexpected administrator verification error:',
      error
    );

    if (loginError) {
      loginError.textContent =
        'Administrator access could not be verified.';
    }

    showLogin();
    return false;
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const loginError = document.getElementById('login-error');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-pass');

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  loginError.textContent = '';

  if (!email || !password) {
    loginError.textContent =
      'Enter your administrator email and password.';
    return;
  }

  setLoginLoading(true);

  try {
    const {
      data,
      error
    } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Supabase login error:', error);

      if (
        error.code === 'invalid_credentials' ||
        error.message === 'Invalid login credentials'
      ) {
        loginError.textContent =
          'Incorrect administrator email or password.';
      } else if (
        error.code === 'email_not_confirmed'
      ) {
        loginError.textContent =
          'This email address has not been confirmed in Supabase.';
      } else {
        loginError.textContent = error.message;
      }

      return;
    }

    if (!data?.session || !data?.user) {
      loginError.textContent =
        'Login succeeded, but Supabase did not create a session.';
      return;
    }

    const hasAccess = await verifyAdminAccess();

    if (hasAccess) {
      passwordInput.value = '';
      showToast('Administrator login successful');
    }
  } catch (error) {
    console.error('Unexpected login error:', error);

    loginError.textContent =
      'Unable to sign in. Check the browser console for details.';
  } finally {
    setLoginLoading(false);
  }
}

async function handleLogout() {
  const logoutButton = document.getElementById('logout-btn');

  if (logoutButton) {
    logoutButton.disabled = true;
    logoutButton.textContent = 'Signing out...';
  }

  try {
    const { error } =
      await supabaseClient.auth.signOut();

    if (error) {
      console.error('Logout error:', error);
      showToast(`Sign-out failed: ${error.message}`);
      return;
    }

    dashboardInitialised = false;
    showLogin();
    showToast('Signed out successfully');
  } catch (error) {
    console.error('Unexpected logout error:', error);
    showToast('Unable to sign out');
  } finally {
    if (logoutButton) {
      logoutButton.disabled = false;
      logoutButton.textContent = 'Sign out';
    }
  }
}

/* ==========================================================================
   Application boot
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const loginError = document.getElementById('login-error');
  const loginForm = document.getElementById('login-form');
  const logoutButton = document.getElementById('logout-btn');

  if (!supabaseClient) {
    console.error(
      'window.supabaseClient is undefined. Check supabase-config.js.'
    );

    if (loginError) {
      loginError.textContent =
        'The website could not connect to Supabase.';
    }

    showLogin();
    return;
  }

  console.log('Supabase client loaded successfully.');

  if (typeof initThemeControls === 'function') {
    initThemeControls();
  }

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

  showLogin();

  /*
   * Check whether a valid administrator session already
   * exists in the browser.
   */
  await verifyAdminAccess();

  /*
   * Do not make awaited Supabase requests directly inside
   * this callback.
   */
  supabaseClient.auth.onAuthStateChange(
    (event, session) => {
      console.log('Supabase authentication event:', event);

      if (event === 'SIGNED_OUT' || !session) {
        dashboardInitialised = false;
        showLogin();
      }
    }
  );
});

/* ==========================================================================
   Dashboard initialisation
   ========================================================================== */

function initDashboard() {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    if (tab.dataset.initialised === 'true') {
      return;
    }

    tab.addEventListener('click', () => {
      switchTab(tab.dataset.type);
    });

    tab.dataset.initialised = 'true';
  });

  const passwordForm =
    document.getElementById('pass-form');

  if (
    passwordForm &&
    passwordForm.dataset.initialised !== 'true'
  ) {
    passwordForm.addEventListener(
      'submit',
      handlePasswordChange
    );

    passwordForm.dataset.initialised = 'true';
  }

  switchTab('update');
}

/* ==========================================================================
   Dashboard tabs
   ========================================================================== */

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

  const settingsPanel =
    document.getElementById('settings-panel');

  const contentPanel =
    document.getElementById('content-panel');

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

/* ==========================================================================
   Form fields
   ========================================================================== */

function fieldsFor(type) {
  const isMedia = type === 'media';

  const common = `
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

  const content = `
    <div class="field">
      <label for="f-content">Full content</label>

      <textarea
        id="f-content"
        required
        placeholder="Write the full post. Use blank lines for paragraphs."
      ></textarea>
    </div>
  `;

  const tags = `
    <div class="field">
      <label for="f-tags">
        Tags (comma separated)
      </label>

      <input
        id="f-tags"
        placeholder="e.g. architecture, workshop"
      >
    </div>
  `;

  const image = `
    <div class="field">
      <label for="f-image">
        Image ${isMedia ? '(required)' : '(optional)'}
      </label>

      <input
        type="file"
        id="f-image"
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
      <label for="f-location">Location</label>

      <input
        id="f-location"
        placeholder="e.g. Beacon Hub — Main Floor"
      >
    </div>
  `;

  if (type === 'media') {
    return common + image + tags;
  }

  if (type === 'event') {
    return (
      common +
      eventFields +
      content +
      tags +
      image
    );
  }

  return common + content + tags + image;
}

/* ==========================================================================
   Form rendering
   ========================================================================== */

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
      Fields marked required must be completed before publishing.
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

  const imageInput =
    document.getElementById('f-image');

  if (imageInput) {
    imageInput.addEventListener('change', () => {
      const file = imageInput.files[0];

      if (!file) {
        return;
      }

      if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file');
        imageInput.value = '';
        return;
      }

      if (file.size > 3.5 * 1024 * 1024) {
        showToast(
          'Image too large. Use an image under 3.5 MB.'
        );

        imageInput.value = '';
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        pendingImage = reader.result;

        const preview =
          document.getElementById('f-image-preview');

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
        showToast('The image could not be read');
      };

      reader.readAsDataURL(file);
    });
  }

  const postForm =
    document.getElementById('post-form');

  if (postForm) {
    postForm.addEventListener('submit', event => {
      event.preventDefault();
      savePost(type);
    });
  }
}

/* ==========================================================================
   Save posts
   ========================================================================== */

function savePost(type) {
  const titleInput =
    document.getElementById('f-title');

  const excerptInput =
    document.getElementById('f-excerpt');

  const title = titleInput.value.trim();
  const excerpt = excerptInput.value.trim();

  if (!title || !excerpt) {
    showToast('Complete all required fields');
    return;
  }

  const storageType = getStorageType(type);

  const post = editingId
    ? STORE.getById(editingId)
    : { type: storageType };

  if (!post) {
    showToast('The selected post could not be found');
    return;
  }

  post.type = storageType;
  post.title = title;
  post.excerpt = excerpt;

  const contentInput =
    document.getElementById('f-content');

  if (contentInput) {
    post.content = contentInput.value.trim();
  } else if (type === 'media') {
    post.content = excerpt;
  }

  const tagsInput =
    document.getElementById('f-tags');

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

    post.eventDate = eventDateInput.value
      ? new Date(eventDateInput.value).toISOString()
      : '';

    post.location = locationInput.value.trim();
  }

  if (pendingImage) {
    post.image = pendingImage;
  } else if (
    type === 'media' &&
    !post.image
  ) {
    showToast(
      'Please add an image for the gallery post'
    );

    return;
  }

  post.image = post.image || '';

  if (!editingId) {
    post.date = new Date().toISOString();
  }

  STORE.upsert(post);

  showToast(
    editingId
      ? 'Changes saved'
      : `${TYPE_LABEL[type]} published`
  );

  editingId = null;
  pendingImage = '';

  renderForm(type);
  renderTable(type);
}

/* ==========================================================================
   Render posts
   ========================================================================== */

function renderTable(type) {
  const storageType = getStorageType(type);
  const posts = STORE.byType(storageType);
  const list = document.getElementById('table-wrap');

  if (!list) {
    return;
  }

  if (!posts.length) {
    list.innerHTML = `
      <div class="empty">
        No ${TYPE_LABEL[type].toLowerCase()} posts yet.
        Use the form to publish the first one.
      </div>
    `;

    return;
  }

  list.innerHTML = `
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
            <h4>${escapeHTML(post.title)}</h4>

            <p>
              ${fmtDate(post.date)}

              ${
                post.eventDate
                  ? ` · event: ${fmtDate(post.eventDate)}`
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
              data-del="${post.id}"
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

  list
    .querySelectorAll('[data-edit]')
    .forEach(button => {
      button.addEventListener('click', () => {
        loadForEdit(button.dataset.edit);
      });
    });

  list
    .querySelectorAll('[data-del]')
    .forEach(button => {
      button.addEventListener('click', () => {
        const confirmed = window.confirm(
          'Delete this post? This cannot be undone.'
        );

        if (!confirmed) {
          return;
        }

        STORE.remove(button.dataset.del);
        showToast('Post deleted');
        renderTable(type);
      });
    });
}

/* ==========================================================================
   Edit posts
   ========================================================================== */

function loadForEdit(id) {
  const post = STORE.getById(id);

  if (!post) {
    showToast('The selected post could not be found');
    return;
  }

  editingId = id;
  pendingImage = '';

  const interfaceType =
    getInterfaceType(post.type);

  currentTab = interfaceType;

  renderForm(interfaceType);

  const formTitle =
    document.getElementById('form-title');

  const submitButton =
    document.getElementById('submit-btn');

  const cancelButton =
    document.getElementById('cancel-edit');

  if (formTitle) {
    formTitle.textContent =
      `Edit ${TYPE_LABEL[interfaceType]}`;
  }

  if (submitButton) {
    submitButton.textContent = 'Save changes';
  }

  if (cancelButton) {
    cancelButton.style.display = 'inline-flex';
  }

  document.getElementById('f-title').value =
    post.title || '';

  document.getElementById('f-excerpt').value =
    post.excerpt || '';

  const contentInput =
    document.getElementById('f-content');

  if (contentInput) {
    contentInput.value = post.content || '';
  }

  const tagsInput =
    document.getElementById('f-tags');

  if (tagsInput) {
    tagsInput.value =
      (post.tags || []).join(', ');
  }

  if (interfaceType === 'event') {
    const eventDateInput =
      document.getElementById('f-eventdate');

    const locationInput =
      document.getElementById('f-location');

    eventDateInput.value = post.eventDate
      ? toLocalInput(post.eventDate)
      : '';

    locationInput.value = post.location || '';
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

  if (cancelButton) {
    cancelButton.addEventListener('click', () => {
      switchTab(interfaceType);
    });
  }

  const formWrap =
    document.getElementById('form-wrap');

  if (formWrap) {
    formWrap.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
}

function toLocalInput(isoDate) {
  const date = new Date(isoDate);

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

/* ==========================================================================
   Change administrator password
   ========================================================================== */

async function handlePasswordChange(event) {
  event.preventDefault();

  const passwordInput =
    document.getElementById('pass-new');

  const message =
    document.getElementById('pass-msg');

  const newPassword = passwordInput.value;

  message.textContent = '';

  if (newPassword.length < 8) {
    message.textContent =
      'The new password must contain at least 8 characters.';

    message.style.color = 'var(--danger)';
    return;
  }

  try {
    const { error } =
      await supabaseClient.auth.updateUser({
        password: newPassword
      });

    if (error) {
      console.error(
        'Password update error:',
        error
      );

      message.textContent = error.message;
      message.style.color = 'var(--danger)';
      return;
    }

    message.textContent =
      'Administrator password updated successfully.';

    message.style.color = 'var(--success)';

    event.target.reset();
    showToast('Password updated');
  } catch (error) {
    console.error(
      'Unexpected password update error:',
      error
    );

    message.textContent =
      'The password could not be updated.';

    message.style.color = 'var(--danger)';
  }
}

/* ==========================================================================
   Icons
   ========================================================================== */

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

      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"
      ></path>
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
