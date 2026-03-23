# Frontend & HTTP Security Guide

## Frontend Security (TypeScript/React)

### 1. Never Trust User Input
```typescript
// ❌ DANGEROUS - User can input malicious content
const ProductCard = ({ product }: { product: ProductType }) => {
    return (
        <div>
            <h2>{product.name}</h2>
            <p dangerouslySetInnerHTML={{ __html: product.description }} />
        </div>
    );
};

// ✅ SAFE - Content is escaped automatically
const ProductCard = ({ product }: { product: ProductType }) => {
    return (
        <div>
            <h2>{product.name}</h2>
            <p>{product.description}</p>  {/* Escaped by default in React */}
        </div>
    );
};
```

### 2. API Call Security
```typescript
// ✅ SAFE - Using typed API calls with data validation
interface AuthResponse {
    user: {
        id: string;
        email: string;
        role: 'admin' | 'farmer' | 'employee';
    };
}

async function loginUser(email: string, password: string): Promise<AuthResponse> {
    // 1. Validate input before sending
    if (!email || !password) {
        throw new Error('Email and password required');
    }
    
    if (!email.includes('@')) {
        throw new Error('Invalid email format');
    }

    // 2. Send to backend with HTTPS (always)
    const response = await fetch('https://api.yourdomain.com/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // ✅ CSRF Token (backend should validate)
            'X-CSRF-Token': getCsrfToken(),
        },
        credentials: 'include', // For secure cookies
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        throw new Error('Login failed');
    }

    // 3. Validate response structure
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !('user' in data)) {
        throw new Error('Invalid response format');
    }

    return data as AuthResponse;
}
```

### 3. Local Storage Security
```typescript
// ❌ DANGEROUS - Storing sensitive tokens in localStorage
localStorage.setItem('token', jwtToken); // Vulnerable to XSS!

// ✅ SAFE - Use HttpOnly cookies instead (server-side handling)
// Backend should send: Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict
// Frontend doesn't need to manage the token manually

// If you must store in localStorage, only store non-sensitive data:
localStorage.setItem('userPreferences', JSON.stringify({
    theme: 'dark',
    language: 'th'
}));
```

### 4. Form Input Validation
```typescript
// Example: Workspace name dialog (from your code)
const handleCreateWorkspace = (name: string) => {
    // ✅ VALIDATE INPUT
    const trimmed = name.trim();
    
    if (!trimmed) {
        toast.error('Workspace name is required');
        return;
    }
    
    if (trimmed.length < 2) {
        toast.error('Workspace name must be at least 2 characters');
        return;
    }
    
    if (trimmed.length > 100) {
        toast.error('Workspace name must be 100 characters or less');
        return;
    }

    // ✅ SEND TO BACKEND
    api.createWorkspace({ name: trimmed }).catch(err => {
        toast.error(err.message);
    });
};
```

## HTTP Security Headers

### Backend Configuration (Express.js)

```javascript
const express = require('express');
const app = express();

// ✅ Add security headers
app.use((req, res, next) => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Content Security Policy
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    );
    
    // CORS - Restrict to your domain
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://yourdomain.com');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    next();
});

// ✅ HTTPS enforcement
if (!process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            res.redirect(`https://${req.header('host')}${req.url}`);
        } else {
            next();
        }
    });
}

