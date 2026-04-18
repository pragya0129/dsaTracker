# Deploying AlgoLedger (free beta)

The $0/month stack: **Vercel** (frontend) + **Render** (Spring Boot backend) +
**Neon** (Postgres). You'll need GitHub accounts on all three. ~30 minutes of
clicks end-to-end.

---

## 1. Push to GitHub

```bash
git add .
git commit -m "Deploy prep"
git push
```

Sanity check: `src/main/resources/application.properties` should be
git-ignored (the committed one is `application.properties.example`). Run
`git ls-files src/main/resources/` to confirm — you should see
`application.properties.example`, `logback-spring.xml`, and `static/` /
`templates/` folders, but **not** `application.properties`.

## 2. Provision the database — Neon

1. [neon.tech](https://neon.tech) → Sign in with GitHub.
2. **Create project** → name it `algoledger`, region closest to you.
3. On the project dashboard, open the **Connection Details** panel.
4. Pick the **Pooled connection** option. You'll see a string that looks like:
   `postgresql://neondb_owner:npg_XXX@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require`
5. Split that into three pieces — you'll paste them into Render as env vars:
   - **DB_URL**  → `jdbc:postgresql://ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require`
     (note: prepend `jdbc:` and drop the `user:pass@` part — those go below)
   - **DB_USER** → `neondb_owner`
   - **DB_PASSWORD** → the `npg_XXX` bit after the colon

## 3. Deploy the backend — Render

> **Note:** Render has no native Java runtime — you deploy Java apps as
> Docker images. The repo already includes a `Dockerfile` that handles
> the Maven build + Java 17 runtime in two stages, so all you do on
> Render is point at the repo and pick "Docker".

1. [render.com](https://render.com) → sign in with GitHub.
2. **New** → **Web Service** → connect the repo.
3. Configure:
   - **Name**: `algoledger`
   - **Language / Environment**: **Docker** (don't pick Node.js — Render
     defaults to it if you skip this, and the build fails with
     "JAVA_HOME not defined")
   - **Branch**: `main`
   - **Root Directory**: (leave blank — the `Dockerfile` is at repo root)
   - **Dockerfile Path**: `./Dockerfile` (auto-detected)
   - **Build Command**: (leave blank — the `Dockerfile` handles it)
   - **Start Command**: (leave blank — the `Dockerfile` `ENTRYPOINT` handles it)
   - **Instance Type**: **Free**
   - **Region**: Singapore (closest to Indian users)

   If you already created a service with the wrong runtime (Node.js), just
   open **Settings** on that service → **Build & Deploy** → change
   **Language** from Node to Docker, clear any build/start commands, save,
   and manually trigger a redeploy. No need to delete and recreate.
4. **Environment** tab → add these one at a time:

   ```
   DB_URL                            = jdbc:postgresql://ep-xxx-pooler.../neondb?sslmode=require
   DB_USER                           = neondb_owner
   DB_PASSWORD                       = npg_XXX
   APP_JWT_SECRET                    = (run: openssl rand -base64 48)
   APP_CORS_ORIGINS                  = https://PLACEHOLDER.vercel.app
   APP_WEB_BASE_URL                  = https://PLACEHOLDER.vercel.app
   APP_SIGNUP_VERIFICATION_ENABLED   = false
   APP_MAIL_PROVIDER                 = logging
   ```

   (We'll fix the two `PLACEHOLDER` lines once we have a real Vercel URL.)

5. Click **Create Web Service**. First build takes ~4 minutes.
6. Once logs show `Started DsaApplication in Xs`, grab the URL Render assigns
   — something like `https://algoledger-xxxx.onrender.com`. Open it at
   `/auth/welcome` — you should see `Welcome this endpoint is not secure`.

## 4. Deploy the frontend — Vercel

1. [vercel.com](https://vercel.com) → sign in with GitHub.
2. **Add New** → **Project** → pick the same repo.
3. Configure:
   - **Root Directory**: `frontend/website`
   - **Framework Preset**: Vite (auto-detected)
4. **Environment Variables** → add:

   ```
   VITE_API_BASE = https://algoledger-xxxx.onrender.com
   ```

   (Paste the Render URL from step 3.6, no trailing slash.)

5. **Deploy**. First build takes ~2 minutes. Vercel gives you a URL like
   `https://algoledger.vercel.app`.

## 5. Final wiring

Go back to Render → **Environment** → update two variables to the real
Vercel URL:

```
APP_CORS_ORIGINS  = https://algoledger.vercel.app
APP_WEB_BASE_URL  = https://algoledger.vercel.app
```

Save. Render redeploys in ~30s (config-only change; no rebuild).

## 6. Smoke test

Open an incognito window, hit the Vercel URL:

- Landing page loads ✓
- Signup → user created (Render log shows "Hibernate: insert into user_info...")
- Login → dashboard
- Onboarding → verify a LeetCode handle (submit any attempt on Two Sum)
- Create a community post, follow another user, etc.

The **first API call after 15 min of idle** will hit a ~60s cold start —
that's Render's free tier. After that, it's fast until the next nap.

## 7. Mitigating the cold start (optional)

[UptimeRobot](https://uptimerobot.com) → free — add a monitor:
- URL: `https://algoledger-xxxx.onrender.com/auth/welcome`
- Interval: every 10 minutes

That's enough to keep Render warm. Technically cheating the free tier; every
student beta does this.

---

## When you later buy a domain + verify Resend

Three env-var updates on Render and you're done:

```
APP_MAIL_PROVIDER                 = resend
APP_MAIL_FROM                     = AlgoLedger <hello@yourdomain.com>
APP_MAIL_RESEND_API_KEY           = re_XXXXX
APP_SIGNUP_VERIFICATION_ENABLED   = true
```

Redeploy backend. Signup OTP flow turns back on. Reminder emails start
actually delivering.

For a custom frontend domain, add it on Vercel (Settings → Domains) and
update `APP_CORS_ORIGINS` + `APP_WEB_BASE_URL` to match.

---

## After the first successful deploy

Lock the schema so deploys can't silently alter it. On Render, change:

```
SPRING_JPA_HIBERNATE_DDL_AUTO = validate
```

Redeploy. Any future schema change must be applied manually before the app
starts, which is exactly what you want in production.

---

## Troubleshooting

**Spring Boot banner prints then `Failed to determine a suitable driver class` →
`No open ports detected`** — `application.properties` isn't in the image.
The file is git-ignored (your local copy may contain secrets), so only
`application.properties.example` is committed. The Dockerfile copies the
example to `application.properties` during build — make sure you pulled the
latest `Dockerfile` from the repo, then redeploy.

**Render build errors with `The JAVA_HOME environment variable is not defined`** —
Render auto-detected Node.js because it saw a package.json nearby. Open
the service → **Settings** → **Build & Deploy** → change **Language**
from Node to **Docker**, clear any build/start commands (the `Dockerfile`
handles both), save, trigger a manual redeploy.

**Build fails with "postgresql driver not found"** — make sure you pulled
the `pom.xml` change that swapped `mysql-connector-j` for `postgresql`.

**Backend 500s with "password authentication failed"** — Neon's DB_USER is
`neondb_owner` (note the underscore), not `neondb`. Double-check the split.

**CORS errors in the browser console** — `APP_CORS_ORIGINS` on Render must
exactly match the Vercel origin, including `https://`, no trailing slash.
You can list multiple with commas: `https://app.vercel.app,https://algoledger.com`.

**"It's slow" on first visit** — that's the Render cold start. Section 7
shows how to keep it warm.

**Vercel build works but login fails silently** — you forgot to set
`VITE_API_BASE` on Vercel. Add it, redeploy (Vite bakes env vars at build
time, so a restart isn't enough — needs a new build).

**Hibernate complains about "TEXT" type** — you skipped the
`UserInfo.profilePic` `columnDefinition` change from `LONGTEXT` (MySQL-only)
to `TEXT`. Pull the latest code.
