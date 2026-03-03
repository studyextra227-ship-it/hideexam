# 🌊 The Abyss Archive

A dark, atmospheric **secure PDF vault** with a hidden access system. Built with React + Vite, powered by Supabase Edge Functions, and deployed on Netlify.

**Live Site:** [https://hideexam.netlify.app](https://hideexam.netlify.app)

---

## ✨ Features

- 🌊 **Deep-sea aesthetic** — dark cosmic theme with floating particle animations
- 🔒 **Dual PIN access system** — regular vault + hidden admin panel
- 📁 **Multi-file upload** — drag & drop or click to browse, up to 50MB per file
- ⬇️ **Secure downloads** — signed URLs via Supabase service role (no auth issues)
- ✏️ **Rename files** — admin-only inline rename with instant save
- 🗑️ **Delete files** — admin-only with confirmation prompt
- 📊 **Upload progress bars** — real-time per-file progress indicators
- 📱 **Responsive** — works on mobile and desktop

---

## 🔑 Access System

| PIN | Mode | Permissions |
|-----|------|-------------|
| `1510` | **Regular Vault** | Upload + Download |
| `1304` | **Admin Panel** 🔴 | Upload + Download + Rename + Delete |

**How to open the vault:**
- Click the **jellyfish sigil** (bottom-right corner) — subtle, nearly invisible
- Or press **`Ctrl + Shift + D`** on keyboard

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + Framer Motion |
| Backend | Supabase Edge Functions (Deno) |
| Storage | Supabase Storage (`pdfs` bucket) |
| Hosting | Netlify |

---

## 📁 Project Structure

```
abyss-vault-keeper/
├── src/
│   ├── App.tsx                    # Root app with routing
│   ├── main.tsx                   # Entry point
│   ├── index.css                  # Global styles
│   ├── pages/
│   │   ├── Index.tsx              # Main landing page
│   │   └── NotFound.tsx           # 404 page
│   ├── components/
│   │   ├── VaultModal.tsx         # PIN entry + file manager + admin panel
│   │   ├── ParticleField.tsx      # Canvas particle animation
│   │   ├── HiddenTrigger.tsx      # Invisible jellyfish vault button
│   │   └── ErrorBoundary.tsx      # Error handling wrapper
│   └── integrations/supabase/
│       ├── client.ts              # Supabase client
│       └── types.ts               # Database types
├── supabase/
│   ├── config.toml                # Supabase project config
│   ├── functions/
│   │   ├── verify-pin/            # PIN verification (returns isAdmin flag)
│   │   ├── vault-files/           # List files from storage
│   │   ├── vault-upload/          # Upload PDF to storage
│   │   ├── vault-download/        # Generate signed download URL
│   │   ├── vault-delete/          # Delete file (admin PIN required)
│   │   └── vault-rename/          # Rename file (admin PIN required)
│   └── migrations/                # SQL migrations for storage policies
├── public/
│   ├── favicon.svg
│   ├── robots.txt
│   └── _redirects                 # Netlify SPA routing
├── .env                           # Environment variables (never commit!)
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here
VITE_SUPABASE_PROJECT_ID=your-project-id
```

> ⚠️ Never commit `.env` — it's already in `.gitignore`

---

## 🚀 Supabase Edge Function Secrets

Set these in your Supabase project dashboard or via CLI:

```bash
npx supabase secrets set VAULT_PIN=1510
npx supabase secrets set ADMIN_PIN=1304
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## 🧑‍💻 Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

---

## 🌐 Deployment

### Deploy to Netlify

```bash
# Install Netlify CLI (one time)
npm install -g netlify-cli

# Login
netlify login

# Build + Deploy
npm run build
netlify deploy --prod --dir=dist
```

### Deploy Edge Functions to Supabase

```bash
# Deploy all functions
npx supabase functions deploy verify-pin --no-verify-jwt
npx supabase functions deploy vault-files --no-verify-jwt
npx supabase functions deploy vault-upload --no-verify-jwt
npx supabase functions deploy vault-download --no-verify-jwt
npx supabase functions deploy vault-delete --no-verify-jwt
npx supabase functions deploy vault-rename --no-verify-jwt
```

---

## 🔒 Security Notes

- All file operations go through **Supabase Edge Functions** — the service role key is never exposed to the browser
- Downloads use **signed URLs** (60-second expiry) generated server-side
- PIN verification happens server-side — not in client code
- The vault trigger is intentionally hidden — no visible button or link

---

## 📄 License

Private project. All rights reserved.
