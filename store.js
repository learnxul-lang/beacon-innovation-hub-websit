/* Beacon Innovation Hub — Supabase data access for GitHub Pages. */
const STORE = (() => {
  const cfg = window.BIH_SUPABASE_CONFIG || {};
  if (!window.supabase || !cfg.url || !cfg.key) throw new Error('Supabase configuration is missing.');
  const client = window.supabase.createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const dbType = type => type === 'media' ? 'gallery' : type;
  const uiType = type => type === 'gallery' ? 'media' : type;
  const slugify = value => String(value || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || `post-${Date.now()}`;

  function fromRow(row){
    return {
      id: row.id, type: uiType(row.type), category: row.category || '', title: row.title,
      excerpt: row.excerpt || '', content: row.content || '', image: row.image_url || '',
      imagePath: row.image_path || '', date: row.published_at || row.created_at,
      eventDate: row.event_date || '', location: row.location || '', registrationUrl: row.registration_url || '',
      tags: row.hashtags || [], youtubeUrl: row.youtube_url || '', linkUrl: row.related_link_url || '',
      linkLabel: row.related_link_label || '', status: row.status || 'published', authorId: row.author_id || ''
    };
  }

  async function currentUser(){
    const { data, error } = await client.auth.getUser();
    if (error) return null;
    return data.user || null;
  }

  async function getAll(){
    const { data, error } = await client.from('posts').select('*').order('published_at',{ascending:false});
    if (error) throw new Error(error.message);
    return (data || []).map(fromRow);
  }
  async function byType(type){
    const { data, error } = await client.from('posts').select('*').eq('type',dbType(type)).order('published_at',{ascending:false});
    if (error) throw new Error(error.message);
    return (data || []).map(fromRow);
  }
  async function getById(id){
    if (!id) return null;
    const { data, error } = await client.from('posts').select('*').eq('id',id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow(data) : null;
  }

  function dataUrlToBlob(dataUrl){
    const [meta, b64] = dataUrl.split(',');
    const mime = (meta.match(/data:([^;]+)/)||[])[1] || 'image/jpeg';
    const bytes = atob(b64); const arr = new Uint8Array(bytes.length);
    for(let i=0;i<bytes.length;i++) arr[i]=bytes.charCodeAt(i);
    return new Blob([arr],{type:mime});
  }
  async function uploadImage(image, userId){
    if (!image || !String(image).startsWith('data:image/')) return {url:image || '',path:''};
    const blob=dataUrlToBlob(image);
    const ext=(blob.type.split('/')[1]||'jpg').replace('jpeg','jpg');
    const path=`${userId}/${crypto.randomUUID()}.${ext}`;
    const { error }=await client.storage.from('post-images').upload(path,blob,{contentType:blob.type,upsert:false});
    if(error) throw new Error(`Image upload failed: ${error.message}`);
    const { data }=client.storage.from('post-images').getPublicUrl(path);
    return {url:data.publicUrl,path};
  }

  async function upsert(post){
    const user=await currentUser();
    if(!user) throw new Error('Your administrator session has expired. Sign in again.');
    let imageUrl=post.image || '', imagePath=post.imagePath || '';
    if(String(imageUrl).startsWith('data:image/')){
      const uploaded=await uploadImage(imageUrl,user.id); imageUrl=uploaded.url; imagePath=uploaded.path;
    }
    const baseSlug=slugify(post.title);
    const payload={
      type:dbType(post.type), title:post.title, slug:post.slug || `${baseSlug}-${String(post.id||Date.now()).slice(-6)}`,
      excerpt:post.excerpt || null, content:post.content || null, image_url:imageUrl || null, image_path:imagePath || null,
      youtube_url:post.youtubeUrl || null, related_link_url:post.linkUrl || null, related_link_label:post.linkLabel || null,
      hashtags:post.tags || [], location:post.location || null, event_date:post.eventDate || null,
      registration_url:post.registrationUrl || null, status:post.status || 'published', author_id:user.id,
      published_at:post.date || new Date().toISOString(), category:post.category || null
    };
    let result;
    if(post.id) result=await client.from('posts').update(payload).eq('id',post.id).select().single();
    else result=await client.from('posts').insert(payload).select().single();
    if(result.error) throw new Error(result.error.message);
    return fromRow(result.data);
  }
  async function remove(id){
    const old=await getById(id);
    const { error }=await client.from('posts').delete().eq('id',id);
    if(error) throw new Error(error.message);
    if(old?.imagePath) await client.storage.from('post-images').remove([old.imagePath]);
  }
  async function login(email,password){
    const { error }=await client.auth.signInWithPassword({email,password});
    if(error) throw new Error(error.message);
    return true;
  }
  async function logout(){ await client.auth.signOut(); }
  async function isAuthed(){ const {data}=await client.auth.getSession(); return Boolean(data.session); }
  async function changePassword(next){
    const { error }=await client.auth.updateUser({password:next});
    if(error) throw new Error(error.message); return true;
  }
  async function reset(){ throw new Error('Starter-content reset is not available on the hosted site.'); }
  return {client,getAll,byType,getById,upsert,remove,login,logout,isAuthed,changePassword,reset};
})();
