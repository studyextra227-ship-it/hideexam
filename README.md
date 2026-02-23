# Abyss Vault Keeper

A secure, production-ready vault application for managing and storing sensitive PDF files with PIN protection and deep-sea themed UI.

## 🎯 Features

- ✅ **Secure Vault** - PIN-protected file storage with Supabase backend
- ✅ **PDF Management** - Upload, download, and delete files securely
- ✅ **Mobile Responsive** - Full mobile optimization with touch-friendly UI
- ✅ **Deep-Sea Theme** - Immersive Abyss-inspired design with particle effects
- ✅ **Production Ready** - 190KB gzipped, optimized builds, error boundaries
- ✅ **Accessible** - WCAG compliant, keyboard navigation, screen reader support

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ & npm
- Supabase account (for backend)

### Local Development

```bash
# Clone the repository
git clone https://github.com/studyextra227-ship-it/abyss-vault-keeper.git
cd abyss-vault-keeper

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
npm run dev
```

The app will open at http://localhost:8080/

### Building for Production

```bash
# Create optimized production build
npm run build

# Preview production build locally
npm run preview

# Run linting
npm run lint

# Run tests
npm run test
```

## 📖 How to Use The Vault

### Opening the Vault
1. **Keyboard**: Press `Ctrl + Shift + D`
2. **Click**: Tap the jellyfish icon in the bottom-right corner

### Entering the Vault
1. Enter your 4-digit PIN code
2. Each field auto-focuses to the next digit
3. After all 4 digits, it auto-verifies

### Managing Files
- **Upload**: Click "Upload PDF" button to add files
- **Download**: Click the download icon on any file
- **Delete**: Click the trash icon to remove files

## 🌐 Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

### Any Web Server
```bash
npm run build
# Deploy the dist/ folder to your server
```

See [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) for detailed deployment guides.

## 📚 Documentation

- **[PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)** - Deployment guide for all platforms
- **[PRODUCTION_READY.md](./PRODUCTION_READY.md)** - Production readiness checklist
- **[PRODUCTION_SUMMARY.md](./PRODUCTION_SUMMARY.md)** - Summary of changes and improvements
- **[GITHUB_SETUP.md](./GITHUB_SETUP.md)** - GitHub setup instructions

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Animations**: Framer Motion
- **Build**: Vite
- **Backend**: Supabase (PostgreSQL + Authentication)
- **Testing**: Vitest + jsdom
- **Linting**: ESLint + TypeScript ESLint

## 📦 Build Info

- **Bundle Size**: 190KB (gzipped)
- **Build Time**: ~10s
- **Code Split**: 6 optimized chunks (React, Framer, Radix, Supabase, App, CSS)
- **Performance**: Mobile-optimized, reduced particle rendering

## 🚨 Environment Setup

Create a `.env` file from `.env.example`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

Never commit `.env` - it contains sensitive data.

## 🧪 Testing

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# With coverage
npm run test -- --coverage
```

## 🔐 Security Features

- 🔒 PIN-protected vault
- 🔐 Supabase role-based access control
- ✅ File type validation (PDF only)
- 📏 File size limits (50MB max)
- 🛡️ Error boundary for graceful failures
- 📝 Comprehensive error logging
- 🌐 HTTPS-only recommended

## 🐛 Troubleshooting

### Build Fails
```bash
rm -rf node_modules dist
npm install
npm run build
```

### Port Already in Use
```bash
npm run dev -- --port 3000
```

### Environment Variables Not Loaded
- Restart dev server after changing `.env`
- Verify no spaces in `.env` file
- Check `.env` is in root directory

## 📊 Project Structure

```
abyss-vault-keeper/
├── src/
│   ├── components/          # React components
│   │   ├── VaultModal.tsx  # Main vault interface
│   │   └── ErrorBoundary.tsx
│   ├── pages/              # Page components
│   ├── hooks/              # Custom hooks
│   ├── integrations/       # Supabase setup
│   └── test/               # Tests
├── dist/                   # Production build (generated)
├── public/                 # Static assets
├── supabase/              # Supabase config & functions
└── [config files]         # vite, tailwind, ts, etc.
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is provided as-is for educational and personal use.

## 🆘 Support

- **Issues**: Create a GitHub issue for bugs or features
- **Documentation**: See docs in the [/docs](./docs) folder
- **Discussions**: Use GitHub Discussions for questions

---

**Status**: ✅ Production Ready | **Version**: 1.0.0 | **Last Updated**: Feb 23, 2026
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

You can deploy this project to various platforms like Vercel, Netlify, GitHub Pages, or any other hosting service that supports Node.js/static sites. Follow the deployment instructions for your chosen platform.
