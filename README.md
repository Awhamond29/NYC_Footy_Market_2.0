# NYC Footy Market

A marketplace for NYC soccer: teams short on numbers find keepers and outfielders, and players find games to join. Players set an asking price, teams message them in the app, and everyone pays each other directly (Venmo, cash). No checkout, no commission.

**Stack:** Next.js (the website) on Vercel + Supabase (accounts, database, live chat, photo storage). Both have free tiers.

---

## What's in the app

| Page | What it does |
|---|---|
| `/` | Landing page with "Sign up free". Signed-in visitors go straight to Players. |
| `/login` | Sign in with Google or with a link sent by email. Signing in the first time creates the account. |
| `/players` | Listed players: photo, position, price, summary, available days. Filter All / Goalkeepers / Outfielders, sort by price. Tap a player for their full bio, public phone/Venmo, **Message**, **Report** and **Block**. |
| `/games` | "Short on Players": teams' posts sorted by soonest kickoff, updating live. **Post a game**, **Ask to join** (opens a chat with a pre-written message), remove your own posts. Games drop off 2 hours after kickoff. |
| `/chats` | DM inbox with unread dots and a live unread count in the tab bar. Messages arrive instantly. |
| `/profile` | Photo, name, position, best spots, area, college team, experience, summary, days available, phone, Venmo (each with its own *show publicly* switch), price slider, "I'm 18 or older", and "List me in the market". Includes a live card preview and sign out. |

**Privacy and safety built into the database** (`supabase/schema.sql`):
- Phone and Venmo live in a separate table nobody else can read. Other users only ever see a number or handle its owner switched to public.
- Only the two people in a chat can read or send its messages. Messages can't be edited by anyone; recipients can only mark them read.
- You must confirm you're 18+ before listing yourself, posting a game or messaging anyone.
- Blocking stops all messages in both directions. Reports go into a `reports` table only you (the admin) can see in Supabase.

---

## Launch it (about 30–45 minutes, no coding)

You'll create three free accounts: **Supabase**, **GitHub** and **Vercel**.

### 1. Create the database
1. Go to **supabase.com** → Start your project → sign up.
2. **New project.** Name: `nyc-footy-market`. Set a database password and save it somewhere. Region: **East US**.
3. Wait for it to finish setting up (a couple of minutes).

### 2. Load the schema
1. In your project, open **SQL Editor** (left sidebar) → **New query**.
2. Open `supabase/schema.sql` from this folder, copy everything, paste it in, and click **Run**.
3. You should see "Success. No rows returned." That created every table, privacy rule, the photo bucket and live updates.

### 2b. Load the reviews feature
Also run `supabase/002_reviews.sql` the same way (SQL Editor → New query → paste → Run). It adds player reviews and ratings.

### 3. Copy your two keys
In Supabase go to **Project Settings → API Keys** (on some projects it's **Settings → API**). Copy:
- **Project URL**: looks like `https://abcdefgh.supabase.co`
- **Publishable key** (older projects call it the **anon public** key)

Both are safe to put in a website. Never use the *secret* / *service_role* key here.

### 4. Put the code on GitHub
1. Sign up at **github.com** → **New repository** → name it `nyc-footy-market` → Private → Create.
2. On the new repo page click **uploading an existing file**, drag in **everything inside this folder** (not the folder itself), and click **Commit changes**.

### 5. Deploy on Vercel
1. Go to **vercel.com** → sign up **with GitHub**.
2. **Add New → Project** → import `nyc-footy-market`.
3. Open **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = your publishable key
4. Click **Deploy**. In about a minute you get a live link like `https://nyc-footy-market.vercel.app`.

### 6. Tell Supabase where the site lives
In Supabase go to **Authentication → URL Configuration**:
- **Site URL**: your Vercel link, e.g. `https://nyc-footy-market.vercel.app`
- **Redirect URLs** → add `https://nyc-footy-market.vercel.app/auth/callback`
  (and `http://localhost:3000/auth/callback` if you'll run it on your own computer)

Email sign-in links now work.

### 7. Turn on "Continue with Google" (recommended)
Google sign-in is one tap for users and avoids email delivery limits.
1. In Supabase, **Authentication → Sign In / Providers → Google**. Copy the **Callback URL** shown there (it ends in `/auth/v1/callback`).
2. Go to **console.cloud.google.com** → create a project → **APIs & Services → OAuth consent screen**. Set it up as **External** with the app name "NYC Footy Market" and your email.
3. **Credentials → Create credentials → OAuth client ID** → **Web application**. Under **Authorized redirect URIs**, paste the Supabase callback URL. Create it.
4. Paste the **Client ID** and **Client secret** into the Supabase Google provider and enable it.

### 8. Test with two accounts
Open your link in a normal window and in a private window. Sign in as two different people. Make a profile on each, list one, post a game from the other, and message back and forth. Messages should appear instantly on both.

### 9. Optional: your own domain
Buy `nycfootymarket.com` (or similar) at any registrar, then in Vercel go to **Project → Settings → Domains → Add**. Follow the DNS instructions it shows. Then update the Site URL and Redirect URL from step 6 to the new domain.

---

## Before you invite lots of people
- **Email sending limits.** Supabase's built-in email sender only allows a handful of sign-in emails per hour. Before a big launch, connect a free email service such as Resend under **Authentication → Emails → SMTP Settings**, or lean on Google sign-in.
- **Reports.** Check **Table Editor → reports** now and then. To remove someone, delete them under **Authentication → Users**. That also deletes their profile, posts and messages.
- **Rules.** The landing page says 18+ only and meet at public fields. Consider adding short Terms and a Privacy page before a public launch.

## Change things later
Edit files on GitHub (open a file → pencil icon → commit). Vercel redeploys automatically within a minute. Or ask Claude to make the change and upload the new files.

## Run it on your own computer (optional)
Requires Node.js 20 or newer.
```bash
npm install
cp .env.example .env.local   # then paste in your two Supabase values
npm run dev                  # open http://localhost:3000
```

## Ideas for the next version
- Email or text alerts when someone messages you (so last-minute requests get seen)
- Sign in with a phone number (needs an SMS provider such as Twilio; costs a few cents per text)
- Install-to-home-screen app icon (PWA)
- Ratings after a game, a "no-show" flag, and filters by borough and day
