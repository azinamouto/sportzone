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
sessions. Copy `.env.example` to `.env` and configure `ADMIN_EMAIL` together with
`ADMIN_PASSWORD`, or configure `ADMIN_USERS`. There are no default credentials.
Restart the server after changing `.env` and use the URL printed by that process;
an older process on another port retains its previous credentials.
`npm run preview` only previews
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

## Customer inquiry receipts

Successful inquiries now show a minimal receipt with pending, confirmed, declined,
or completed status. The receipt refreshes every 15 seconds while the page is visible
and checks again when the customer returns. Status changes are announced on the page;
this does not send SMS, email, or background push notifications.
Customers can copy their private tracking link to reopen the receipt on another device.
The latest four receipts are retained in this browser. Treat tracking links as private.

For an existing Supabase deployment, rerun `supabase-schema.sql` before deploying
this change. It adds `booking_requests.tracking_token_hash` without changing existing
records. Only newly submitted inquiries receive tracking links; older inquiries
remain accessible to admins. The public receipt endpoint requires the private token
and excludes contact information, customer messages, and internal admin notes.

## Preferred payment method

After submitting an inquiry, clients can select Cash, Card, GCash, or Other in
their private receipt and save the choice. This records a preference only; it
does not charge the client or mark an inquiry as paid. Staff arrange payment.
The choice is shown in the admin table, mobile cards, and inquiry details, and
can be changed while the inquiry is pending or confirmed.

Before deploying to an existing Supabase project, run
`migrations/20261016_payment_method.sql` in its SQL Editor. New installations
can use the updated `supabase-schema.sql`. Existing inquiries start with no
payment choice. Local JSON storage supports the field without a migration.

## Additional dashboard accounts

Keep `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the existing owner login. Add other
accounts using the server-only `ADMIN_USERS` environment variable, a JSON array
of objects with `email`, `password`, and an optional `name`. Every listed account
has full administrator access. See `.env.example` for the format.

For local use, set `ADMIN_USERS` in `.env` and restart the server. For Vercel,
set the same variable in the deployment environment and redeploy. Never prefix
it with `VITE_` or commit passwords. No database migration is needed. These are
application logins, separate from Supabase Authentication users.
