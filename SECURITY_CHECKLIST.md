# Security Checklist & Quick Reference

## Pre-Deployment Security Checklist

### SQL Injection Protection
- [x] All database queries use parameterized queries (`$1, $2, $n`)
- [x] No string concatenation in SQL queries
- [x] No template literals with user variables in queries
- [x] Input validation catches invalid formats before database access
- [x] User IDs and parameters are type-cast before use
- [x] All authentication queries use parameter placeholders

### Input Validation
- [x] Email validation (format check)
- [x] Password requirements enforced
- [x] Numeric fields validated with `Number.isFinite()`
- [x] String fields trimmed and length-checked
- [x] Product IDs validated with regex: `^P\d{5}$`
- [x] Request types validated against whitelist: `['delete', 'decrease']`
- [x] Boolean fields properly coerced

### Authorization & Access Control
- [x] Workspace ownership verified before modifications
- [x] Admin-only endpoints check user role
- [x] Member permissions checked before data access
- [x] Transactions use `FOR UPDATE` locks to prevent race conditions

### HTTPS & Transport Security
- [ ] HTTPS enforced in production (Backend config needed)
- [ ] CORS properly configured for frontend domain
- [ ] Session cookies marked as Secure and HttpOnly

### Error Handling
- [x] Generic error messages (no SQL details leaked)
- [x] Try-catch blocks around all database operations
- [x] Rollback on transaction failure
- [ ] Error logging configured for monitoring

### Dependencies
- [x] `nodemailer` upgraded to 7.0.11 (vulnerability fixed)
- [ ] Run `npm audit` regularly
- [ ] Keep PostgreSQL driver (`pg`) updated

## Quick Response to Common Threats

### If someone tries SQL injection like: `' OR '1'='1`
**What happens**: User input is treated as a literal string value, not SQL code
```javascript
// Query:
'SELECT * FROM users WHERE email = $1 AND password = $2'
// Parameters:
[" ' OR '1'='1 ", "password"]
// Result: Searches for user with exact email "' OR '1'='1'" (not found)
```

### If someone tries DROP TABLE: `"; DROP TABLE users; --`
**What happens**: Parameter is treated as literal string value for WHERE clause
```javascript
// Query:
'DELETE FROM products WHERE workspace_id = $1'
// Parameters:
["; DROP TABLE users; --"]
// Result: Deletes products with workspace_id = "; DROP TABLE users; --" (probably none)
```

### If someone tries UNION injection: `1 UNION SELECT * FROM users`
**What happens**: Parameterized query only accepts the literal value, not additional SQL
```javascript
// Query:
'SELECT * FROM products WHERE id = $1'
// Parameters:
["1 UNION SELECT * FROM users"]
// Result: No product found (no injection possible)
```

## Secure Coding Examples for New Features

### Adding a New Endpoint (TEMPLATE)

```javascript
// ✅ SECURE PATTERN - Follow this for new endpoints

app.post('/api/resource/:id', async (req, res) => {
    try {
        // 1. Extract and validate input
        const resourceId = req.params.id;
        const userId = req.body.userId;
        const updateData = req.body.data;

        if (!resourceId || !userId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 2. Validate input types
        if (!Number.isFinite(Number(userId))) {
            return res.status(400).json({ error: 'Invalid userId format' });
        }

        // 3. Check authorization
        const authResult = await pool.query(
            'SELECT role FROM users WHERE id = $1',
            [String(userId)]
        );
        
        if (authResult.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        // 4. Use parameterized query with $1, $2, etc
        const result = await pool.query(
            'UPDATE resources SET name = $1, updated_by = $2 WHERE id = $3 AND owner_id = $4 RETURNING *',
            [updateData.name, userId, resourceId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Resource not found or access denied' });
        }

        // 5. Return safe response
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating resource:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
```

### DANGEROUS PATTERNS TO AVOID

```javascript
// ❌ DON'T: String concatenation with parameters
app.get('/api/users/:id', async (req, res) => {
    const result = await pool.query(
        `SELECT * FROM users WHERE id = ${req.params.id}`  // UNSAFE!
    );
});

// ❌ DON'T: Template literals with user data
app.post('/api/search', async (req, res) => {
    const { query } = req.body;
    const sql = `SELECT * FROM products WHERE name LIKE '%${query}%'`; // UNSAFE!
    const result = await pool.query(sql);
});

// ❌ DON'T: Dynamic column names without whitelisting
app.get('/api/products', async (req, res) => {
    const { sortBy } = req.query;
    const sql = `SELECT * FROM products ORDER BY ${sortBy}`; // UNSAFE!
    const result = await pool.query(sql);
});

// ❌ DON'T: No input validation
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    const result = await pool.query(
        'INSERT INTO users (email, password) VALUES ($1, $2)',
        [email, password] // Should validate email format and password strength first!
    );
});
```

## Database Connection Security

### Current Setup (GOOD)
```javascript
const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    max: 10,
    ssl: { rejectUnauthorized: false } // For Render.com
};
```

### For Production (BETTER)
```javascript
const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: {
        rejectUnauthorized: true, // Verify SSL certificates
        ca: process.env.DB_SSL_CA, // Use CA cert in production
    }
};
```

## Environment Variables (Recommended)

Create `.env` file (never commit to git):
```
DATABASE_URL=postgresql://user:password@host:5432/dbname
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
SMTP_HOST=smtp.provider.com
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=secure_password
SYSTEM_ADMIN_EMAILS=admin@example.com,support@example.com
```

Add to `.gitignore`:
```
.env
.env.local
.env.*.local
node_modules/
```

## Testing for Compliance

### Run SQL Injection Test Suite (LOCAL ONLY)
```bash
# These tests should all fail (meaning injection is blocked)
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"'\''OR'\''1'\''='\''1","password":"test"}'

# Should get: "Invalid email or password"
# NOT: A list of all users or database error
```

### Automated Scanning
```bash
# Check for known vulnerabilities
npm audit

# Should show: "found 0 vulnerabilities"
```

## Regular Maintenance

### Weekly
- [ ] Check error logs for suspicious patterns
- [ ] Review new code for parameter validation

### Monthly
- [ ] Run `npm audit fix` and update dependencies
- [ ] Review access logs for unauthorized attempts
- [ ] Test authentication endpoints manually

### Quarterly
- [ ] Perform security code review
- [ ] Update security documentation
- [ ] Audit database access permissions

## Reporting Security Issues

If you find a potential vulnerability:
1. **Don't publicize it** - Keep it private
2. **Document the issue** - Include steps to reproduce
3. **Send to security contact** - Create a security.md file with contact info
4. **Apply fix promptly** - Test before deploying

Create `SECURITY.md`:
```markdown
# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, please:

1. Email: security@yourdomain.com
2. Do NOT open a public GitHub issue
3. Include: vulnerability description, affected code, reproduction steps

We take security seriously and will respond within 24 hours.
```

---

**Last Updated**: March 24, 2026
**Status**: ✅ All SQL injection protections in place
**Next Review**: After any schema changes or new endpoints
