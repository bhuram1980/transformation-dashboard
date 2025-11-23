# 📸 Vercel Blob Setup for Photo Uploads

## Quick Setup (2 minutes)

### Step 1: Install Vercel Blob
```bash
npm install @vercel/blob
```

Or add to your project (if using npm):
```json
{
  "dependencies": {
    "@vercel/blob": "^0.19.0"
  }
}
```

### Step 2: Get Blob Token
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Your Project → Settings → Environment Variables
3. Add: `BLOB_READ_WRITE_TOKEN`
4. Get token from: [Vercel Blob Dashboard](https://vercel.com/dashboard/stores)

### Step 3: Update Python Code (Optional)
The app already has fallback to local storage, but for production with Vercel Blob:

```python
# Install Python client (if needed)
pip install vercel-blob
```

### Step 4: Deploy
Push to GitHub and Vercel auto-deploys!

---

## How It Works

- **Development**: Photos save to `static/uploads/` folder
- **Production**: Photos upload to Vercel Blob (if token is set)
- **Fallback**: If Blob token not set, uses local storage

---

## Features

✅ Upload fish plate photos  
✅ Upload mirror selfies  
✅ Photo gallery view  
✅ Click to view full size  
✅ Mobile-friendly camera capture

---

## Notes

- Photos are stored publicly (for easy sharing)
- Maximum file size: 4.5MB (Vercel Blob limit)
- Supported formats: JPG, PNG, GIF, WebP

