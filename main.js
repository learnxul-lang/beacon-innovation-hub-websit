/* Beacon Innovation Hub — public website behaviour */

function escapeHTML(value=''){
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function safeUrl(value=''){
  try {
    const url = new URL(value, window.location.href);
    return ['http:','https:'].includes(url.protocol) ? url.href : '';
  } catch (_) { return ''; }
}


function safeMediaSrc(value=''){
  const source = String(value || '').trim();
  if (!source) return '';
  if (source.startsWith('data:image/')) return source;
  if (/^(assets\/|\.\/|\.\.\/)/.test(source)) return source;
  return safeUrl(source);
}

function fmtDate(value, options={ day:'numeric', month:'short', year:'numeric' }){
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-ZA', options);
}

function fmtDateTime(value){
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-ZA', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function readingTime(text=''){
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 210));
}

function normalizeTags(tags=[]){
  return (Array.isArray(tags) ? tags : []).map(tag => String(tag).trim().replace(/^#+/,'')).filter(Boolean);
}

function tagHTML(tags=[]){
  const clean = normalizeTags(tags);
  return clean.length ? `<div class="tag-row">${clean.map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join('')}</div>` : '';
}

function autoLink(text=''){
  const escaped = escapeHTML(text);
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, raw => {
    const trailing = raw.match(/[),.!?;:]+$/)?.[0] || '';
    const hrefText = trailing ? raw.slice(0,-trailing.length) : raw;
    const href = safeUrl(hrefText);
    return href ? `<a href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${hrefText}</a>${trailing}` : raw;
  });
}

function richTextHTML(text=''){
  return String(text).split(/\n\s*\n/).map(block => block.trim()).filter(Boolean).map(block => `<p>${autoLink(block).replace(/\n/g,'<br>')}</p>`).join('');
}

function youtubeId(value=''){
  if (!value) return '';
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./,'');
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
    if (host.endsWith('youtube.com')) {
      if (url.pathname === '/watch') return url.searchParams.get('v') || '';
      const match = url.pathname.match(/^\/(embed|shorts|live)\/([^/?]+)/);
      return match ? match[2] : '';
    }
  } catch (_) {}
  return '';
}

