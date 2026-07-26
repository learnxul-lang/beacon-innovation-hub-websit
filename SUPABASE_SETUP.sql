-- Run in Supabase SQL Editor. Safe to run on a new project.
create extension if not exists pgcrypto;
create table if not exists public.posts (
 id uuid primary key default gen_random_uuid(),
 type text not null check (type in ('update','event','article','summit-review','gallery')),
 title text not null, slug text not null unique, excerpt text, content text, category text,
 image_url text, image_path text, youtube_url text, related_link_url text, related_link_label text,
 hashtags text[] not null default '{}', location text, event_date timestamptz, registration_url text,
 status text not null default 'published' check (status in ('draft','published')),
 author_id uuid references auth.users(id) on delete set null, published_at timestamptz default now(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.posts enable row level security;
create policy "Public can read published posts" on public.posts for select to anon, authenticated using (status='published');
create policy "Authenticated users can create posts" on public.posts for insert to authenticated with check (auth.uid()=author_id);
create policy "Authors can update own posts" on public.posts for update to authenticated using (auth.uid()=author_id) with check (auth.uid()=author_id);
create policy "Authors can delete own posts" on public.posts for delete to authenticated using (auth.uid()=author_id);
create policy "Public can view post images" on storage.objects for select to public using (bucket_id='post-images');
create policy "Authenticated users can upload post images" on storage.objects for insert to authenticated with check (bucket_id='post-images');
create policy "Authenticated users can update post images" on storage.objects for update to authenticated using (bucket_id='post-images') with check (bucket_id='post-images');
create policy "Authenticated users can delete post images" on storage.objects for delete to authenticated using (bucket_id='post-images');
