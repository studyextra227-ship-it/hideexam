# Production Deployment Guide

## Abyss Vault Keeper - Ready for Production

This application is now fully production-ready with optimizations for performance, security, and reliability.

## Pre-Deployment Checklist

### 1. Environment Configuration
- [ ] Copy `.env.example` to `.env.production`
- [ ] Update Supabase credentials for production environment
- [ ] Verify all API endpoints are configured for production
- [ ] Ensure sensitive keys are NOT committed to version control

### 2. Testing
```bash
# Run linting
npm run lint

# Run tests
npm run test

# Preview production build locally
npm run build
npm run preview
```

### 3. Build Optimization
```bash
# Create optimized production build
npm run build
```

**Build Output:**
- Minified and compressed JavaScript
- Code split into vendor bundles for optimal caching
- Terser compression with console/debugger statements removed
- No source maps in production for security

## Deployment Platforms

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```
- Auto-detects Vite configuration
- Zero-config deployment
- Automatic HTTPS and CDN

### Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

### GitHub Pages
1. Update `vite.config.ts` with `base: '/repo-name/'`
2. Add deployment workflow in `.github/workflows/deploy.yml`

### Self-Hosted
1. Build: `npm run build`
2. Deploy `dist/` folder to your server
3. Configure web server for single-page application (SPA) routing

## Security Considerations

✅ **Implemented:**
- Error boundary for graceful error handling
- Environment variables for sensitive data
- CORS-safe Supabase client
- Safe localStorage usage for auth persistence

📋 **Additional Recommendations:**
- Enable HTTPS only (redirect HTTP to HTTPS)
- Set security headers (CSP, X-Frame-Options, etc.)
- Implement rate limiting on API endpoints
- Regular security audits of dependencies
- Monitor for console errors in production

## Performance Optimization

### What's Included:
- ✅ Code splitting (React, Framer Motion, Radix UI bundles)
- ✅ Terser minification with compression
- ✅ Asset optimization
- ✅ Mobile-optimized rendering (reduced particles on mobile)
- ✅ Lazy loading of components

### CDN Strategy:
- Vendor bundles cached long-term (versioned)
- App code cached short-term (frequently updated)
- Static assets cached permanently

## Monitoring & Analytics

### Recommended Services:
- **Error Tracking:** Sentry, LogRocket, or Rollbar
- **Performance:** Google Analytics, Core Web Vitals monitoring
- **Uptime:** Pingdom, StatusPageIO, or UptimeRobot

### Implementation Example (Sentry):
```typescript
// In main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
});
```

## Environment Variables

### Production `.env.production`:
```env
VITE_SUPABASE_URL=https://your-production-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-production-key
VITE_SUPABASE_PROJECT_ID=your-production-id
```

## Maintenance

### Regular Tasks:
- [ ] Monitor error logs daily
- [ ] Update dependencies monthly
- [ ] Audit security vulnerabilities: `npm audit`
- [ ] Review performance metrics
- [ ] Backup database regularly

### Update Dependencies:
```bash
npm outdated              # Check for updates
npm update               # Safe updates (minor/patch)
npm install [package]@latest  # Major version updates
npm audit fix            # Fix known vulnerabilities
```

## CI/CD Pipeline Example (GitHub Actions)

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
      
      - name: Deploy to Vercel
        run: vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
```

## Rollback Plan

If deployment fails:
1. Automatic rollback on push to `main` (if using Vercel/Netlify)
2. Manual rollback: `vercel rollback`
3. Revert commit: `git revert HEAD`

## Post-Deployment Verification

✅ Verify in production:
1. Homepage loads without errors
2. Vault modal opens (Ctrl+Shift+D)
3. PIN entry accepts numeric input
4. Mobile responsiveness works on various devices
5. No console errors in DevTools
6. Performance metrics are acceptable

## Support & Troubleshooting

### Build Fails
```bash
rm -rf node_modules dist
npm ci
npm run build
```

### Deployment Issues
- Check build logs in deployment platform dashboard
- Verify environment variables are set
- Check for JavaScript errors: `npm run lint`
- Review bundled size: `npm run build -- --analyze`

## Performance Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint (FCP) | < 1.5s |
| Largest Contentful Paint (LCP) | < 2.5s |
| Cumulative Layout Shift (CLS) | < 0.1 |
| Time to Interactive (TTI) | < 3.5s |

---

**Status:** ✅ Production Ready
**Last Updated:** February 23, 2026
**Version:** 1.0.0