function youtubeHTML(value=''){
  const id = youtubeId(value).replace(/[^a-zA-Z0-9_-]/g,'');
  if (!id) return '';
  return `<div class="embed-wrap"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Embedded YouTube video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
}

function typeLabel(post){
  if (post.type === 'article') return post.category || 'Software Engineering';
  if (post.type === 'media') return 'Gallery';
  return post.type ? post.type.charAt(0).toUpperCase() + post.type.slice(1) : 'Post';
}

function typeClass(type=''){ return ['event','update'].includes(type) ? type : ''; }

function postHref(post){ return `article.html?id=${encodeURIComponent(post.id)}`; }

function cardHTML(post){
  const image = safeMediaSrc(post.image || '');
  return `<a class="card" href="${postHref(post)}">
    ${image ? `<img class="card-img" src="${escapeHTML(image)}" alt="${escapeHTML(post.title)}">` : ''}
    <div class="card-body">
      <div class="card-meta"><span class="type-pill ${typeClass(post.type)}">${escapeHTML(typeLabel(post))}</span><span>${fmtDate(post.date)}</span>${post.type === 'article' ? `<span>${readingTime(post.content)} min read</span>` : ''}</div>
      <h3>${escapeHTML(post.title)}</h3>
      <p>${escapeHTML(post.excerpt || '')}</p>
      ${tagHTML((post.tags || []).slice(0,3))}
      <span class="card-link">Read more <span aria-hidden="true">→</span></span>
    </div>
  </a>`;
}

function eventCardHTML(post){
  const eventDate = new Date(post.eventDate);
  const day = Number.isNaN(eventDate.getTime()) ? '--' : eventDate.toLocaleDateString('en-ZA',{day:'2-digit'});
  const month = Number.isNaN(eventDate.getTime()) ? 'TBA' : eventDate.toLocaleDateString('en-ZA',{month:'short'});
  const registration = safeUrl(post.registrationUrl || '');
  return `<article class="event-card">
    <div class="event-date"><b>${escapeHTML(day)}</b><span>${escapeHTML(month)}</span></div>
    <div class="event-info">
      <h3><a href="${postHref(post)}">${escapeHTML(post.title)}</a></h3>
      <p>${escapeHTML(post.excerpt || '')}</p>
      <p class="event-location">${escapeHTML(fmtDateTime(post.eventDate))}${post.location ? ` · ${escapeHTML(post.location)}` : ''}</p>
    </div>
    <div class="event-actions">
      <a class="btn btn-secondary btn-sm" href="${postHref(post)}">Details</a>
      ${registration ? `<a class="btn btn-primary btn-sm" href="${escapeHTML(registration)}" target="_blank" rel="noopener noreferrer">Register</a>` : ''}
    </div>
  </article>`;
}

async function renderUpdates(targetId, limit){
  const root = document.getElementById(targetId);
  if (!root) return;
  let posts = await window.STORE.byType('update');
  if (limit) posts = posts.slice(0,limit);
  root.innerHTML = posts.length ? posts.map(cardHTML).join('') : '<div class="empty">No official updates have been published yet.</div>';
}

async function splitEvents(){
  const now = new Date();
  const posts = (await window.STORE.byType('event')).sort((a,b) => new Date(a.eventDate) - new Date(b.eventDate));
  return {
    upcoming: posts.filter(post => new Date(post.eventDate) >= now),
    past: posts.filter(post => new Date(post.eventDate) < now).reverse()
  };
}

async function renderEvents(targetId, options={}){
  const root = document.getElementById(targetId);
  if (!root) return;
  const { upcoming, past } = await splitEvents();
  if (options.home) {
    const selected = upcoming.slice(0,options.limit || 2);
    root.innerHTML = selected.length ? `<div class="event-list">${selected.map(eventCardHTML).join('')}</div>` : '<div class="empty">New event dates will be posted here.</div>';
    return;
  }
  root.innerHTML = `
    <div class="event-list">${upcoming.length ? upcoming.map(eventCardHTML).join('') : '<div class="empty">There are no upcoming events at the moment.</div>'}</div>
    ${past.length ? `<div class="past-section"><div class="eyebrow past-label">Past events and summit sessions</div><div class="event-list">${past.map(eventCardHTML).join('')}</div></div>` : ''}`;
}

async function articleCategories(){
  return [...new Set((await window.STORE.byType('article')).map(post => post.category || 'Software Engineering'))];
}

async function renderArticleFilters(targetId, listId){
  const root = document.getElementById(targetId);
  if (!root) return;
  const categories = await articleCategories();
  root.innerHTML = ['All',...categories].map((category,index) => `<button class="filter-btn${index===0?' active':''}" type="button" data-category="${escapeHTML(category)}">${escapeHTML(category)}</button>`).join('');
  root.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    root.querySelectorAll('button').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    renderArticles(listId, button.dataset.category === 'All' ? '' : button.dataset.category);
  }));
}

async function renderArticles(targetId, category='', limit){
  const root = document.getElementById(targetId);
  if (!root) return;
  let posts = await window.STORE.byType('article');
  if (category) posts = posts.filter(post => (post.category || 'Software Engineering') === category);
  if (limit) posts = posts.slice(0,limit);
  root.innerHTML = posts.length ? posts.map(cardHTML).join('') : '<div class="empty">No articles have been published in this category yet.</div>';
}

async function renderGallery(targetId){
  const root = document.getElementById(targetId);
  if (!root) return;
  const posts = (await window.STORE.byType('media')).filter(post => safeMediaSrc(post.image));
  root.innerHTML = posts.length ? posts.map(post => `<button class="gallery-item" type="button" data-image="${escapeHTML(safeMediaSrc(post.image))}" data-title="${escapeHTML(post.title)}">
    <img src="${escapeHTML(safeMediaSrc(post.image))}" alt="${escapeHTML(post.title)}">
    <span class="gallery-caption"><b>${escapeHTML(post.title)}</b><span>${escapeHTML(post.excerpt || '')}</span>${tagHTML((post.tags || []).slice(0,3))}</span>
  </button>`).join('') : '<div class="empty">Photos from Beacon events and activities will appear here.</div>';

  root.querySelectorAll('.gallery-item').forEach(item => item.addEventListener('click', () => openLightbox(item.dataset.image,item.dataset.title)));
}

function openLightbox(image,title){
  let box = document.querySelector('.lightbox');
  if (!box) {
    box = document.createElement('div');
    box.className = 'lightbox';
    box.innerHTML = '<button class="lightbox-close" type="button" aria-label="Close">×</button><img alt="">';
    document.body.appendChild(box);
    box.addEventListener('click', event => { if (event.target === box || event.target.closest('.lightbox-close')) box.classList.remove('open'); });
  }
  const img = box.querySelector('img');
  img.src = image;
  img.alt = title || '';
  box.classList.add('open');
}

async function renderPostDetail(targetId='post-root'){
  const root = document.getElementById(targetId);
  if (!root) return;
  const id = new URLSearchParams(window.location.search).get('id');
  const post = await window.STORE.getById(id);
  if (!post) {
    root.innerHTML = '<div class="wrap post-shell"><div class="empty"><h2>Post not found</h2><p>The item may have been removed or the link may be incorrect.</p><a class="btn btn-secondary" style="margin-top:18px" href="index.html">Return home</a></div></div>';
    return;
  }

  const link = safeUrl(post.linkUrl || '');
  const registration = safeUrl(post.registrationUrl || '');
  const image = safeMediaSrc(post.image || '');
  root.innerHTML = `<main class="post-shell"><div class="wrap post-layout">
    <article>
      <header class="post-head">
        <div class="eyebrow">${escapeHTML(typeLabel(post))}</div>
        <h1>${escapeHTML(post.title)}</h1>
        <p class="post-summary">${escapeHTML(post.excerpt || '')}</p>
        ${tagHTML(post.tags)}
      </header>
      ${image ? `<img class="post-cover" src="${escapeHTML(image)}" alt="${escapeHTML(post.title)}">` : ''}
      <div class="post-content">${richTextHTML(post.content || '')}</div>
      ${youtubeHTML(post.youtubeUrl)}
      ${link ? `<a class="related-link" href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer"><span>${escapeHTML(post.linkLabel || 'Open related link')}</span><span aria-hidden="true">↗</span></a>` : ''}
      ${registration ? `<a class="btn btn-primary" href="${escapeHTML(registration)}" target="_blank" rel="noopener noreferrer">Register for this event</a>` : ''}
    </article>
    <aside class="post-sidebar">
      <h4>Post information</h4>
      <div class="sidebar-meta">
        <div><b>Published</b>${escapeHTML(fmtDate(post.date))}</div>
        ${post.type === 'article' ? `<div><b>Reading time</b>${readingTime(post.content)} minutes</div>` : ''}
        ${post.eventDate ? `<div><b>Event date</b>${escapeHTML(fmtDateTime(post.eventDate))}</div>` : ''}
        ${post.location ? `<div><b>Location</b>${escapeHTML(post.location)}</div>` : ''}
      </div>
      <a class="btn btn-secondary btn-block" style="margin-top:18px" href="${post.type === 'event' ? 'events.html' : post.type === 'update' ? 'updates.html' : 'articles.html'}">Back to ${post.type === 'event' ? 'events' : post.type === 'update' ? 'updates' : 'articles'}</a>
    </aside>
  </div></main>`;
  document.title = `${post.title} — Beacon Innovation Hub`;
}

function initNav(){
  const burger = document.querySelector('.nav-burger');
  const links = document.querySelector('.nav-links');
  if (burger && links) burger.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('[data-page]').forEach(link => link.classList.toggle('active', link.dataset.page === page));
  document.querySelectorAll('[data-year]').forEach(node => node.textContent = new Date().getFullYear());
}

document.addEventListener('DOMContentLoaded', initNav);
