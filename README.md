# Beacon Innovation Hub — GitHub Pages Edition

Static website connected to Supabase for authentication, database content and image storage.

## Before publishing
1. Run `SUPABASE_SETUP.sql` in Supabase SQL Editor if the table and policies are not already configured.
2. Create a **public** Storage bucket named `post-images`.
3. Create the administrator in Authentication → Users.
4. Upload every file in this folder to the root of the GitHub repository.
5. In GitHub: Settings → Pages → Deploy from branch → `main` → `/(root)`.
6. Open `/admin.html` manually and sign in with the Supabase administrator account.

The public publishable key is intentionally present in `js/supabase-config.js`; security depends on the included RLS policies. Never add a secret/service-role key.


## Temporary password-only admin mode

1. Run `SUPABASE_SETUP.sql` in the Supabase SQL Editor.
2. Change `ADMIN_PASSWORD` near the top of `admin.js`.
3. Commit and redeploy the site.
4. Hard-refresh the admin page.

Security warning: this mode stores the password in public JavaScript and enables anonymous database writes. It is intended only as a temporary setup.
