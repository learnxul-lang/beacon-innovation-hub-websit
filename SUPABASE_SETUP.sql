-- Beacon Innovation Hub — password-only client login mode.
-- WARNING: the password is stored in public JavaScript. These policies allow
-- anonymous browser clients to create, update and delete content. This is
-- convenient but is NOT secure. Use only as a temporary setup.

create extension if not exists pgcrypto;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('update','event','article','summit-review','gallery')),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text,
  category text,
  image_url text,
  image_path text,
  youtube_url text,
  related_link_url text,
  related_link_label text,
  hashtags text[] not null default '{}',
  location text,
  event_date timestamptz,
  registration_url text,
  status text not null default 'published' check (status in ('draft','published')),
  author_id uuid references auth.users(id) on delete set null,
  published_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts enable row level security;

-- Remove earlier policies if they exist.
drop policy if exists "Public can read published posts" on public.posts;
drop policy if exists "Authenticated users can create posts" on public.posts;
drop policy if exists "Authors can update own posts" on public.posts;
drop policy if exists "Authors can delete own posts" on public.posts;
drop policy if exists "Password mode read posts" on public.posts;
drop policy if exists "Password mode create posts" on public.posts;
drop policy if exists "Password mode update posts" on public.posts;
drop policy if exists "Password mode delete posts" on public.posts;

create policy "Password mode read posts"
on public.posts for select
to anon, authenticated
using (status = 'published');

create policy "Password mode create posts"
on public.posts for insert
to anon, authenticated
with check (true);

create policy "Password mode update posts"
on public.posts for update
to anon, authenticated
using (true)
with check (true);

create policy "Password mode delete posts"
on public.posts for delete
to anon, authenticated
using (true);

-- Ensure the image bucket exists and is public.
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do update set public = true;

-- Remove earlier storage policies if they exist.
drop policy if exists "Public can view post images" on storage.objects;
drop policy if exists "Authenticated users can upload post images" on storage.objects;
drop policy if exists "Authenticated users can update post images" on storage.objects;
drop policy if exists "Authenticated users can delete post images" on storage.objects;
drop policy if exists "Password mode view images" on storage.objects;
drop policy if exists "Password mode upload images" on storage.objects;
drop policy if exists "Password mode update images" on storage.objects;
drop policy if exists "Password mode delete images" on storage.objects;

create policy "Password mode view images"
on storage.objects for select
to public
using (bucket_id = 'post-images');

create policy "Password mode upload images"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'post-images');

create policy "Password mode update images"
on storage.objects for update
to anon, authenticated
using (bucket_id = 'post-images')
with check (bucket_id = 'post-images');

create policy "Password mode delete images"
on storage.objects for delete
to anon, authenticated
using (bucket_id = 'post-images');
