# Shared data across devices (Supabase)

By default the app stores everything in each browser's own `localStorage`, so
two devices don't see each other's data. Turning on the optional Supabase
backend makes all **app data** — agreements, receipts, disbursements, onward
transfers, parties, accounts and notes — live in one shared row that every
device reads and writes. **User logins stay per-device** (each device's Super
Admin still creates its own logins).

The app talks to Supabase with the **anon key only** (the key Supabase intends
to be public). Devices auto-refresh from the shared row about every 20 seconds;
the most recent save wins.

> ⚠️ **Security note.** Because the site is a public page and there is no
> per-user backend login, the anon key in `supabase.json` is visible to anyone
> who views the page, and the access rule below allows anonymous read/write. In
> practice that means **anyone who finds the page can read or change the data.**
> If that's not acceptable for real figures, switch to per-user Supabase login
> later (the sync code is unchanged) or keep the app on a single trusted device.

## One-time setup

1. Create a free project at https://supabase.com (any region near you).
2. In the project, open **SQL Editor** and run:

   ```sql
   -- One shared row holds the whole app-data blob.
   create table if not exists public.app_state (
     id          text primary key,
     data        jsonb not null default '{}'::jsonb,
     updated_at  timestamptz not null default now()
   );

   -- Bump updated_at on every write (used to detect other devices' changes).
   create or replace function public.touch_app_state() returns trigger as $$
   begin new.updated_at = now(); return new; end;
   $$ language plpgsql;

   drop trigger if exists app_state_touch on public.app_state;
   create trigger app_state_touch before insert or update on public.app_state
     for each row execute function public.touch_app_state();

   -- Allow the anon key to read/write the single shared row.
   alter table public.app_state enable row level security;

   drop policy if exists app_state_rw on public.app_state;
   create policy app_state_rw on public.app_state
     for all to anon
     using (id = 'shared')
     with check (id = 'shared');
   ```

3. In **Project Settings → API**, copy the **Project URL** and the
   **anon / public** key.
4. Put them into `supabase.json` at the repo root and commit:

   ```json
   {
     "url": "https://YOUR-PROJECT.supabase.co",
     "anonKey": "eyJ...your anon key...",
     "table": "app_state",
     "row": "shared"
   }
   ```

That's it. On the next load, each device reads the shared row; the first device
to load seeds it from its own data. Leaving `url`/`anonKey` blank keeps the
backend **off** (localStorage only).

## Turning it off

Blank out `url` and `anonKey` in `supabase.json` (or delete the file) and the
app reverts to per-device localStorage. Existing data in each browser is
untouched.
