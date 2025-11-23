# 🔐 Password Protection Setup

Your dashboard is now password-protected with two access levels!

## Quick Setup

### Step 1: Set Passwords in Vercel

Go to your Vercel project settings:
**https://vercel.com/bhuram1980s-projects/transformation-dashboard/settings/environment-variables**

Add these two environment variables:

1. **VIEWER_PASSWORD**
   - Value: `your-viewer-password-here`
   - Select: Production, Preview, Development
   - This password allows read-only access (view data, charts, stats)

2. **ADMIN_PASSWORD**
   - Value: `your-admin-password-here`
   - Select: Production, Preview, Development
   - This password allows full access (everything + upload photos + Grok advice)

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
git commit --allow-empty -m "Add password protection"
git push
```

---

## Access Levels

### 👁️ Viewer Access
**What they can do:**
- ✅ View dashboard
- ✅ See all charts and data
- ✅ View 7-day averages
- ✅ See recent days table
- ✅ View progress photos (if uploaded)

**What they CANNOT do:**
- ❌ Upload photos
- ❌ Get Grok AI advice
- ❌ Access admin features

### 👑 Admin Access
**What they can do:**
- ✅ Everything viewers can do
- ✅ Upload progress photos
- ✅ Get Grok AI advice
- ✅ Full access to all features

---

## How It Works

1. **First Visit**: Users are redirected to `/login`
2. **Login**: Enter password (viewer or admin)
3. **Session**: Valid for 24 hours (or until logout)
4. **Protection**: All routes require login
5. **Role Check**: Admin-only features check role before allowing access

---

## Local Development

For local testing, set environment variables:

```bash
export VIEWER_PASSWORD="viewer123"
export ADMIN_PASSWORD="admin123"
export FLASK_SECRET_KEY="your-secret-key-here"
python3 app.py
```

Or add to `~/.zshrc`:
```bash
echo 'export VIEWER_PASSWORD="viewer123"' >> ~/.zshrc
echo 'export ADMIN_PASSWORD="admin123"' >> ~/.zshrc
echo 'export FLASK_SECRET_KEY="your-secret-key-here"' >> ~/.zshrc
source ~/.zshrc
```

---

## Security Notes

- ⚠️ **Never commit passwords to Git** - Use environment variables only
- ✅ Passwords are stored securely in Vercel (encrypted)
- ✅ Sessions are encrypted with `FLASK_SECRET_KEY`
- ✅ Sessions expire after 24 hours
- ✅ Logout clears session immediately

---

## Troubleshooting

### "No passwords set - allowing access"
- This means neither `VIEWER_PASSWORD` nor `ADMIN_PASSWORD` is set
- In development, this allows access without login
- **For production, always set passwords!**

### "Invalid password"
- Check password is correct (case-sensitive)
- Verify environment variables are set in Vercel
- Make sure you redeployed after adding variables

### "Admin access required"
- You're logged in as viewer
- Logout and login with admin password
- Or use admin password to get full access

### "Session expired"
- Sessions last 24 hours
- Just login again
- Or logout/login to refresh session

---

## Password Best Practices

1. **Use strong passwords:**
   - Viewer: At least 8 characters
   - Admin: At least 12 characters, mix of letters, numbers, symbols

2. **Different passwords:**
   - Don't use the same password for viewer and admin
   - Don't reuse passwords from other services

3. **Share carefully:**
   - Only share viewer password with people you trust
   - Never share admin password

4. **Rotate regularly:**
   - Change passwords every 3-6 months
   - Update in Vercel environment variables
   - Redeploy after changing

---

## Example Passwords

**Good:**
- Viewer: `Transform2024!`
- Admin: `Admin#Secure2024!`

**Bad:**
- `password` (too weak)
- `123456` (too weak)
- Same for both (security risk)

---

## Need Help?

1. Check Vercel logs: https://vercel.com/bhuram1980s-projects/transformation-dashboard/logs
2. Verify environment variables are set
3. Check browser console (F12) for errors
4. Try logging out and back in

