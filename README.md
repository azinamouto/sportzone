# Sports Zone

## Local dashboard

```sh
bun install
npm run dev
```

Open http://localhost:3000/ or http://localhost:3000/dashboard (`/admin` is an alias).
To start and open the app from VS Code, choose **Start Sports Zone + open dashboard**
in Run and Debug and press **F5**. This starts the server and opens the dashboard in
your default browser. If `npm run dev` is already running, use its localhost URL
instead of starting a second server.
Opening HTML with `file://` or a static Live Server cannot run the booking API.
The previous debugger path referenced another user's folder, causing the trusted-folder error.

If an existing preview still says **Forbidden. File does not reside within a trusted
folder**, close that preview and paste `http://localhost:3000/dashboard` into Chrome
or Edge's address bar. The address must start with `http://localhost`, not `file://`.
For VS Code's embedded browser, navigate to the same HTTP URL. Open the whole project
with **File > Open Folder > C:\\Users\\admin\\Documents\\sportzone** rather than opening
individual HTML files.

Without Supabase, local development uses `data/booking_requests.json` and in-memory
sessions. The local demo login is `admin@net` / `admin123`. Copy `.env.example` to
`.env` to configure your own credentials or Supabase. `npm run preview` only previews
the static build; use `npm run dev` for the full app.

## Deploy on Vercel

1. Run `supabase-schema.sql` in your Supabase project's SQL editor. It can be rerun
   and preserves existing bookings. It also removes the old public access policies;
   database requests now go through the server API.
2. Import this repository into Vercel with the repository root as the Root Directory.
   `vercel.json` selects Vite, `npm run build`, and the `dist` output directory.
3. Add these environment variables for each Vercel environment you will deploy:
   - `SUPABASE_URL`: your Supabase project URL.
   - `SUPABASE_SERVICE_ROLE_KEY`: the server-only Supabase service role key.
   - `ADMIN_EMAIL`: the admin login email.
   - `ADMIN_PASSWORD`: a strong admin password.
4. Deploy, then visit `/dashboard`. Verify login, submit a court request from the
   homepage, and confirm it appears in the dashboard. Existing JSON demo bookings
   are not automatically imported into Supabase.

The homepage and dashboard are built as static pages; `/api/*` runs through the
Express Vercel Function in `api/index.ts`. No Vite development server runs on Vercel.
Never add the service role key to browser code or a `VITE_` variable. Supabase is
required on Vercel: storage failures return errors instead of reporting success
after writing bookings to temporary files. Admin sessions expire after eight hours;
logout revokes them across instances. Expired session rows can be removed periodically
with `delete from public.admin_sessions where expires_at < now();`.

Validation: `npm run build`, `npm run lint`, and `npm test`.
