/* Beacon Innovation Hub — Supabase data access for GitHub Pages. */

window.STORE = (() => {
  'use strict';

  const cfg = window.BIH_SUPABASE_CONFIG || {};

  if (!window.supabase || !cfg.url || !cfg.key) {
    throw new Error(
      'Supabase configuration is missing. Check supabase-config.js.'
    );
  }

  const client = window.supabase.createClient(
    cfg.url,
    cfg.key,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  function dbType(type) {
    return type === 'media' ? 'gallery' : type;
  }

  function uiType(type) {
    return type === 'gallery' ? 'media' : type;
  }

  function slugify(value) {
    const slug = String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90);

    return slug || `post-${Date.now()}`;
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
      tags: Array.isArray(row.hashtags)
        ? row.hashtags
        : [],
      youtubeUrl: row.youtube_url || '',
      linkUrl: row.related_link_url || '',
      linkLabel: row.related_link_label || '',
      status: row.status || 'published',
      authorId: row.author_id || '',
      slug: row.slug || ''
    };
  }

  async function currentUser() {
    const {
      data,
      error
    } = await client.auth.getUser();

    if (error) {
      return null;
    }

    return data.user || null;
  }

  async function getAll() {
    const {
      data,
      error
    } = await client
      .from('posts')
      .select('*')
      .eq('status', 'published')
      .order('published_at', {
        ascending: false
      });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map(fromRow);
  }

  async function byType(type) {
    const {
      data,
      error
    } = await client
      .from('posts')
      .select('*')
      .eq('type', dbType(type))
      .eq('status', 'published')
      .order('published_at', {
        ascending: false
      });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map(fromRow);
  }

  async function getById(id) {
    if (!id) {
      return null;
    }

    const {
      data,
      error
    } = await client
      .from('posts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data ? fromRow(data) : null;
  }

  function dataUrlToBlob(dataUrl) {
    const [meta, base64] = dataUrl.split(',');

    if (!meta || !base64) {
      throw new Error('Invalid image data.');
    }

    const mimeMatch = meta.match(/data:([^;]+)/);
    const mime = mimeMatch?.[1] || 'image/jpeg';

    const decoded = atob(base64);
    const bytes = new Uint8Array(decoded.length);

    for (let index = 0; index < decoded.length; index += 1) {
      bytes[index] = decoded.charCodeAt(index);
    }

    return new Blob([bytes], {
      type: mime
    });
  }

  async function uploadImage(image, userId) {
    if (
      !image ||
      !String(image).startsWith('data:image/')
    ) {
      return {
        url: image || '',
        path: ''
      };
    }

    const blob = dataUrlToBlob(image);

    const extension = (
      blob.type.split('/')[1] || 'jpg'
    ).replace('jpeg', 'jpg');

    const randomId =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()
            .toString(16)
            .slice(2)}`;

    const path =
      `${userId}/${randomId}.${extension}`;

    const {
      error
    } = await client.storage
      .from('post-images')
      .upload(path, blob, {
        contentType: blob.type,
        upsert: false
      });

    if (error) {
      throw new Error(
        `Image upload failed: ${error.message}`
      );
    }

    const {
      data
    } = client.storage
      .from('post-images')
      .getPublicUrl(path);

    return {
      url: data.publicUrl,
      path
    };
  }

  async function upsert(post) {
    const user = await currentUser();

    if (!user) {
      throw new Error(
        'Your administrator session has expired. Sign in again.'
      );
    }

    let imageUrl = post.image || '';
    let imagePath = post.imagePath || '';

    if (
      String(imageUrl).startsWith('data:image/')
    ) {
      const uploaded = await uploadImage(
        imageUrl,
        user.id
      );

      imageUrl = uploaded.url;
      imagePath = uploaded.path;
    }

    const baseSlug = slugify(post.title);

    const payload = {
      type: dbType(post.type),
      title: post.title,
      slug:
        post.slug ||
        `${baseSlug}-${String(
          post.id || Date.now()
        ).slice(-6)}`,
      excerpt: post.excerpt || null,
      content: post.content || null,
      image_url: imageUrl || null,
      image_path: imagePath || null,
      youtube_url: post.youtubeUrl || null,
      related_link_url: post.linkUrl || null,
      related_link_label:
        post.linkLabel || null,
      hashtags: post.tags || [],
      location: post.location || null,
      event_date: post.eventDate || null,
      registration_url:
        post.registrationUrl || null,
      status: post.status || 'published',
      author_id: user.id,
      published_at:
        post.date || new Date().toISOString(),
      category: post.category || null
    };

    let result;

    if (post.id) {
      result = await client
        .from('posts')
        .update(payload)
        .eq('id', post.id)
        .select()
        .single();
    } else {
      result = await client
        .from('posts')
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      throw new Error(result.error.message);
    }

    return fromRow(result.data);
  }

  async function remove(id) {
    const existingPost = await getById(id);

    const {
      error
    } = await client
      .from('posts')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    if (existingPost?.imagePath) {
      const {
        error: storageError
      } = await client.storage
        .from('post-images')
        .remove([existingPost.imagePath]);

      if (storageError) {
        console.warn(
          'The post was deleted, but its image could not be removed:',
          storageError
        );
      }
    }
  }

  async function login(email, password) {
    const {
      data,
      error
    } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw new Error(error.message);
    }

    return data.user || null;
  }

  async function logout() {
    const {
      error
    } = await client.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }
  }

  async function isAuthed() {
    const {
      data,
      error
    } = await client.auth.getSession();

    if (error) {
      return false;
    }

    return Boolean(data.session);
  }

  async function changePassword(nextPassword) {
    const {
      data,
      error
    } = await client.auth.updateUser({
      password: nextPassword
    });

    if (error) {
      throw new Error(error.message);
    }

    return data.user || null;
  }

  return {
    client,
    getAll,
    byType,
    getById,
    upsert,
    remove,
    login,
    logout,
    isAuthed,
    changePassword
  };
})();
