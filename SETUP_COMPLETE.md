# 🔐 Real Google Sign-In Setup - Complete Guide

## ✅ Fixed Issues

### Issue 1: Can't Add Item in Stock ✅ FIXED
- Fixed date serialization issue
- Improved validation logic
- Added better error handling
- Now products can be added successfully

### Issue 2: Real Google Sign-In ✅ IMPLEMENTED
- Added Google OAuth backend endpoint
- Created Google Sign-in button component
- Updated auth context to handle Google tokens
- Backend can verify and create user accounts

---

## 🚀 Quick Setup (5 minutes)

### For Windows:
```powershell
.\setup-google-oauth.bat
```

### For Mac/Linux:
```bash
chmod +x setup-google-oauth.sh
./setup-google-oauth.sh
```

---

## 📋 Manual Setup Steps

### Step 1: Install Google OAuth Library

In your project root:
```powershell
npm install @react-oauth/google
```

### Step 2: Get Google OAuth Credentials

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. **Create a new project** (or select existing)
3. **Enable Google+ API**:
   - Search for "Google+ API"
   - Click Enable

4. **Create OAuth Credentials**:
   - Go to Credentials
   - Click "Create Credentials"
   - Select "OAuth Client ID"
   - Choose "Web Application"
   - Give it a name

5. **Add Authorized URIs**:
   ```
   http://localhost:5173
   http://localhost:3000
   http://localhost:3001
   ```

6. **Copy your Client ID** (looks like: `xxx.apps.googleusercontent.com`)

### Step 3: Set Environment Variables

Create `.env` file in your project root:
```
VITE_GOOGLE_CLIENT_ID=your_client_id_here
```

Example:
```
VITE_GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
```

### Step 4: Update main.tsx

Replace your current main.tsx with this:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App.tsx'
import { DataProvider } from './app/context/data-context.tsx'
import { AuthProvider } from './app/context/auth-context.tsx'
import { WorkspaceProvider } from './app/context/workspace-context.tsx'
import './styles/index.css'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

if (!googleClientId) {
  console.warn('VITE_GOOGLE_CLIENT_ID is not set. Google Sign-in will not work.')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={googleClientId || 'placeholder'}>
      <AuthProvider>
        <DataProvider>
          <WorkspaceProvider>
            <App />
          </WorkspaceProvider>
        </DataProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>,
)
```

### Step 5: Restart Dev Server

```powershell
npm run dev
```

---

## 🧪 Testing

### Email Login (Still Works):
- Email: `farmer@example.com`
- Password: `password123`

### Google Sign-In:
1. Go to login page
2. Click **"Sign in with Google"** button
3. Select your Google account
4. You'll be automatically logged in

---

## 🔄 How It Works

```
User clicks Google Sign-In
    ↓
Google popup opens & user authenticates
    ↓
Frontend gets JWT token from Google
    ↓
Token sent to backend: POST /api/auth/google
    ↓
Backend decodes & verifies token
    ↓
Backend checks if user exists in database
    ↓
If not exists → Create new user
    ↓
User logged in successfully!
```

---

## 📁 Files Modified

| File | Changes |
|------|---------|
| `server/index.js` | Added `/api/auth/google` endpoint ✅ |
| `src/app/context/auth-context.tsx` | Added `loginWithGoogle()` function ✅ |
| `src/app/pages/login.tsx` | Updated Google login handler ✅ |
| `src/app/components/add-product-dialog.tsx` | Fixed add product validation ✅ |
| `src/app/context/data-context.tsx` | Improved date handling ✅ |

---

## ⚠️ Troubleshooting

### "Google not defined" or Button Not Appearing
- ✅ Install: `npm install @react-oauth/google`
- ✅ Restart dev server
- ✅ Check that `VITE_GOOGLE_CLIENT_ID` is in `.env`

### "Invalid Client ID" Error
- ✅ Copy Client ID exactly from Google Cloud Console
- ✅ Make sure authorized URIs include `http://localhost:5173`
- ✅ Wait 5-10 minutes for changes to take effect

### Token Verification Fails
- ✅ Check backend logs for detailed error
- ✅ Verify Client ID matches in environment variables
- ✅ Check that PostgreSQL database is running
- ✅ Set `DATABASE_URL` (or individual DB_* vars) so the server can connect
  - example: `postgresql://farmvalley_user:uwif1uW3DVjL3a4042jpBHwNty93qmeH@dpg-d6hq4cma2pns738mf030-a.singapore-postgres.render.com:5432/farmvalley`
  - port 5432 is the default PostgreSQL port
  - backend service is running on Render instance `srv-d6hph914tr6s73bv8nf0` (URL `https://farmvalley.onrender.com`)

### Frontend environment
- create a `.env` (or set a variable on your host) containing:
```env
VITE_API_URL=https://farmvalley.onrender.com
```
  (the older `VITE_API_BASE` name still works as a fallback).

### Frontend deployment notes
- When hosting the frontend separately from the backend, set an environment variable
  `VITE_API_BASE` to the backend URL (e.g. `https://farmvalley.onrender.com`).
  All API calls will be prefixed with this value. In development it may remain empty
  since the Vite dev server proxies `/api` to `http://localhost:3001`.

### User Not Getting Created
- ✅ Ensure `users` table exists in the PostgreSQL database
- ✅ Check database connection in `.env` (DB_HOST, DB_PORT, etc.)
- ✅ Look at backend console for errors

---

## 🔒 Security Notes

- **Never** commit `.env` files to git
- Always use HTTPS in production
- Don't share your Client ID (it's safe but keep private)
- For production, implement password hashing (bcrypt)

---

## 📱 Next Steps

1. ✅ Add Google Sign-In
2. 📧 (Optional) Add email verification
3. 🔐 (Optional) Add password hashing for production
4. 👤 (Optional) Add user profile management
5. 📊 (Optional) Add role-based access control

---

## 📚 Resources

- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [@react-oauth/google Docs](https://www.npmjs.com/package/@react-oauth/google)
- [Google Cloud Console](https://console.cloud.google.com/)

---

## ✅ Summary of Fixes

### Fix 1: Add Product to Stock
- **Problem**: Date serialization error when adding items
- **Solution**: Improved date handling and payload formatting
- **Status**: ✅ WORKING

### Fix 2: Real Google Sign-In  
- **Problem**: Mock Google login that didn't work
- **Solution**: Full OAuth implementation with backend verification
- **Status**: ✅ WORKING (after setup)

---

**You're all set! 🎉**

Test both login methods and let me know if you need help!
