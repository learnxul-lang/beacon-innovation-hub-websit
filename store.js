/* Beacon Innovation Hub — password-only admin with direct Supabase REST access. */

(() => {
  'use strict';

  const cfg = window.BIH_SUPABASE_CONFIG || {};

  if (!cfg.url || !cfg.key) {
    window.STORE_LOAD_ERROR = 'Supabase configuration is missing. Check supabase-config.js.';
    console.error(window.STORE_LOAD_ERROR);
    return;
  }

  const baseUrl = String(cfg.url).replace(/\/$/, '');
  const apiKey = String(cfg.key);

  const dbType = type => type === 'media' ? 'gallery' : type;
  const uiType = type => type === 'gallery' ? 'media' : type;

  function headers(extra = {}) {
    return {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      ...extra
    };
  }

  async function request(url, options = {}) {
    const response = await fetch(url, options);
    const text = await response.text();
    let body = null;

    if (text) {
      try {
        body = JSON.parse(text);
      } catch (_) {
        body = text;
      }
    }

    if (!response.ok) {
      const message = body?.message || body?.error_description || body?.error || text || `Request failed (${response.status}).`;
      throw new Error(message);
    }

    return body;
  }

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90) || `post-${Date.now()}`;
  }

  function fromRow(row) {
    return {
      id: row.id,
      type: uiType(row.type),
      category: row.category || '',
      title: row.title || '',
      excerpt: row.excerpt || '',
      content: row.content || '',
      image: row.image_url || '',
      imagePath: row.image_path || '',
      date: row.published_at || row.created_at || '',
      eventDate: row.event_date || '',
      location: row.location || '',
      registrationUrl: row.registration_url || '',
      tags: Array.isArray(row.hashtags) ? row.hashtags : [],
      youtubeUrl: row.youtube_url || '',
      linkUrl: row.related_link_url || '',
      linkLabel: row.related_link_label || '',
      status: row.status || 'published',
      slug: row.slug || ''
    };
  }

  async function getAll() {
    const query = new URLSearchParams({
      select: '*',
      status: 'eq.published',
      order: 'published_at.desc'
    });

    const rows = await request(`${baseUrl}/rest/v1/posts?${query}`, {
      headers: headers()
    });

    return (rows || []).map(fromRow);
  }

  async function byType(type) {
    const query = new URLSearchParams({
      select: '*',
      type: `eq.${dbType(type)}`,
      status: 'eq.published',
      order: 'published_at.desc'
    });

    const rows = await request(`${baseUrl}/rest/v1/posts?${query}`, {
      headers: headers()
    });

    return (rows || []).map(fromRow);
  }

  async function getById(id) {
    if (!id) return null;

    const query = new URLSearchParams({
      select: '*',
      id: `eq.${id}`,
      limit: '1'
    });

    const rows = await request(`${baseUrl}/rest/v1/posts?${query}`, {
      headers: headers()
    });

    return rows?.[0] ? fromRow(rows[0]) : null;
  }

  function dataUrlToBlob(dataUrl) {
    const [meta, base64] = String(dataUrl).split(',');
    if (!meta || !base64) throw new Error('Invalid image data.');

    const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
    const decoded = atob(base64);
    const bytes = new Uint8Array(decoded.length);

    for (let i = 0; i < decoded.length; i += 1) {
      bytes[i] = decoded.charCodeAt(i);
    }

    return new Blob([bytes], { type: mime });
  }

  async function uploadImage(image) {
    if (!image || !String(image).startsWith('data:image/')) {
      return { url: image || '', path: '' };
    }

    const blob = dataUrlToBlob(image);
    const extension = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const fileId = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const path = `public/${fileId}.${extension}`;

    await request(`${baseUrl}/storage/v1/object/post-images/${encodeURI(path)}`, {
      method: 'POST',
      headers: headers({
        'Content-Type': blob.type,
        'x-upsert': 'false'
      }),
      body: blob
    });

    return {
      url: `${baseUrl}/storage/v1/object/public/post-images/${path}`,
      path
    };
  }

  async function upsert(post) {
    let imageUrl = post.image || '';
    let imagePath = post.imagePath || '';

    if (String(imageUrl).startsWith('data:image/')) {
      const uploaded = await uploadImage(imageUrl);
      imageUrl = uploaded.url;
      imagePath = uploaded.path;
    }

    const baseSlug = slugify(post.title);
    const payload = {
      type: dbType(post.type),
      title: post.title,
      slug: post.slug || `${baseSlug}-${String(post.id || Date.now()).slice(-6)}`,
      excerpt: post.excerpt || null,
      content: post.content || null,
      image_url: imageUrl || null,
      image_path: imagePath || null,
      youtube_url: post.youtubeUrl || null,
      related_link_url: post.linkUrl || null,
      related_link_label: post.linkLabel || null,
      hashtags: post.tags || [],
      location: post.location || null,
      event_date: post.eventDate || null,
      registration_url: post.registrationUrl || null,
      status: post.status || 'published',
      author_id: null,
      published_at: post.date || new Date().toISOString(),
      category: post.category || null
    };

    let rows;

    if (post.id) {
      const query = new URLSearchParams({ id: `eq.${post.id}` });
      rows = await request(`${baseUrl}/rest/v1/posts?${query}`, {
        method: 'PATCH',
        headers: headers({
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        }),
        body: JSON.stringify(payload)
      });
    } else {
      rows = await request(`${baseUrl}/rest/v1/posts`, {
        method: 'POST',
        headers: headers({
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        }),
        body: JSON.stringify(payload)
      });
    }

    if (!rows?.[0]) throw new Error('Supabase did not return the saved publication.');
    return fromRow(rows[0]);
  }

  async function remove(id) {
    const old = await getById(id);
    const query = new URLSearchParams({ id: `eq.${id}` });

    await request(`${baseUrl}/rest/v1/posts?${query}`, {
      method: 'DELETE',
      headers: headers({ Prefer: 'return=minimal' })
    });

    if (old?.imagePath) {
      try {
        await request(`${baseUrl}/storage/v1/object/post-images`, {
          method: 'DELETE',
          headers: headers({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ prefixes: [old.imagePath] })
        });
      } catch (error) {
        console.warn('Post deleted, but its image could not be removed:', error);
      }
    }
  }

  window.STORE = {
    getAll,
    byType,
    getById,
    upsert,
    remove
  };

  window.STORE_LOAD_ERROR = null;
  console.info('Beacon STORE loaded successfully.');
})();