app.use(cors());
app.use(express.json());
```

## Cookie Security

### Secure Session Cookies
```javascript
// ✅ SECURE - Set session cookies with security flags
app.use((req, res, next) => {
    // After successful login:
    res.cookie('sessionId', generatedToken, {
        httpOnly: true,      // Not accessible from JavaScript (prevents XSS)
        secure: true,        // Only sent over HTTPS
        sameSite: 'strict',  // CSRF protection
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    next();
});
```

## CSRF (Cross-Site Request Forgery) Protection

### Generate CSRF Token
```javascript
// Backend - Generate unique token per session
const crypto = require('crypto');

function generateCsrfToken() {
    return crypto.randomBytes(32).toString('hex');
}

app.post('/api/csrf-token', (req, res) => {
    const token = generateCsrfToken();
    // Store in session: req.session.csrfToken = token;
    res.json({ csrfToken: token });
});

// Middleware - Verify CSRF token on state-changing requests
function verifyCsrfToken(req, res, next) {
    const token = req.headers['x-csrf-token'];
    // if (token !== req.session.csrfToken) {
    //     return res.status(403).json({ error: 'CSRF token invalid' });
    // }
    next();
}

app.post('/api/products', verifyCsrfToken, (req, res) => {
    // Handle request
});
```

### Frontend - Use CSRF Token
```typescript
// React hook for CSRF token
const getCsrfToken = async (): Promise<string> => {
    const response = await fetch('https://api.yourdomain.com/api/csrf-token');
    const data = await response.json();
    return data.csrfToken;
};

// Use in requests
const createProduct = async (product: ProductInput) => {
    const csrfToken = await getCsrfToken();
    
    const response = await fetch('https://api.yourdomain.com/api/products', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(product),
    });
    
    return response.json();
};
```

## XSS (Cross-Site Scripting) Prevention

### 1. Don't Use dangerouslySetInnerHTML
```typescript
// ❌ DANGEROUS
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// ✅ SAFE
<div>{userContent}</div>  {/* React escapes this automatically */}
```

### 2. Sanitize URLs
```typescript
// ❌ DANGEROUS
<img src={userProvidedUrl} />

// ✅ SAFE
<img src={sanitizeUrl(userProvidedUrl)} alt="Product" />

function sanitizeUrl(url: string): string {
    try {
        const parsed = new URL(url);
        // Only allow http, https, and mailto
        if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
            return '/placeholder.png';
        }
        return url;
    } catch {
        return '/placeholder.png';
    }
}
```

### 3. Content Security Policy
```html
<!-- In index.html -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline'; 
               img-src 'self' data: https:; 
               connect-src 'self' https://api.yourdomain.com">
```

## API Security Checklist for Frontend

- [ ] Always use HTTPS (never HTTP)
- [ ] Validate all server responses before using data
- [ ] Don't log sensitive data (tokens, passwords) to console in production
- [ ] Use TypeScript to catch type mismatches
- [ ] Never hardcode API credentials in code
- [ ] Use environment variables for API endpoints
- [ ] Implement request timeout (e.g., 30 seconds)
- [ ] Show generic error messages to users (don't leak backend details)
- [ ] Rate limit client-side actions (prevent rapid-fire requests)
- [ ] Clear sensitive data on logout

## Environment Variables (Frontend)

Create `.env` file:
```
VITE_API_URL=https://api.yourdomain.com
VITE_APP_NAME=ProjectValley
```

Access in code:
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Never do this:
// const API_URL = 'http://localhost:3001'; // Hardcoded!
```

## Common Security Mistakes to Avoid

| Mistake | Impact | Solution |
|---------|--------|----------|
| Storing JWT in localStorage | XSS vulnerability | Use HttpOnly cookies |
| No URL validation | User sent to malicious sites | Sanitize URLs |
| Large API responses | Memory/performance issues | Implement pagination |
| No request timeout | Hung requests | Set timeout: 30s |
| Logging sensitive data | Data leak in logs | Use `.gitignore` for .env |
| No input length limits | DoS, buffer overflow | Validate length |
| No API rate limiting | Brute force attacks | Implement rate limiting |
| CORS too permissive | CSRF attacks | Restrict to your domain |

## Recommended Libraries for Frontend Security

```json
{
  "dependencies": {
    "dompurify": "^3.0.0",
    "helmet": "^7.0.0"
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^6.0.0"
  }
}
```

Usage:
```typescript
import DOMPurify from 'dompurify';

// Safely render HTML
const cleanHtml = DOMPurify.sanitize(userProvidedHtml);
<div>{cleanHtml}</div>
```

## Testing Security Locally

### 1. Test HTTPS/SSL
```bash
# Install mkcert for local HTTPS
mkcert -install
mkcert localhost

# Run backend on HTTPS
NODE_ENV=production npm start
```

### 2. Test with curl
```bash
# Check security headers
curl -i https://localhost:3001/api/products

# Look for:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
```

## Production Deployment Checklist

- [ ] HTTPS enabled on all endpoints
- [ ] CORS restricted to frontend domain
- [ ] Security headers configured (X-Content-Type-Options, X-Frame-Options, etc.)
- [ ] CSRF token validation enabled
- [ ] Session timeout configured (e.g., 24 hours)
- [ ] Error messages don't leak sensitive info
- [ ] Database credentials in environment variables
- [ ] API rate limiting configured
- [ ] Logging configured (but not logging sensitive data)
- [ ] WAF (Web Application Firewall) configured (Cloudflare, AWS WAF, etc.)
- [ ] Regular security audits scheduled
- [ ] Incident response plan documented

---

**Key Principle**: Never trust any data from users or browser. Always validate, sanitize, and escape.
