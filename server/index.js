const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { fetchMarketPrice, PRODUCT_MAP } = require('./market-price-service');
const priceScheduler = require('./market-price-scheduler');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// --- Authentication API ---

// shared login handler used by both /api/auth/login and /api/login
async function handleLogin(req, res) {
    try {
        const { email, password } = req.body;
        console.log(`[LOGIN] Attempt for email: ${email}`);

        if (!email || !password) {
            console.warn('[LOGIN] Missing email or password');
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Check if user exists in database
        let users;
        try {
            const result = await pool.query(
                'SELECT * FROM users WHERE email = $1 AND password = $2',
                [email, password]
            );
            users = result.rows;
            console.log(`[LOGIN] Database query returned ${users.length} user(s)`);
        } catch (dbErr) {
            console.error('[LOGIN] Database query failed:', dbErr.message);
            throw dbErr;
        }

        if (users.length === 0) {
            console.warn(`[LOGIN] No user found with email ${email}`);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = users[0];
        console.log(`[LOGIN] Success: user ${user.email} (id=${user.id})`);
        res.json({
            success: true,
            user: {
                id: user.id.toString(),
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        console.error('[LOGIN] Error:', err.message, err.stack);
        res.status(500).json({ error: err.message });
    }
}}

// shared register handler
async function handleRegister(req, res) {
    try {
        const { name, email, password } = req.body;
        console.log(`[REGISTER] Attempt for email: ${email}`);

        if (!name || !email || !password) {
            console.warn('[REGISTER] Missing name, email, or password');
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        // Check if user already exists
        let existingUsers;
        try {
            const result = await pool.query(
                'SELECT * FROM users WHERE email = $1',
                [email]
            );
            existingUsers = result.rows;
        } catch (dbErr) {
            console.error('[REGISTER] Database query failed:', dbErr.message);
            throw dbErr;
        }

        if (existingUsers.length > 0) {
            console.warn(`[REGISTER] Email ${email} already exists`);
            return res.status(409).json({ error: 'Email already exists' });
        }

        // Insert new user and return generated id
        let insertResult;
        try {
            insertResult = await pool.query(
                'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
                [name, email, password, 'farmer']
            );
        } catch (dbErr) {
            console.error('[REGISTER] Insert failed:', dbErr.message);
            throw dbErr;
        }

        const newUserId = insertResult.rows[0].id;
        console.log(`[REGISTER] Success: new user ${email} (id=${newUserId})`);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: newUserId.toString(),
                name,
                email,
                role: 'farmer'
            }
        });
    } catch (err) {
        console.error('[REGISTER] Error:', err.message, err.stack);
        res.status(500).json({ error: err.message });
    }
}}

// mount both canonical and alias routes
app.post('/api/auth/login', handleLogin);
app.post('/api/login', handleLogin);

app.post('/api/auth/register', handleRegister);
app.post('/api/register', handleRegister);

/**
 * Check if user exists
 * GET /api/auth/check-user/:email
 */
app.get('/api/auth/check-user/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        const { rows: users } = await pool.query(
            'SELECT id, name, email FROM users WHERE email = $1',
            [email]
        );
        
        if (users.length > 0) {
            return res.json({ exists: true, user: users[0] });
        }
        
        res.json({ exists: false });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Google OAuth Login - Verify Google token and create/update user
 * POST /api/auth/google
 */
app.post('/api/auth/google', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Google token is required' });
        }

        // Google can return either an ID token (JWT) or an access token.
        // The frontend currently sends the access_token from useGoogleLogin, which is *not* a JWT.
        // We'll try to handle both cases.

        let email, name;

        const isJwt = token.split('.').length === 3;
        if (isJwt) {
            // decode the JWT payload without verifying signature
            try {
                const payload = Buffer.from(token.split('.')[1], 'base64').toString('utf-8');
                const decodedData = JSON.parse(payload);
                email = decodedData.email;
                name = decodedData.name || decodedData.email;
            } catch (decodeErr) {
                return res.status(401).json({ error: 'Invalid token' });
            }
        } else {
            // treat as access token: fetch userinfo from Google
            try {
                const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!resp.ok) {
                    const errText = await resp.text();
                    console.error('Google userinfo error:', errText);
                    return res.status(401).json({ error: 'Invalid token' });
                }
                const profile = await resp.json();
                email = profile.email;
                name = profile.name || profile.email;
            } catch (fetchErr) {
                console.error('Failed to fetch Google profile', fetchErr);
                return res.status(500).json({ error: 'Failed to verify token' });
            }
        }

        if (!email) {
            return res.status(400).json({ error: 'Email not found in token' });
        }

        // Check if user exists
        const { rows: existingUsers } = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        let user;
        if (existingUsers.length > 0) {
            user = existingUsers[0];
        } else {
            // Create new user from Google auth
            const insertResult = await pool.query(
                'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
                [name || email.split('@')[0], email, 'google_oauth', 'farmer']
            );
            user = insertResult.rows[0];
        }

        res.json({
            success: true,
            user: {
                id: user.id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
                loginMethod: 'google'
            }
        });
    } catch (err) {
        console.error('Google OAuth error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- Products API ---

app.get('/api/products', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM products');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const { name, category, quantity, unit, minStock, harvestDate, lastUpdated } = req.body;
        const id = Date.now().toString();
        const insertSql = `
            INSERT INTO products (id, name, category, quantity, unit, minStock, harvestDate, lastUpdated)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;

        const insertResult = await pool.query(insertSql, [
            id, name, category, quantity, unit, minStock, harvestDate, lastUpdated
        ]);
        res.status(201).json(insertResult.rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const { name, category, quantity, unit, minStock, harvestDate, lastUpdated } = req.body;
        const sql = `
            UPDATE products
            SET name=$1, category=$2, quantity=$3, unit=$4, minStock=$5, harvestDate=$6, lastUpdated=$7
            WHERE id=$8
            RETURNING *
        `;

        const result = await pool.query(sql, [
            name, category, quantity, unit, minStock, harvestDate, lastUpdated, req.params.id
        ]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
        res.json({ message: 'Deleted', changes: result.rowCount });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- Schedules API ---

app.get('/api/schedules', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM schedules');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/schedules', async (req, res) => {
    try {
        const { cropName, category, plantingDate, harvestDate, area, estimatedYield, status, notes } = req.body;
        const id = Date.now().toString();
        const sql = `
            INSERT INTO schedules (id, cropName, category, plantingDate, harvestDate, area, estimatedYield, status, notes)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
        `;

        const result = await pool.query(sql, [
            id, cropName, category, plantingDate, harvestDate, area, estimatedYield, status, notes
        ]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/schedules/:id', async (req, res) => {
    try {
        const { cropName, category, plantingDate, harvestDate, area, estimatedYield, status, notes } = req.body;
        const sql = `
            UPDATE schedules
            SET cropName=$1, category=$2, plantingDate=$3, harvestDate=$4,
                area=$5, estimatedYield=$6, status=$7, notes=$8
            WHERE id=$9
            RETURNING *
        `;

        const result = await pool.query(sql, [
            cropName, category, plantingDate, harvestDate, area,
            estimatedYield, status, notes, req.params.id
        ]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/schedules/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM schedules WHERE id = $1', [req.params.id]);
        res.json({ message: 'Deleted', changes: result.rowCount });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- Price History API ---

app.get('/api/price-history', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM price_history ORDER BY id ASC');
        // Parse cropData JSON back to object
        const formattedRows = rows.map(r => ({
            date: r.date,
            ...JSON.parse(r.cropData)
        }));
        res.json(formattedRows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Activity Logs API ---

app.get('/api/activity-logs', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 50');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/activity-logs', async (req, res) => {
    try {
        const { action, type, itemName, user, timestamp, details } = req.body;
        const id = Date.now().toString();
        const sql = `
            INSERT INTO activity_logs (id, action, type, itemName, user, timestamp, details)
            VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
        `;

        const result = await pool.query(sql, [id, action, type, itemName, user, timestamp, details]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- Market Price API (from MOC Thailand) ---

/**
 * Fetch real-time market prices from Thailand MOC API
 * GET /api/market-prices?product_id=P11012&from_date=2026-02-27&to_date=2026-02-28
 */
app.get('/api/market-prices', async (req, res) => {
    try {
        const { product_id, from_date, to_date } = req.query;
        
        if (!product_id || !from_date || !to_date) {
            return res.status(400).json({ 
                error: 'Missing required parameters: product_id, from_date, to_date' 
            });
        }
        
        const priceData = await fetchMarketPrice(product_id, from_date, to_date);
        res.json(priceData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get market price for a specific day (today by default)
 * GET /api/market-prices/today?product_id=P11012
 */
app.get('/api/market-prices/today', async (req, res) => {
    try {
        const { product_id } = req.query;
        
        if (!product_id) {
            return res.status(400).json({ error: 'Missing product_id parameter' });
        }
        
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const priceData = await fetchMarketPrice(product_id, today, today);
        res.json(priceData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Store market price in database
 * POST /api/market-prices/store
 */
app.post('/api/market-prices/store', async (req, res) => {
    try {
        const { date, productId, productName, minPrice, maxPrice, avgPrice } = req.body;
        
        if (!date || !productId || avgPrice === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const sql = `
            INSERT INTO market_prices (date, product_id, product_name, min_price, max_price, avg_price)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (date, product_id)
            DO UPDATE SET min_price = EXCLUDED.min_price,
                          max_price = EXCLUDED.max_price,
                          avg_price = EXCLUDED.avg_price
        `;
        
        await pool.query(sql, [date, productId, productName || '', minPrice, maxPrice, avgPrice]);
        
        res.status(201).json({ 
            message: 'Market price stored successfully',
            date, productId, avgPrice 
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * Get market price history for a product
 * GET /api/market-prices/history/:product_id?from_date=2026-02-01&to_date=2026-02-28
 */
app.get('/api/market-prices/history/:product_id', async (req, res) => {
    try {
        const { product_id } = req.params;
        const { from_date, to_date } = req.query;
        
        let sql = 'SELECT * FROM market_prices WHERE product_id = $1';
        const params = [product_id];
        
        if (from_date && to_date) {
            sql += ' AND date BETWEEN $2 AND $3';
            params.push(from_date, to_date);
        }
        
        sql += ' ORDER BY date DESC LIMIT 100';
        
        const { rows } = await pool.query(sql, params);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'No price history found' });
        }
        
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Compare prices for multiple products on the same date
 * POST /api/market-prices/compare
 * Body: { date: "2026-02-28", product_ids: ["P11012", "P14001"] }
 */
app.post('/api/market-prices/compare', async (req, res) => {
    try {
        const { date, product_ids } = req.body;
        
        if (!date || !product_ids || product_ids.length === 0) {
            return res.status(400).json({ error: 'Missing date or product_ids' });
        }
        
        // build numbered placeholders starting at $2 since $1 is date
        const placeholders = product_ids.map((_, i) => `$${i + 2}`).join(',');
        const sql = `SELECT * FROM market_prices WHERE date = $1 AND product_id IN (${placeholders})`;
        
        const { rows } = await pool.query(sql, [date, ...product_ids]);
        
        res.json({
            date,
            products: rows,
            count: rows.length
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Start Server ---

app.listen(port, () => {
    console.log('\n========================================');
    console.log(`✅ Backend server running at http://localhost:${port}`);
    console.log('========================================');
    console.log('\nAvailable auth endpoints:');
    console.log('  POST /api/auth/login');
    console.log('  POST /api/login  (alias)');
    console.log('  POST /api/auth/register');
    console.log('  POST /api/register  (alias)');
    console.log('\n========================================\n');
    
    // Start automatic market price scheduler (runs daily at 6 AM)
    priceScheduler.startScheduler(6, 0);
});
