# Deployment Guide

## Cloudflare Pages

This project has **zero dependencies** and **no build step** - it's pure static HTML/CSS/JS that runs directly in the browser.

### Configuration

When deploying to Cloudflare Pages:

```
Build command:        (leave empty)
Build output directory: src
Root directory:       (leave as default: /)
```

**Why no build command?**  
The project uses vanilla JavaScript modules with no compilation, transpilation, or bundling. Everything runs natively in modern browsers.

### Deploy Methods

#### 1. Git Integration (Recommended)

1. Push your code to GitHub/GitLab
2. Go to Cloudflare Pages dashboard
3. Click "Create a project"
4. Connect your repository
5. Configure:
   - **Framework preset:** None
   - **Build command:** (leave empty)
   - **Build output directory:** `src`
6. Click "Save and Deploy"

#### 2. Direct Upload (Wrangler CLI)

```bash
# Install Wrangler globally (one-time)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
wrangler pages deploy src --project-name=vlm-runtime
```

#### 3. Drag & Drop

1. Go to Cloudflare Pages dashboard
2. Click "Create a project" → "Direct Upload"
3. Drag the `src/` folder
4. Done!

### Environment Variables

None required! The app runs entirely client-side.

### Headers Configuration (Optional)

For better security and performance, add these headers in Cloudflare Pages settings:

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), microphone=()
  Cross-Origin-Embedder-Policy: credentialless
  Cross-Origin-Opener-Policy: same-origin
```

Or create `src/_headers`:

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), microphone=()
```

### Browser Requirements

The deployed app requires:
- **WebGPU support** (Chrome/Edge 113+, Firefox Nightly with flag)
- **Modern ES6 modules** (all browsers since 2017)
- **Camera access** (HTTPS required in production)

Cloudflare Pages automatically serves over HTTPS, so camera permissions will work.

### Performance Optimization

Cloudflare Pages automatically provides:
- ✅ Global CDN
- ✅ HTTP/2 and HTTP/3
- ✅ Brotli compression
- ✅ Automatic minification (HTML/CSS/JS)

**No manual optimization needed!**

### Size Considerations

**What gets deployed:**
- HTML: ~5 KB
- CSS: ~15 KB
- JavaScript: ~50 KB
- **Total:** ~70 KB

**What DOESN'T get deployed:**
- AI models (loaded from Hugging Face CDN at runtime)
- Node modules (not needed - zero dependencies!)
- Tests (excluded via `.cfignore`)

The models (~500 MB) are fetched on-demand from Hugging Face's CDN when users load the app.

### Domains

Cloudflare Pages gives you:
- Free subdomain: `https://vlm-runtime.pages.dev`
- Custom domain support: Link your own domain in settings

### Troubleshooting

#### Camera not working

**Cause:** Not served over HTTPS  
**Solution:** Cloudflare Pages uses HTTPS by default - no action needed

#### Blank page after deployment

**Possible causes:**
1. Wrong build output directory
   - ✅ Should be: `src`
   - ❌ Not: `/` or `dist`

2. Module paths incorrect
   - Check browser console for 404 errors
   - Verify all imports use relative paths (`./` or `../`)

#### WebGPU not available

This is user-specific, not deployment-related. Show fallback message for unsupported browsers.

### Monitoring

View deployment status:
- **Cloudflare Dashboard** → Pages → Your Project
- **Analytics:** Built-in Web Analytics (free)

### Rollbacks

Cloudflare keeps all previous deployments:
1. Go to project → Deployments
2. Click "..." on any previous deployment
3. Click "Rollback to this deployment"

### Cost

**Free tier includes:**
- Unlimited bandwidth
- Unlimited requests
- 500 builds/month
- 1 build at a time

Perfect for this project since there are no builds anyway!

---

## Alternative Platforms

### Vercel

```
Build command:        (leave empty)
Output directory:     src
```

Deploy: `vercel --prod src`

### Netlify

```
Build command:        (leave empty)
Publish directory:    src
```

Or use `netlify deploy --prod --dir=src`

### GitHub Pages

```bash
# Push src/ to gh-pages branch
git subtree push --prefix src origin gh-pages
```

Enable GitHub Pages in repo settings → Pages → Source: gh-pages branch

### Static File Hosting (Any Provider)

Just upload the `src/` folder contents to any web host. Requirements:
- ✅ HTTPS (for camera access)
- ✅ Supports ES6 modules (default MIME types)

---

## Post-Deployment Checklist

After deploying, verify:

1. **Homepage loads** - No 404 errors
2. **Camera permission prompt** - Click Allow
3. **WebGPU detection** - Welcome screen shows GPU info
4. **Model loads** - Progress bar reaches 100%
5. **Live captioning works** - Point camera and see descriptions
6. **Diagnostics panel** - Press `Ctrl+Shift+D` to verify metrics

---

## Development vs Production

| Feature | Development | Production |
|---------|-------------|------------|
| Server | Python http.server | Cloudflare CDN |
| HTTPS | No | Yes (automatic) |
| Compression | No | Yes (Brotli) |
| Caching | No | Yes (aggressive) |
| Analytics | No | Optional (free) |
| Custom domain | localhost | Your domain |

**Note:** The app code is identical - no build transformations!

---

## Updating Deployment

With Git integration:
```bash
git add .
git commit -m "Update"
git push
```

Cloudflare automatically rebuilds (instantly, since there's no build step).

With Wrangler:
```bash
wrangler pages deploy src --project-name=vlm-runtime
```

---

## CI/CD (Optional)

Even with no build step, you can add CI for testing:

### GitHub Actions

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      # Optional: Run tests
      # - run: npm install
      # - run: npm test
      
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: vlm-runtime
          directory: src
```

But honestly, direct Git integration is simpler for this project.

---

## Security Notes

### What's Safe

- ✅ No backend = no server vulnerabilities
- ✅ No database = no SQL injection
- ✅ No API keys = no key leaks
- ✅ Camera feed stays local = privacy guaranteed

### Content Security Policy (Optional)

Add to `src/_headers`:

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://huggingface.co; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' https://huggingface.co; worker-src 'self' blob:;
```

Adjust based on actual CDN sources used by Transformers.js.

---

## Summary

**For Cloudflare Pages:**

1. Push code to GitHub
2. Connect repo in Cloudflare dashboard
3. Set build output to `src`
4. Deploy

**That's it.** No builds, no dependencies, no complexity.
