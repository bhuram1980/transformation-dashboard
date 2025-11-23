# 🔐 Admin Login Setup

Your dashboard is now **publicly accessible** in read-only mode, with admin login for full access.

## Quick Setup

### Step 1: Set Admin Credentials in Vercel

Go to your Vercel project settings:
**https://vercel.com/bhuram1980s-projects/transformation-dashboard/settings/environment-variables**

Add these environment variables:

1. **ADMIN_USERNAME**
   - Value: `x/headlesstale` (or your preferred admin username)
   - Select: Production, Preview, Development
   - This is the username required for admin login

2. **ADMIN_PASSWORD**
   - Value: `your-secure-admin-password-here`
   - Select: Production, Preview, Development
   - This is the password required for admin login

3. **FLASK_SECRET_KEY** (Optional but Recommended)
   - Value: Generate a random string (e.g., `openssl rand -hex 32`)
   - Select: Production, Preview, Development
   - Used to encrypt sessions

### Step 2: Redeploy

After adding environment variables, redeploy:

```bash
vercel --prod
```

Or push to GitHub (auto-deploys):
```bash
git commit --allow-empty -m "Update admin login"
git push
```

---

## How It Works

### 👁️ Public Access (No Login Required)
- ✅ **Anyone can view** the dashboard
- ✅ See all charts, data, and stats
- ✅ View progress photos
- ❌ **Cannot** upload photos
- ❌ **Cannot** get Grok AI advice
- ❌ **Cannot** access admin features

### 👑 Admin Access (Login Required)
- ✅ Everything public users can do
- ✅ **Upload progress photos**
- ✅ **Get Grok AI advice**
- ✅ **Full access** to all features

---

## Login Process

1. **Visit Dashboard**: Anyone can access `/` without login (public viewer mode)
2. **Admin Login**: Click "Admin Login" button in header
3. **Enter Credentials**:
   - Username: `x/headlesstale` (or your ADMIN_USERNAME)
   - Password: Your ADMIN_PASSWORD
4. **Full Access**: After login, you'll have admin privileges

---

## Local Development

For local testing, set environment variables:

```bash
export ADMIN_USERNAME="x/headlesstale"
export ADMIN_PASSWORD="your-admin-password"
export FLASK_SECRET_KEY="your-secret-key-here"
python3 app.py
```

Or add to `~/.zshrc`:
```bash
echo 'export ADMIN_USERNAME="x/headlesstale"' >> ~/.zshrc
echo 'export ADMIN_PASSWORD="your-admin-password"' >> ~/.zshrc
echo 'export FLASK_SECRET_KEY="your-secret-key-here"' >> ~/.zshrc
source ~/.zshrc
```

---

## Security Notes

- ⚠️ **Never commit credentials to Git** - Use environment variables only
- ✅ Credentials are stored securely in Vercel (encrypted)
- ✅ Sessions are encrypted with `FLASK_SECRET_KEY`
- ✅ Sessions expire after 24 hours
- ✅ Logout clears session immediately
- ✅ Public access is read-only (safe to share dashboard URL)

---

## Troubleshooting

### "Invalid username or password"
- Check `ADMIN_USERNAME` matches exactly (case-sensitive)
- Check `ADMIN_PASSWORD` is correct
- Verify environment variables are set in Vercel
- Make sure you redeployed after adding variables

### "Admin access required"
- You're viewing as public (no login)
- Click "Admin Login" and enter credentials
- Make sure username matches `ADMIN_USERNAME` exactly

### "Session expired"
- Sessions last 24 hours
- Just login again
- Or logout/login to refresh session

### "No admin password set - allowing any login"
- This means `ADMIN_PASSWORD` is not set
- In development, this allows any login as admin
- **For production, always set ADMIN_PASSWORD!**

---

## Password Best Practices

1. **Use strong password:**
   - At least 12 characters
   - Mix of letters, numbers, symbols
   - Don't reuse passwords from other services

2. **Keep username simple:**
   - `x/headlesstale` is fine
   - Or use your GitHub username
   - Make it something you'll remember

3. **Rotate regularly:**
   - Change password every 3-6 months
   - Update in Vercel environment variables
   - Redeploy after changing

---

## Example Setup

**Vercel Environment Variables:**
```
ADMIN_USERNAME = x/headlesstale
ADMIN_PASSWORD = MySecurePass123!@#
FLASK_SECRET_KEY = a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

**Login:**
- Username: `x/headlesstale`
- Password: `MySecurePass123!@#`

---

## Need Help?

1. Check Vercel logs: https://vercel.com/bhuram1980s-projects/transformation-dashboard/logs
2. Verify environment variables are set
3. Check browser console (F12) for errors
4. Try logging out and back in

