/* Beacon Innovation Hub — password-only admin with anonymous Supabase publishing. */

window.STORE = (() => {
  'use strict';

  const cfg = window.BIH_SUPABASE_CONFIG || {};

  if (!window.supabase) {
    throw new Error('Supabase JavaScript library was not loaded.');
  }

  if (!cfg.url || !cfg.key) {
    throw new Error('Supabase configuration is missing. Check supabase-config.js.');
  }

  const client = window.supabase.createClient(cfg.url, cfg.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  const dbType = type => type === 'media' ? 'gallery' : type;
  const uiType = type => type === 'gallery' ? 'media' : type;

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
    const { data, error } = await client
      .from('posts')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(fromRow);
  }

  async function byType(type) {
    const { data, error } = await client
      .from('posts')
      .select('*')
      .eq('type', dbType(type))
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(fromRow);
  }

  async function getById(id) {
    if (!id) return null;

    const { data, error } = await client
      .from('posts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? fromRow(data) : null;
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
    const id = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const path = `public/${id}.${extension}`;

    const { error } = await client.storage
      .from('post-images')
      .upload(path, blob, {
        contentType: blob.type,
        upsert: false
      });

    if (error) throw new Error(`Image upload failed: ${error.message}`);

    const { data } = client.storage
      .from('post-images')
      .getPublicUrl(path);

    return { url: data.publicUrl, path };
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

    const result = post.id
      ? await client.from('posts').update(payload).eq('id', post.id).select().single()
      : await client.from('posts').insert(payload).select().single();

    if (result.error) throw new Error(result.error.message);
    return fromRow(result.data);
  }

  async function remove(id) {
    const old = await getById(id);

    const { error } = await client
      .from('posts')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);

    if (old?.imagePath) {
      const { error: imageError } = await client.storage
        .from('post-images')
        .remove([old.imagePath]);

      if (imageError) {
        console.warn('Post deleted, but image removal failed:', imageError);
      }
    }
  }

  return {
    client,
    getAll,
    byType,
    getById,
    upsert,
    remove
  };
})();
