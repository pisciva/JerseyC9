# Supabase + Vercel Setup

This app stores pickup status in Supabase and pickup photos in Vercel Blob.

## 1. Create Supabase Project

1. Open https://supabase.com/dashboard.
2. Create a new project.
3. Choose any region close to your users.
4. Wait until the project is ready.

## 2. Create Database Table

Open Supabase SQL Editor, paste `supabase-schema.sql`, then run it.

The table name must be:

```sql
public.distribution_records
```

## 3. Copy Supabase Values

In Supabase, open Project Settings.

Copy:

- Project URL
- Secret/service role key

Use these in Vercel:

```env
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-secret-or-service-role-key
```

Keep the secret/service role key server-side only. Do not expose it with a `VITE_` prefix.

## 4. Configure Vercel Environment Variables

Open Vercel project settings, then Environment Variables.

Add:

```env
ADMIN_ACCESS_CODE=your-admin-code
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-secret-or-service-role-key
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
```

Optional per-admin codes:

```env
ADMIN_CODES_JSON={"CODE-A":"Committee A","CODE-B":"Committee B","CODE-C":"Committee C"}
```

If `ADMIN_CODES_JSON` is set, each code maps to a committee name.

## 5. Enable Vercel Blob

In Vercel, enable Blob for the project and add `BLOB_READ_WRITE_TOKEN` to Environment Variables.

## 6. Redeploy

Redeploy after adding environment variables. Vercel only applies new environment variables to new deployments.

## 7. Test

Open:

```text
https://your-domain.vercel.app/api/distribution
```

Expected response before any pickup:

```json
{ "records": [] }
```

Then:

1. Open the dashboard.
2. Enter admin access.
3. Mark one learner as picked up.
4. Refresh `/api/distribution`.
5. The new record should appear.
6. Open the dashboard from another device and confirm the learner is also `Picked Up`.
