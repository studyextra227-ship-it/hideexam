# 🌊 The Abyss Archive

A dark, atmospheric **secure PDF vault** with a hidden access system. Built with React + Vite, powered by Supabase Edge Functions, and deployed on Netlify.

**Live Site:** [https://hideexam.netlify.app](https://hideexam.netlify.app)

---

## ✨ Features

- 🌊 **Deep-sea aesthetic** — dark cosmic theme with floating particle animations
- 🔒 **Dynamic Two-Step Verification** — Secure Admin Login system and PIN-reset mechanisms using email OTPs (Powered by Resend).
- 🔐 **Dual PIN access system** — Regular Vault + Hidden Admin Panel
- 📁 **Multi-file upload** — drag & drop or click to browse, up to 50MB per file
- ⬇️ **Secure downloads** — signed URLs via Supabase service role
- ✏️ **Rename files** — admin-only inline rename with instant save
- 🗑️ **Delete files** — admin-only with confirmation prompt
- 🔑 **PIN Management** — Admin can dynamically change their own PIN or User PIN directly from the secure online panel.
- 📱 **Responsive** — works on mobile and desktop

---

## 🔑 Access System

| Security Level | Mode | Verification Mechanism | Permissions |
|---|---|---|---|
| **User PIN** | **Vault** | Direct PIN Match | Upload + Download |
| **Admin PIN** | **Admin Panel** 🔴 | PIN Match + **Email OTP** Verification | Upload + Download + Rename + Delete + **Change PINs** |
| **Forgot PIN** | **Recovery** | Email OTP Verification | Reset User PIN |

**How to open the vault:**
- Click the **jellyfish sigil** (bottom-right corner) — subtle, nearly invisible
- Or press **`Ctrl + Shift + V`** on your keyboard (or use the 10-click counter trigger).

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + Framer Motion |
| Backend | Supabase Edge Functions (Deno) |
| Identity & Email| Supabase OTP Table (`otp_codes`) + Resend API |
| Storage | Supabase Storage (`pdfs` bucket) |
| Hosting | Netlify |

---

## 📁 Project Structure

```
abyss-vault-keeper/
├── src/
│   ├── components/
│   │   ├── VaultModal.tsx         # PIN entry + File Manager + Admin Panel + OTP verification
│   │   └── ...
│   └── ...
├── supabase/
│   ├── functions/
│   │   ├── send-otp/              # OTP Generation & Email dispatch via Resend API
│   │   ├── verify-otp/            # OTP Verification & validation
│   │   ├── grant-otp-session/     # Grants short-lived OTP Sessions
│   │   ├── manage-pin/            # Secure handling for changing Admin/User PINs
│   │   ├── verify-pin/            # PIN verification logic (Checks DB & triggers OTP)
│   │   ├── vault-files/           # List files from storage
│   │   ├── vault-upload/          # Upload PDF to storage
│   │   ├── vault-download/        # Generate signed download URL
│   │   ├── vault-delete/          # Delete file (admin PIN required)
│   │   └── vault-rename/          # Rename file (admin PIN required)
│   └── migrations/                # SQL migrations for DB tables (`otp_codes` for dynamic PINs)
└── README.md
```

---

## 🚀 Environment Variables & Secrets

Make sure to set the following as Supabase Edge Function Secrets:

```bash
npx supabase secrets set VAULT_PIN=your_default_vault_pin
npx supabase secrets set ADMIN_PIN=your_default_admin_pin
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
npx supabase secrets set ADMIN_EMAIL=your_email_for_otp_delivery
npx supabase secrets set RESEND_API_KEY=your_resend_api_key
```

And in the local React app (`.env`):
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here
```

---

## Deployment

All Edge Functions must be deployed to Supabase:
```bash
npx supabase functions deploy send-otp
npx supabase functions deploy verify-otp
npx supabase functions deploy grant-otp-session
npx supabase functions deploy manage-pin
npx supabase functions deploy verify-pin
# ...and the rest of the vault-* functions
```

Frontend deployed via Netlify:
```bash
npm run build
netlify deploy --prod --dir=dist
```

---

## 🔒 Post-deploy Database Security
Instead of hardcoding PINs permanently, the system leverages a Row Level Security (RLS)-protected database table `otp_codes` (accessible only by the backend service-role) to store dynamic hashed representation of active PINs. The env vars `VAULT_PIN` and `ADMIN_PIN` function only as the initial fallback.
