# Video Processor Service

FFmpeg-based video concatenation service for combining intro, demo, and outro videos.

## Features

- Concatenates 2-3 videos (intro + demo + optional outro)
- Server-side processing with FFmpeg
- Uploads results to Cloudinary
- Fast and reliable

## Deployment to Railway

### Option 1: Deploy from GitHub (Recommended)

1. **Push this code to GitHub:**
   ```bash
   cd video-processor
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Deploy on Railway:**
   - Go to https://railway.app
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway will auto-detect the Dockerfile and deploy

3. **Add Environment Variables:**
   In Railway project settings, add:
   - `CLOUDINARY_CLOUD_NAME` = `dnbh5lrvn`
   - `CLOUDINARY_API_KEY` = `352425854684683`
   - `CLOUDINARY_API_SECRET` = `ztUtf_qjnYj5kTHxxJZP5gJgFjo`

4. **Get Your URL:**
   Railway will give you a URL like: `https://your-app.railway.app`

### Option 2: Deploy Directly (No GitHub)

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway:**
   ```bash
   railway login
   ```

3. **Initialize and Deploy:**
   ```bash
   cd video-processor
   railway init
   railway up
   ```

4. **Add Environment Variables:**
   ```bash
   railway variables set CLOUDINARY_CLOUD_NAME=dnbh5lrvn
   railway variables set CLOUDINARY_API_KEY=352425854684683
   railway variables set CLOUDINARY_API_SECRET=ztUtf_qjnYj5kTHxxJZP5gJgFjo
   ```

5. **Get Your URL:**
   ```bash
   railway domain
   ```

## API Usage

### Health Check
```bash
GET https://your-app.railway.app/health
```

### Concatenate Videos
```bash
POST https://your-app.railway.app/concatenate
Content-Type: application/json

{
  "intro_url": "https://res.cloudinary.com/dnbh5lrvn/video/upload/v123/intro.mp4",
  "demo_url": "https://res.cloudinary.com/dnbh5lrvn/video/upload/v123/demo.mp4",
  "outro_url": "https://res.cloudinary.com/dnbh5lrvn/video/upload/v123/outro.mp4"
}
```

Response:
```json
{
  "success": true,
  "url": "https://res.cloudinary.com/dnbh5lrvn/video/upload/v123/combined-videos/combined_123.mp4",
  "public_id": "combined-videos/combined_123"
}
```

## Update Bolt App

After deploying to Railway, update your Bolt app's `handleCombine` function:

```javascript
// Change from:
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/combine-videos`,
  // ...
);

// To:
const response = await fetch(
  'https://your-app.railway.app/concatenate',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intro_url: introVideo.secureUrl,
      demo_url: demoVideo.secureUrl,
      outro_url: outroVideo?.secureUrl || null
    })
  }
);
```

## Cost

Railway: ~$5/month (hobby plan includes $5 free credit monthly)

## Testing Locally

```bash
cd video-processor
npm install
npm start
```

Then test:
```bash
curl -X POST http://localhost:3000/concatenate \
  -H "Content-Type: application/json" \
  -d '{
    "intro_url": "YOUR_INTRO_URL",
    "demo_url": "YOUR_DEMO_URL"
  }'
```

## Troubleshooting

- **FFmpeg not found:** Make sure Dockerfile builds correctly on Railway
- **Cloudinary upload fails:** Check environment variables are set correctly
- **Download fails:** Verify video URLs are publicly accessible
- **Out of memory:** Upgrade Railway plan if processing very large videos
