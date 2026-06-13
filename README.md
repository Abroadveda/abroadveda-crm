# Abroad Veda CRM

A full-stack CRM for study-abroad counsellors and BDEs — built with React + Vite, Tailwind CSS, and Supabase (PostgreSQL).

## Live demo
Deployed at: `https://YOUR_GITHUB_USERNAME.github.io/abroadveda-crm/`

---

## 🚀 One-time setup (15 minutes)

### Step 1 — Create your Supabase project
1. Go to [supabase.com](https://supabase.com) → **New project**
2. Choose a name (e.g. `abroadveda-crm`) and a strong database password. Save the password somewhere.
3. Wait ~2 minutes for the project to provision.
4. In the sidebar go to **SQL Editor** → **New query**
5. Paste the entire contents of `supabase/schema.sql` and click **Run**
6. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon / public** key

### Step 2 — Run locally
```bash
git clone https://github.com/YOUR_USERNAME/abroadveda-crm.git
cd abroadveda-crm
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key
npm run dev
```
Open http://localhost:5173

### Step 3 — Push to GitHub
```bash
git init          # if not already a repo
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/abroadveda-crm.git
git push -u origin main
```

### Step 4 — Enable GitHub Pages
1. In your GitHub repo → **Settings → Pages**
2. Source: **GitHub Actions**
3. Go to **Settings → Secrets and variables → Actions → New repository secret**:
   - `VITE_SUPABASE_URL` → paste your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → paste your anon key
4. Go to **Actions** tab → run the **Deploy to GitHub Pages** workflow manually once.
5. Your CRM is now live at `https://YOUR_USERNAME.github.io/abroadveda-crm/`

---

## 🗄️ Database tables

| Table | Purpose |
|---|---|
| `students` | Core lead/student records |
| `team_members` | Counsellors and BDEs |
| `notes` | Counselling notes per student |
| `applications` | Course applications per student |
| `documents` | Document checklist per student |
| `settings` | App-wide key-value settings (passwords, webhook URL) |

---

## 🔒 Security notes
- The anon key is safe to expose in frontend code — it's public by design.
- Row Level Security is enabled on all tables.
- The included policies allow all access. For production, add Supabase Auth and replace policies with `auth.uid()` checks.
- The three CRM passwords (app / admin / export) are stored as hashed values in the `settings` table.

---

## 🛠️ Tech stack
- **React 18** + **Vite**
- **Tailwind CSS v4**
- **Supabase** (PostgreSQL + real-time + storage)
- **lucide-react** icons
- **SheetJS (xlsx)** for Excel import/export
- **GitHub Actions** for CI/CD → **GitHub Pages** for hosting

---

## 📦 Scripts
```bash
npm run dev      # local dev server (http://localhost:5173)
npm run build    # production build → dist/
npm run preview  # preview the production build locally
```
