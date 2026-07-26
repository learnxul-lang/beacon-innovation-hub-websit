/* Beacon Innovation Hub — content administration */

const TYPE_LABELS = { update:'Update', event:'Event', article:'Article / Summit Review', media:'Gallery Photo' };
let currentType = 'update';
let editingId = null;
let pendingImage = '';

function showToast(message){
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function field(id,label,input,help=''){
  return `<div class="field"><label for="${id}">${label}</label>${input}${help ? `<div class="field-help">${help}</div>` : ''}</div>`;
}

function commonFields(type){
  const summaryLabel = type === 'media' ? 'Caption' : 'Short summary';
  const imageLabel = type === 'media' ? 'Photo (required)' : 'Cover photo (optional)';
  let html = '';
  html += field('f-title','Title','<input id="f-title" maxlength="130" required placeholder="Enter a clear public title">');
  html += field('f-excerpt',summaryLabel,'<textarea id="f-excerpt" maxlength="280" required style="min-height:82px" placeholder="A concise preview for cards and search results"></textarea>');

  if (type !== 'media') {
    html += field('f-content','Full post','<textarea id="f-content" required placeholder="Write the full post. Leave a blank line between paragraphs. Full web addresses in the text become clickable links."></textarea>','Plain text is displayed safely. Paste complete https:// links where needed.');
  }

  html += field('f-tags','Hashtags','<input id="f-tags" placeholder="SoftwareEngineering, Innovation, Community">','Separate hashtags with commas. The # symbol is optional.');
  html += field('f-image',imageLabel,'<input id="f-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><div class="img-preview" id="f-image-preview">No image selected</div>','Use a landscape image where possible. Maximum file size: 3.5 MB.');

  if (type !== 'media') {
    html += field('f-youtube','YouTube video URL','<input id="f-youtube" type="url" placeholder="https://www.youtube.com/watch?v=...">','YouTube, YouTube Shorts and youtu.be links are supported.');
  }

  html += `<div class="form-grid">
    ${field('f-link-label','Link label','<input id="f-link-label" placeholder="Read the full report">')}
    ${field('f-link-url','Related link','<input id="f-link-url" type="url" placeholder="https://...">')}
  </div>`;
  return html;
}

function specialFields(type){
  if (type === 'event') {
    return `<div class="form-grid">
      ${field('f-eventdate','Event date and time','<input id="f-eventdate" type="datetime-local" required>')}
      ${field('f-location','Location','<input id="f-location" placeholder="Beacon Innovation Hub Studio">')}
    </div>${field('f-registration','Registration link','<input id="f-registration" type="url" placeholder="https://...">','Leave blank when registration is not required or the link is not yet available.')}`;
  }
  if (type === 'article') {
    return field('f-category','Article category','<select id="f-category"><option>Software Engineering</option><option>Summit Review</option><option>Community Insight</option></select>');
  }
  return '';
}

function renderForm(type){
  const root = document.getElementById('form-wrap');
  root.innerHTML = `<h3 id="form-title">New ${TYPE_LABELS[type]}</h3>
    <p class="hint">Publish only verified Beacon Innovation Hub information.</p>
    <form id="post-form">
      ${specialFields(type)}
      ${commonFields(type)}
      <div class="form-actions">
        <button class="btn btn-primary btn-block" id="submit-btn" type="submit">Publish</button>
        <button class="btn btn-secondary" id="cancel-edit" type="button" hidden>Cancel</button>
      </div>
    </form>`;

  const imageInput = document.getElementById('f-image');
  imageInput.addEventListener('change', () => {
    const file = imageInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please choose an image file.'); imageInput.value=''; return; }
    if (file.size > 3.5 * 1024 * 1024) { showToast('The image is too large. Use an image under 3.5 MB.'); imageInput.value=''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      pendingImage = reader.result;
      document.getElementById('f-image-preview').innerHTML = `<img src="${pendingImage}" alt="Selected image preview">`;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('post-form').addEventListener('submit', event => {
    event.preventDefault();
    savePost(type);
  });
  document.getElementById('cancel-edit').addEventListener('click', () => switchTab(type));
}

function inputValue(id){ return document.getElementById(id)?.value.trim() || ''; }

function parseTags(value){
  return [...new Set(value.split(',').map(tag => tag.trim().replace(/^#+/,'')).filter(Boolean))];
}

function validateOptionalUrl(value,label){
  if (!value) return '';
  const valid = safeUrl(value);
  if (!valid) throw new Error(`${label} must begin with http:// or https://.`);
  return valid;
}

async function savePost(type){
  try {
    const title = inputValue('f-title');
    const excerpt = inputValue('f-excerpt');
    if (!title || !excerpt) throw new Error('Complete the title and summary fields.');

    const original = editingId ? await STORE.getById(editingId) : null;
    const post = original ? { ...original } : { type, date:new Date().toISOString() };
    post.type = type;
    post.title = title;
    post.excerpt = excerpt;
    post.content = type === 'media' ? excerpt : inputValue('f-content');
    post.tags = parseTags(inputValue('f-tags'));
    post.image = pendingImage || post.image || '';
    post.youtubeUrl = type === 'media' ? '' : validateOptionalUrl(inputValue('f-youtube'),'YouTube URL');
    post.linkLabel = inputValue('f-link-label');
    post.linkUrl = validateOptionalUrl(inputValue('f-link-url'),'Related link');

    if (type === 'media' && !post.image) throw new Error('A gallery photo is required.');
    if (type !== 'media' && !post.content) throw new Error('Write the full post before publishing.');

    if (type === 'event') {
      const eventValue = inputValue('f-eventdate');
      if (!eventValue) throw new Error('Select the event date and time.');
      post.eventDate = new Date(eventValue).toISOString();
      post.location = inputValue('f-location');
      post.registrationUrl = validateOptionalUrl(inputValue('f-registration'),'Registration link');
    }
    if (type === 'article') post.category = inputValue('f-category') || 'Software Engineering';

    await STORE.upsert(post);
    showToast(editingId ? 'Changes saved.' : `${TYPE_LABELS[type]} published.`);
    editingId = null;
    pendingImage = '';
    renderForm(type);
    renderList(type);
  } catch (error) {
    showToast(error.message || 'The post could not be saved.');
  }
}

async function renderList(type){
  const root = document.getElementById('table-wrap');
  const posts = await STORE.byType(type);
  if (!posts.length) {
    root.innerHTML = `<div class="empty">No ${TYPE_LABELS[type].toLowerCase()} items have been published.</div>`;
    return;
  }
  root.innerHTML = `<div class="admin-list">${posts.map(post => `<article class="admin-row">
    ${post.image ? `<img class="thumb" src="${escapeHTML(post.image)}" alt="">` : '<div class="thumb"></div>'}
    <div><h4>${escapeHTML(post.title)}</h4><p>${fmtDate(post.date)}${post.eventDate ? ` · ${fmtDateTime(post.eventDate)}` : ''}${post.category ? ` · ${escapeHTML(post.category)}` : ''}</p></div>
    <div class="row-actions">
      <button class="icon-btn" type="button" data-edit="${escapeHTML(post.id)}" aria-label="Edit">✎</button>
      <button class="icon-btn danger" type="button" data-delete="${escapeHTML(post.id)}" aria-label="Delete">⌫</button>
    </div>
  </article>`).join('')}</div>`;

  root.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => loadForEdit(button.dataset.edit)));
  root.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', async () => {
    if (window.confirm('Delete this item? This action cannot be undone.')) {
      await STORE.remove(button.dataset.delete);
      showToast('Item deleted.');
      renderList(type);
    }
  }));
}

function localDateTimeValue(iso){
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0,16);
}

function setValue(id,value){ const node = document.getElementById(id); if (node) node.value = value || ''; }

async function loadForEdit(id){
  const post = await STORE.getById(id);
  if (!post) return;
  editingId = id;
  pendingImage = '';
  renderForm(post.type);
  document.getElementById('form-title').textContent = `Edit ${TYPE_LABELS[post.type]}`;
  document.getElementById('submit-btn').textContent = 'Save changes';
  document.getElementById('cancel-edit').hidden = false;
  setValue('f-title',post.title);
  setValue('f-excerpt',post.excerpt);
  setValue('f-content',post.content);
  setValue('f-tags',(post.tags || []).join(', '));
  setValue('f-youtube',post.youtubeUrl);
  setValue('f-link-label',post.linkLabel);
  setValue('f-link-url',post.linkUrl);
  setValue('f-category',post.category);
  setValue('f-eventdate',post.eventDate ? localDateTimeValue(post.eventDate) : '');
  setValue('f-location',post.location);
  setValue('f-registration',post.registrationUrl);
  if (post.image) document.getElementById('f-image-preview').innerHTML = `<img src="${escapeHTML(post.image)}" alt="Current image">`;
  document.getElementById('form-wrap').scrollIntoView({behavior:'smooth',block:'start'});
}

async function switchTab(type){
  currentType = type;
  editingId = null;
  pendingImage = '';
  document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.toggle('active',tab.dataset.type === type));
  const settings = document.getElementById('settings-panel');
  const content = document.getElementById('content-panel');
  settings.hidden = type !== 'settings';
  content.hidden = type === 'settings';
  if (type !== 'settings') { renderForm(type); await renderList(type); }
}

async function initDashboard(){
  const dashboard = document.getElementById('dashboard');
  if (dashboard.dataset.ready === 'true') { await switchTab(currentType); return; }
  dashboard.dataset.ready = 'true';
  document.querySelectorAll('.admin-tab').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.type)));
  document.getElementById('logout-btn').addEventListener('click', async () => { await STORE.logout(); await renderGate(); });
  document.getElementById('pass-form').addEventListener('submit', async event => {
    event.preventDefault();
    const next = inputValue('pass-new');
    const message = document.getElementById('pass-msg');
    if (next.length < 8) { message.textContent = 'Use at least 8 characters for the new password.'; return; }
    try { await STORE.changePassword(next); } catch (error) { message.textContent = error.message || 'Password update failed.'; return; }
    message.style.color = 'var(--success)';
    message.textContent = 'Password updated successfully.';
    event.target.reset();
  });
  await switchTab('update');
}

async function renderGate(){
  const login = document.getElementById('login-box');
  const dashboard = document.getElementById('dashboard');
  const authed = await STORE.isAuthed();
  login.hidden = authed;
  dashboard.hidden = !authed;
  if (authed) await initDashboard();
}

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const error = document.getElementById('login-error');
    try { await STORE.login(inputValue('login-email'), inputValue('login-pass'));
      {
      error.textContent = '';
      event.target.reset();
      await renderGate();
      }
    } catch (loginError) {
      error.textContent = loginError.message || 'Sign-in failed. Check your email and password.';
    }
  });
  await renderGate();
});
