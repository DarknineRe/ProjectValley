const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { fetchMarketPrice, PRODUCT_MAP } = require('./market-price-service');
const priceScheduler = require('./market-price-scheduler');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

function getWorkspaceId(req) {
    return req.query.workspace_id || req.body?.workspaceId || req.headers['x-workspace-id'];
}

function requireWorkspaceId(req, res) {
    const workspaceId = getWorkspaceId(req);
    // Backward-compatible fallback so old clients won't fail hard
    return workspaceId || 'default';
}

function generateWorkspaceCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function isAllowedMarketProductId(productId) {
    return /^P13(00[1-9]|0[1-8][0-9]|09[0-2])$/i.test(String(productId || ''));
}

async function generateUniqueWorkspaceCode() {
    for (let i = 0; i < 10; i++) {
        const code = generateWorkspaceCode();
        const { rows } = await pool.query('SELECT id FROM workspaces WHERE code = $1 LIMIT 1', [code]);
        if (rows.length === 0) {
            return code;
        }
    }
    throw new Error('Failed to generate unique workspace code');
}

// --- Workspaces API ---

app.get('/api/workspaces', async (req, res) => {
    try {
        const userId = req.query.user_id;
        if (!userId) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        const sql = `
            SELECT
                w.id,
                w.name,
                w.code,
                w.owner_id,
                w.created_at,
                wm.user_id AS member_user_id,
                wm.role AS member_role,
                wm.can_view AS member_can_view,
                wm.can_add AS member_can_add,
                wm.can_edit AS member_can_edit,
                wm.can_manage_permissions AS member_can_manage_permissions,
                wm.view_dashboard AS member_view_dashboard,
                wm.view_inventory AS member_view_inventory,
                wm.view_summary AS member_view_summary,
                wm.view_calendar AS member_view_calendar,
                wm.view_analysis AS member_view_analysis,
                wm.view_price_comparison AS member_view_price_comparison,
                wm.view_recommendations AS member_view_recommendations,
                wm.view_members AS member_view_members,
                wm.view_activity AS member_view_activity,
                wm.joined_at AS member_joined_at,
                u.name AS member_name,
                u.email AS member_email
            FROM workspaces w
            JOIN workspace_members filter_wm ON filter_wm.workspace_id = w.id
            JOIN workspace_members wm ON wm.workspace_id = w.id
            JOIN users u ON u.id::text = wm.user_id
            WHERE filter_wm.user_id = $1
            ORDER BY w.created_at DESC, wm.joined_at ASC
        `;

        const { rows } = await pool.query(sql, [String(userId)]);

        const workspaceMap = new Map();

        for (const row of rows) {
            if (!workspaceMap.has(row.id)) {
                workspaceMap.set(row.id, {
                    id: row.id,
                    name: row.name,
                    code: row.code,
                    ownerId: row.owner_id,
                    createdAt: row.created_at,
                    members: []
                });
            }

            workspaceMap.get(row.id).members.push({
                id: row.member_user_id,
                name: row.member_name,
                email: row.member_email,
                role: row.member_role,
                canView: row.member_role === 'owner' ? true : row.member_can_view,
                canAdd: row.member_role === 'owner' ? true : row.member_can_add,
                canEdit: row.member_role === 'owner' ? true : row.member_can_edit,
                canManagePermissions: row.member_role === 'owner' ? true : row.member_can_manage_permissions,
                viewDashboard: row.member_role === 'owner' ? true : row.member_view_dashboard,
                viewInventory: row.member_role === 'owner' ? true : row.member_view_inventory,
                viewSummary: row.member_role === 'owner' ? true : row.member_view_summary,
                viewCalendar: row.member_role === 'owner' ? true : row.member_view_calendar,
                viewAnalysis: row.member_role === 'owner' ? true : row.member_view_analysis,
                viewPriceComparison: row.member_role === 'owner' ? true : row.member_view_price_comparison,
                viewRecommendations: row.member_role === 'owner' ? true : row.member_view_recommendations,
                viewMembers: row.member_role === 'owner' ? true : row.member_view_members,
                viewActivity: row.member_role === 'owner' ? true : row.member_view_activity,
                joinedAt: row.member_joined_at
            });
        }

        res.json(Array.from(workspaceMap.values()));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/workspaces', async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, ownerId } = req.body;

        if (!name || !ownerId) {
            return res.status(400).json({ error: 'name and ownerId are required' });
        }

        await client.query('BEGIN');

        const id = Date.now().toString();
        const code = await generateUniqueWorkspaceCode();

        await client.query(
            'INSERT INTO workspaces (id, name, code, owner_id) VALUES ($1, $2, $3, $4)',
            [id, name, code, String(ownerId)]
        );

        await client.query(
            `INSERT INTO workspace_members (
                workspace_id,
                user_id,
                role,
                can_view,
                can_add,
                can_edit,
                can_manage_permissions,
                view_dashboard,
                view_inventory,
                view_summary,
                view_calendar,
                view_analysis,
                view_price_comparison,
                view_recommendations,
                view_members,
                view_activity
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
            [id, String(ownerId), 'owner', true, true, true, true, true, true, true, true, true, true, true, true, true]
        );

        await client.query('COMMIT');

        const responseSql = `
            SELECT
                w.id,
                w.name,
                w.code,
                w.owner_id,
                w.created_at,
                wm.user_id AS member_user_id,
                wm.role AS member_role,
                wm.can_view AS member_can_view,
                wm.can_add AS member_can_add,
                wm.can_edit AS member_can_edit,
                wm.can_manage_permissions AS member_can_manage_permissions,
                wm.view_dashboard AS member_view_dashboard,
                wm.view_inventory AS member_view_inventory,
                wm.view_summary AS member_view_summary,
                wm.view_calendar AS member_view_calendar,
                wm.view_analysis AS member_view_analysis,
                wm.view_price_comparison AS member_view_price_comparison,
                wm.view_recommendations AS member_view_recommendations,
                wm.view_members AS member_view_members,
                wm.view_activity AS member_view_activity,
                wm.joined_at AS member_joined_at,
                u.name AS member_name,
                u.email AS member_email
            FROM workspaces w
            JOIN workspace_members wm ON wm.workspace_id = w.id
            JOIN users u ON u.id::text = wm.user_id
            WHERE w.id = $1
            ORDER BY wm.joined_at ASC
        `;

        const { rows } = await pool.query(responseSql, [id]);
        const workspace = {
            id,
            name,
            code,
            ownerId: String(ownerId),
            createdAt: rows[0]?.created_at || new Date().toISOString(),
            members: rows.map((row) => ({
                id: row.member_user_id,
                name: row.member_name,
                email: row.member_email,
                role: row.member_role,
                canView: row.member_role === 'owner' ? true : row.member_can_view,
                canAdd: row.member_role === 'owner' ? true : row.member_can_add,
                canEdit: row.member_role === 'owner' ? true : row.member_can_edit,
                canManagePermissions: row.member_role === 'owner' ? true : row.member_can_manage_permissions,
                viewDashboard: row.member_role === 'owner' ? true : row.member_view_dashboard,
                viewInventory: row.member_role === 'owner' ? true : row.member_view_inventory,
                viewSummary: row.member_role === 'owner' ? true : row.member_view_summary,
                viewCalendar: row.member_role === 'owner' ? true : row.member_view_calendar,
                viewAnalysis: row.member_role === 'owner' ? true : row.member_view_analysis,
                viewPriceComparison: row.member_role === 'owner' ? true : row.member_view_price_comparison,
                viewRecommendations: row.member_role === 'owner' ? true : row.member_view_recommendations,
                viewMembers: row.member_role === 'owner' ? true : row.member_view_members,
                viewActivity: row.member_role === 'owner' ? true : row.member_view_activity,
                joinedAt: row.member_joined_at
            }))
        };

        res.status(201).json(workspace);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.post('/api/workspaces/join', async (req, res) => {
    const client = await pool.connect();
    try {
        const { code, userId } = req.body;

        if (!code || !userId) {
            return res.status(400).json({ error: 'code and userId are required' });
        }

        await client.query('BEGIN');

        const { rows: workspaces } = await client.query(
            'SELECT id, name, code, owner_id, created_at FROM workspaces WHERE code = $1 LIMIT 1',
            [String(code).toUpperCase()]
        );

        if (workspaces.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Workspace not found' });
        }

        const workspace = workspaces[0];

        await client.query(
            `INSERT INTO workspace_members (
                workspace_id,
                user_id,
                role,
                can_view,
                can_add,
                can_edit,
                can_manage_permissions,
                view_dashboard,
                view_inventory,
                view_summary,
                view_calendar,
                view_analysis,
                view_price_comparison,
                view_recommendations,
                view_members,
                view_activity
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
             ON CONFLICT (workspace_id, user_id) DO NOTHING`,
            [workspace.id, String(userId), 'employee', true, false, false, false, true, true, true, true, true, true, true, true, true]
        );

        await client.query('COMMIT');

        const responseSql = `
            SELECT
                wm.user_id AS member_user_id,
                wm.role AS member_role,
                wm.can_view AS member_can_view,
                wm.can_add AS member_can_add,
                wm.can_edit AS member_can_edit,
                wm.can_manage_permissions AS member_can_manage_permissions,
                wm.view_dashboard AS member_view_dashboard,
                wm.view_inventory AS member_view_inventory,
                wm.view_summary AS member_view_summary,
                wm.view_calendar AS member_view_calendar,
                wm.view_analysis AS member_view_analysis,
                wm.view_price_comparison AS member_view_price_comparison,
                wm.view_recommendations AS member_view_recommendations,
                wm.view_members AS member_view_members,
                wm.view_activity AS member_view_activity,
                wm.joined_at AS member_joined_at,
                u.name AS member_name,
                u.email AS member_email
            FROM workspace_members wm
            JOIN users u ON u.id::text = wm.user_id
            WHERE wm.workspace_id = $1
            ORDER BY wm.joined_at ASC
        `;

        const { rows: memberRows } = await pool.query(responseSql, [workspace.id]);

        res.json({
            id: workspace.id,
            name: workspace.name,
            code: workspace.code,
            ownerId: workspace.owner_id,
            createdAt: workspace.created_at,
            members: memberRows.map((row) => ({
                id: row.member_user_id,
                name: row.member_name,
                email: row.member_email,
                role: row.member_role,
                canView: row.member_role === 'owner' ? true : row.member_can_view,
                canAdd: row.member_role === 'owner' ? true : row.member_can_add,
                canEdit: row.member_role === 'owner' ? true : row.member_can_edit,
                canManagePermissions: row.member_role === 'owner' ? true : row.member_can_manage_permissions,
                viewDashboard: row.member_role === 'owner' ? true : row.member_view_dashboard,
                viewInventory: row.member_role === 'owner' ? true : row.member_view_inventory,
                viewSummary: row.member_role === 'owner' ? true : row.member_view_summary,
                viewCalendar: row.member_role === 'owner' ? true : row.member_view_calendar,
                viewAnalysis: row.member_role === 'owner' ? true : row.member_view_analysis,
                viewPriceComparison: row.member_role === 'owner' ? true : row.member_view_price_comparison,
                viewRecommendations: row.member_role === 'owner' ? true : row.member_view_recommendations,
                viewMembers: row.member_role === 'owner' ? true : row.member_view_members,
                viewActivity: row.member_role === 'owner' ? true : row.member_view_activity,
                joinedAt: row.member_joined_at
            }))
        });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.delete('/api/workspaces/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const workspaceId = req.params.id;
        const userId = req.query.user_id;

        if (!workspaceId || !userId) {
            return res.status(400).json({ error: 'workspace id and user_id are required' });
        }

        const { rows: workspaceRows } = await client.query(
            'SELECT id, owner_id FROM workspaces WHERE id = $1 LIMIT 1',
            [workspaceId]
        );

        if (workspaceRows.length === 0) {
            return res.status(404).json({ error: 'Workspace not found' });
        }

        if (workspaceRows[0].owner_id !== String(userId)) {
            return res.status(403).json({ error: 'Only workspace owner can delete this workspace' });
        }

        await client.query('BEGIN');

        await client.query('DELETE FROM products WHERE workspace_id = $1', [workspaceId]);
        await client.query('DELETE FROM schedules WHERE workspace_id = $1', [workspaceId]);
        await client.query('DELETE FROM price_history WHERE workspace_id = $1', [workspaceId]);
        await client.query('DELETE FROM market_prices WHERE workspace_id = $1', [workspaceId]);
        await client.query('DELETE FROM activity_logs WHERE workspace_id = $1', [workspaceId]);

        await client.query('DELETE FROM workspace_members WHERE workspace_id = $1', [workspaceId]);
        const deleteResult = await client.query('DELETE FROM workspaces WHERE id = $1', [workspaceId]);

        await client.query('COMMIT');

        res.json({
            success: true,
            deleted: deleteResult.rowCount > 0
        });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.put('/api/workspaces/:id/members/:memberId/permissions', async (req, res) => {
    const client = await pool.connect();
    try {
        const workspaceId = req.params.id;
        const memberId = req.params.memberId;
        const {
            requesterUserId,
            canView,
            canAdd,
            canEdit,
            canManagePermissions,
            viewDashboard,
            viewInventory,
            viewSummary,
            viewCalendar,
            viewAnalysis,
            viewPriceComparison,
            viewRecommendations,
            viewMembers,
            viewActivity,
        } = req.body;

        if (!workspaceId || !memberId || !requesterUserId) {
            return res.status(400).json({ error: 'workspace id, member id and requesterUserId are required' });
        }

        await client.query('BEGIN');

        const { rows: requesterRows } = await client.query(
            `SELECT role, can_manage_permissions
             FROM workspace_members
             WHERE workspace_id = $1 AND user_id = $2
             LIMIT 1`,
            [workspaceId, String(requesterUserId)]
        );

        if (requesterRows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Requester is not a workspace member' });
        }

        const requester = requesterRows[0];
        const canManage = requester.role === 'owner' || requester.can_manage_permissions === true;
        if (!canManage) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'No permission to manage member permissions' });
        }

        const { rows: targetRows } = await client.query(
            `SELECT
                user_id,
                role,
                can_view,
                can_add,
                can_edit,
                can_manage_permissions,
                view_dashboard,
                view_inventory,
                view_summary,
                view_calendar,
                view_analysis,
                view_price_comparison,
                view_recommendations,
                view_members,
                view_activity
             FROM workspace_members
             WHERE workspace_id = $1 AND user_id = $2
             LIMIT 1`,
            [workspaceId, String(memberId)]
        );

        if (targetRows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Target member not found' });
        }

        if (targetRows[0].role === 'owner') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Owner permissions are fixed and cannot be modified' });
        }

        const current = targetRows[0];
        const pickBool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);
        const normalized = {
            canView: pickBool(canView, current.can_view),
            canAdd: pickBool(canAdd, current.can_add),
            canEdit: pickBool(canEdit, current.can_edit),
            canManagePermissions: pickBool(canManagePermissions, current.can_manage_permissions),
            viewDashboard: pickBool(viewDashboard, current.view_dashboard),
            viewInventory: pickBool(viewInventory, current.view_inventory),
            viewSummary: pickBool(viewSummary, current.view_summary),
            viewCalendar: pickBool(viewCalendar, current.view_calendar),
            viewAnalysis: pickBool(viewAnalysis, current.view_analysis),
            viewPriceComparison: pickBool(viewPriceComparison, current.view_price_comparison),
            viewRecommendations: pickBool(viewRecommendations, current.view_recommendations),
            viewMembers: pickBool(viewMembers, current.view_members),
            viewActivity: pickBool(viewActivity, current.view_activity),
        };

        await client.query(
            `UPDATE workspace_members
             SET can_view = $1,
                 can_add = $2,
                 can_edit = $3,
                 can_manage_permissions = $4,
                 view_dashboard = $5,
                 view_inventory = $6,
                 view_summary = $7,
                 view_calendar = $8,
                 view_analysis = $9,
                 view_price_comparison = $10,
                 view_recommendations = $11,
                 view_members = $12,
                 view_activity = $13
             WHERE workspace_id = $14 AND user_id = $15`,
            [
                normalized.canView,
                normalized.canAdd,
                normalized.canEdit,
                normalized.canManagePermissions,
                normalized.viewDashboard,
                normalized.viewInventory,
                normalized.viewSummary,
                normalized.viewCalendar,
                normalized.viewAnalysis,
                normalized.viewPriceComparison,
                normalized.viewRecommendations,
                normalized.viewMembers,
                normalized.viewActivity,
                workspaceId,
                String(memberId),
            ]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            workspaceId,
            memberId: String(memberId),
            permissions: normalized,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
});

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
}

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
}

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
        const workspaceId = requireWorkspaceId(req, res);
        if (!workspaceId) return;
        const { rows } = await pool.query('SELECT * FROM products WHERE workspace_id = $1', [workspaceId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const workspaceId = requireWorkspaceId(req, res);
        if (!workspaceId) return;
        let { name, category, quantity, unit, minStock, harvestDate, lastUpdated } = req.body;
        // enforce non-null minStock; default to 0 if missing or null
        if (minStock === undefined || minStock === null) {
            minStock = 0;
        }
        const id = Date.now().toString();
        const insertSql = `
            INSERT INTO products (id, workspace_id, name, category, quantity, unit, minStock, harvestDate, lastUpdated)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;

        const insertResult = await pool.query(insertSql, [
            id, workspaceId, name, category, quantity, unit, minStock, harvestDate, lastUpdated
        ]);
        res.status(201).json(insertResult.rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const workspaceId = requireWorkspaceId(req, res);
        if (!workspaceId) return;
        let { name, category, quantity, unit, minStock, harvestDate, lastUpdated } = req.body;
        if (minStock === undefined || minStock === null) {
            minStock = 0;
        }
        const sql = `
            UPDATE products
            SET name=$1, category=$2, quantity=$3, unit=$4, minStock=$5, harvestDate=$6, lastUpdated=$7
            WHERE id=$8 AND workspace_id=$9
            RETURNING *
        `;

        const result = await pool.query(sql, [
            name, category, quantity, unit, minStock, harvestDate, lastUpdated, req.params.id, workspaceId
        ]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found in this workspace' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const workspaceId = requireWorkspaceId(req, res);
        if (!workspaceId) return;
        const result = await pool.query('DELETE FROM products WHERE id = $1 AND workspace_id = $2', [req.params.id, workspaceId]);
        res.json({ message: 'Deleted', changes: result.rowCount });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- Schedules API ---

app.get('/api/schedules', async (req, res) => {
    try {
        const workspaceId = requireWorkspaceId(req, res);
        if (!workspaceId) return;
        const { rows } = await pool.query('SELECT * FROM schedules WHERE workspace_id = $1', [workspaceId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/schedules', async (req, res) => {
    try {
        const workspaceId = requireWorkspaceId(req, res);
        if (!workspaceId) return;
        const { cropName, category, plantingDate, harvestDate, area, estimatedYield, status, notes } = req.body;
        const id = Date.now().toString();
        const sql = `
            INSERT INTO schedules (id, workspace_id, cropName, category, plantingDate, harvestDate, area, estimatedYield, status, notes)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
        `;

        const result = await pool.query(sql, [
            id, workspaceId, cropName, category, plantingDate, harvestDate, area, estimatedYield, status, notes
        ]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/schedules/:id', async (req, res) => {
    try {
        const workspaceId = requireWorkspaceId(req, res);
        if (!workspaceId) return;
        const { cropName, category, plantingDate, harvestDate, area, estimatedYield, status, notes } = req.body;
        const sql = `
            UPDATE schedules
            SET cropName=$1, category=$2, plantingDate=$3, harvestDate=$4,
                area=$5, estimatedYield=$6, status=$7, notes=$8
            WHERE id=$9 AND workspace_id=$10
            RETURNING *
        `;

        const result = await pool.query(sql, [
            cropName, category, plantingDate, harvestDate, area,
            estimatedYield, status, notes, req.params.id, workspaceId
        ]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Schedule not found in this workspace' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/schedules/:id', async (req, res) => {
    try {
        const workspaceId = requireWorkspaceId(req, res);
        if (!workspaceId) return;
        const result = await pool.query('DELETE FROM schedules WHERE id = $1 AND workspace_id = $2', [req.params.id, workspaceId]);
        res.json({ message: 'Deleted', changes: result.rowCount });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- Price History API ---

app.get('/api/price-history', async (req, res) => {
    try {
        const workspaceId = requireWorkspaceId(req, res);
        if (!workspaceId) return;

        // Primary source: normalized market_prices table
        const marketPriceSql = `
            SELECT to_char(date, 'YYYY-MM') AS period,
                   product_name,
                                     AVG(avg_price)::float8 AS avg_price,
                                     AVG(min_price)::float8 AS min_price,
                                     AVG(max_price)::float8 AS max_price
            FROM market_prices
            WHERE workspace_id = $1
                              AND product_id ~ '^P13(00[1-9]|0[1-8][0-9]|09[0-2])$'
              AND product_name IS NOT NULL AND product_name <> ''
            GROUP BY period, product_name
            ORDER BY period ASC
        `;
        let { rows: marketRows } = await pool.query(marketPriceSql, [workspaceId]);

        if (marketRows.length === 0 && workspaceId !== 'default') {
            const fallbackResult = await pool.query(marketPriceSql, ['default']);
            marketRows = fallbackResult.rows;
        }

        if (marketRows.length > 0) {
            const grouped = new Map();

            for (const row of marketRows) {
                if (!grouped.has(row.period)) {
                    grouped.set(row.period, { date: row.period });
                }
                const target = grouped.get(row.period);
                const avgPrice = Number(row.avg_price);
                const minPrice = row.min_price === null ? avgPrice : Number(row.min_price);
                const maxPrice = row.max_price === null ? avgPrice : Number(row.max_price);

                target[row.product_name] = avgPrice;
                // hidden keys for market min/max used by frontend analytics
                target[`__min__${row.product_name}`] = minPrice;
                target[`__max__${row.product_name}`] = maxPrice;
            }

            return res.json(Array.from(grouped.values()));
        }

        // Fallback source: legacy price_history table
        let { rows } = await pool.query('SELECT * FROM price_history WHERE workspace_id = $1 ORDER BY id ASC', [workspaceId]);

        if (rows.length === 0 && workspaceId !== 'default') {
            const fallbackResult = await pool.query('SELECT * FROM price_history WHERE workspace_id = $1 ORDER BY id ASC', ['default']);
            rows = fallbackResult.rows;
        }
        const formattedRows = rows.map((r) => {
            const rawCropData = r.cropData ?? r.cropdata ?? {};

            let parsedCropData = {};
            if (typeof rawCropData === 'string') {
                try {
                    parsedCropData = JSON.parse(rawCropData);
                } catch (_e) {
                    parsedCropData = {};
                }
            } else if (rawCropData && typeof rawCropData === 'object') {
                parsedCropData = rawCropData;
            }

            return {
                date: r.date,
                ...parsedCropData
            };
        });
        res.json(formattedRows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Activity Logs API ---

app.get('/api/activity-logs', async (req, res) => {
    try {
        const workspaceId = requireWorkspaceId(req, res);
        if (!workspaceId) return;
        const { rows } = await pool.query('SELECT * FROM activity_logs WHERE workspace_id = $1 ORDER BY timestamp DESC LIMIT 50', [workspaceId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/activity-logs', async (req, res) => {
    try {
        const workspaceId = requireWorkspaceId(req, res);
        if (!workspaceId) return;
        const { action, type, itemName, user, timestamp, details } = req.body;
        const id = Date.now().toString();
        // ensure ISO string for timestamp
        const ts = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();
        const sql = `
            INSERT INTO activity_logs (id, workspace_id, action, type, itemName, "user", timestamp, details)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
        `;

        const result = await pool.query(sql, [id, workspaceId, action, type, itemName, user, ts, details]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// rollback endpoint for undoing logged actions
app.post('/api/activity-logs/:id/rollback', async (req, res) => {
    const client = await pool.connect();
    try {
        const workspaceId = requireWorkspaceId(req, res);
        if (!workspaceId) return;
        const { id } = req.params;

        await client.query('BEGIN');

        const { rows } = await client.query('SELECT * FROM activity_logs WHERE id = $1 AND workspace_id = $2', [id, workspaceId]);
        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Log not found' });
        }
        const log = rows[0];
        let details;
        try {
            details = JSON.parse(log.details);
        } catch (e) {
            details = null;
        }

        // require an itemId at minimum for rollback
        const itemId = details?.itemId || details?.item_id;
        if (!itemId) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient rollback information' });
        }

        // helper functions for each type
        const rollbackProduct = async () => {
            if (log.action === 'add') {
                await client.query('DELETE FROM products WHERE id = $1 AND workspace_id = $2', [itemId, workspaceId]);
            } else if (log.action === 'delete') {
                const prev = details?.previous || details?.prev || details?.old;
                if (!prev) throw new Error('No previous product data');
                await client.query(
                    `INSERT INTO products (id,workspace_id,name,category,quantity,unit,minStock,harvestDate,lastUpdated)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                     ON CONFLICT (id) DO UPDATE SET
                        workspace_id = EXCLUDED.workspace_id,
                        name = EXCLUDED.name,
                        category = EXCLUDED.category,
                        quantity = EXCLUDED.quantity,
                        unit = EXCLUDED.unit,
                        minStock = EXCLUDED.minStock,
                        harvestDate = EXCLUDED.harvestDate,
                        lastUpdated = EXCLUDED.lastUpdated`,
                    [
                        prev.id,
                        workspaceId,
                        prev.name,
                        prev.category,
                        prev.quantity,
                        prev.unit,
                        prev.minStock ?? prev.minstock ?? 0,
                        prev.harvestDate ?? prev.harvestdate ?? null,
                        prev.lastUpdated ?? prev.lastupdated ?? new Date().toISOString(),
                    ]
                );
            } else if (log.action === 'update') {
                const prev = details?.previous || details?.prev || details?.old;
                if (!prev) throw new Error('No previous product data');
                await client.query(
                    `UPDATE products SET name=$1, category=$2, quantity=$3, unit=$4, minStock=$5, harvestDate=$6, lastUpdated=$7 WHERE id=$8 AND workspace_id=$9`,
                    [
                        prev.name,
                        prev.category,
                        prev.quantity,
                        prev.unit,
                        prev.minStock ?? prev.minstock ?? 0,
                        prev.harvestDate ?? prev.harvestdate ?? null,
                        prev.lastUpdated ?? prev.lastupdated ?? new Date().toISOString(),
                        prev.id,
                        workspaceId,
                    ]
                );
            }
        };

        const rollbackSchedule = async () => {
            if (log.action === 'add') {
                await client.query('DELETE FROM schedules WHERE id = $1 AND workspace_id = $2', [itemId, workspaceId]);
            } else if (log.action === 'delete') {
                const prev = details?.previous || details?.prev || details?.old;
                if (!prev) throw new Error('No previous schedule data');
                await client.query(
                    `INSERT INTO schedules (id,workspace_id,cropName,category,plantingDate,harvestDate,area,estimatedYield,status,notes)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                     ON CONFLICT (id) DO UPDATE SET
                        workspace_id = EXCLUDED.workspace_id,
                        cropName = EXCLUDED.cropName,
                        category = EXCLUDED.category,
                        plantingDate = EXCLUDED.plantingDate,
                        harvestDate = EXCLUDED.harvestDate,
                        area = EXCLUDED.area,
                        estimatedYield = EXCLUDED.estimatedYield,
                        status = EXCLUDED.status,
                        notes = EXCLUDED.notes`,
                    [
                        prev.id,
                        workspaceId,
                        prev.cropName ?? prev.cropname,
                        prev.category,
                        prev.plantingDate ?? prev.plantingdate,
                        prev.harvestDate ?? prev.harvestdate,
                        prev.area,
                        prev.estimatedYield ?? prev.estimatedyield ?? null,
                        prev.status,
                        prev.notes,
                    ]
                );
            } else if (log.action === 'update') {
                const prev = details?.previous || details?.prev || details?.old;
                if (!prev) throw new Error('No previous schedule data');
                await client.query(
                    `UPDATE schedules SET cropName=$1, category=$2, plantingDate=$3, harvestDate=$4, area=$5, estimatedYield=$6, status=$7, notes=$8 WHERE id=$9 AND workspace_id=$10`,
                    [
                        prev.cropName ?? prev.cropname,
                        prev.category,
                        prev.plantingDate ?? prev.plantingdate,
                        prev.harvestDate ?? prev.harvestdate,
                        prev.area,
                        prev.estimatedYield ?? prev.estimatedyield ?? null,
                        prev.status,
                        prev.notes,
                        prev.id,
                        workspaceId,
                    ]
                );
            }
        };

        if (log.type === 'product') {
            await rollbackProduct();
        } else if (log.type === 'schedule') {
            await rollbackSchedule();
        } else {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Cannot rollback this type' });
        }

        // Remove rolled-back log so it disappears from the list and cannot be rolled back twice.
        await client.query('DELETE FROM activity_logs WHERE id = $1 AND workspace_id = $2', [id, workspaceId]);

        await client.query('COMMIT');

        res.json({ success: true, removedLogId: id });
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch {}
        console.error('Rollback error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
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
        if (!isAllowedMarketProductId(product_id)) {
            return res.status(400).json({ error: 'Only vegetable product IDs are allowed (P13001-P13092)' });
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
        if (!isAllowedMarketProductId(product_id)) {
            return res.status(400).json({ error: 'Only vegetable product IDs are allowed (P13001-P13092)' });
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
        const workspaceId = requireWorkspaceId(req, res);
        if (!workspaceId) return;
        const { date, productId, productName, minPrice, maxPrice, avgPrice } = req.body;
        
        if (!date || !productId || avgPrice === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const sql = `
            INSERT INTO market_prices (workspace_id, date, product_id, product_name, min_price, max_price, avg_price)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (workspace_id, date, product_id)
            DO UPDATE SET product_name = COALESCE(NULLIF(EXCLUDED.product_name, ''), market_prices.product_name),
                          min_price = EXCLUDED.min_price,
                          max_price = EXCLUDED.max_price,
                          avg_price = EXCLUDED.avg_price
        `;
        
        await pool.query(sql, [workspaceId, date, productId, productName || '', minPrice, maxPrice, avgPrice]);
        
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
        const workspaceId = requireWorkspaceId(req, res);
        if (!workspaceId) return;
        const { product_id } = req.params;
        const { from_date, to_date } = req.query;

        if (!isAllowedMarketProductId(product_id)) {
            return res.status(400).json({ error: 'Only vegetable product IDs are allowed (P13001-P13092)' });
        }
        
        let sql = 'SELECT * FROM market_prices WHERE workspace_id = $1 AND product_id = $2';
        const params = [workspaceId, product_id];
        
        if (from_date && to_date) {
            sql += ' AND date BETWEEN $3 AND $4';
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
 * Get latest market prices per product (real DB data)
 * GET /api/market-prices/latest?workspace_id=default&limit=200
 */
app.get('/api/market-prices/latest', async (req, res) => {
    try {
        const workspaceId = requireWorkspaceId(req, res);
        if (!workspaceId) return;

        const limit = Number(req.query.limit || 200);
        const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 1000) : 200;

        const sql = `
            SELECT *
            FROM (
                SELECT DISTINCT ON (product_id)
                    id,
                    workspace_id,
                    date,
                    product_id,
                    product_name,
                    min_price,
                    max_price,
                    avg_price,
                    created_at
                FROM market_prices
                WHERE workspace_id = $1
                  AND product_id ~ '^P13(00[1-9]|0[1-8][0-9]|09[0-2])$'
                  AND product_name IS NOT NULL
                  AND btrim(product_name) <> ''
                ORDER BY product_id, date DESC, created_at DESC
            ) latest
            ORDER BY date DESC, product_id ASC
            LIMIT $2
        `;

        let { rows } = await pool.query(sql, [workspaceId, safeLimit]);

        if (rows.length === 0 && workspaceId !== 'default') {
            const fallback = await pool.query(sql, ['default', safeLimit]);
            rows = fallback.rows;
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
        const workspaceId = requireWorkspaceId(req, res);
        if (!workspaceId) return;
        const { date, product_ids } = req.body;
        
        if (!date || !product_ids || product_ids.length === 0) {
            return res.status(400).json({ error: 'Missing date or product_ids' });
        }
        const invalidId = product_ids.find((id) => !isAllowedMarketProductId(id));
        if (invalidId) {
            return res.status(400).json({
                error: `Unsupported product_id: ${invalidId}. Only P13001-P13092 are allowed`
            });
        }
        
        // build numbered placeholders starting at $3 ($1 workspace, $2 date)
        const placeholders = product_ids.map((_, i) => `$${i + 3}`).join(',');
        const sql = `SELECT * FROM market_prices WHERE workspace_id = $1 AND date = $2 AND product_id IN (${placeholders})`;
        
        const { rows } = await pool.query(sql, [workspaceId, date, ...product_ids]);
        
        res.json({
            date,
            products: rows,
            count: rows.length
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Repair placeholder market prices and backfill from MOC for a date range.
 * POST /api/market-prices/maintenance/repair
 * Body: {
 *   fromDate: "2026-03-01",
 *   toDate: "2026-03-09",
 *   cleanupPlaceholder: true,
 *   cleanupNonVegetable: true,
 *   repairMissingNames: true,
 *   workspaceId: "default"
 * }
 */
app.post('/api/market-prices/maintenance/repair', async (req, res) => {
    try {
        const {
            fromDate,
            toDate,
            cleanupPlaceholder = true,
            cleanupNonVegetable = false,
            repairMissingNames = true,
            workspaceId = 'default'
        } = req.body || {};

        if (!fromDate || !toDate) {
            return res.status(400).json({ error: 'fromDate and toDate are required (YYYY-MM-DD)' });
        }

        let deletedRows = 0;
        if (cleanupPlaceholder) {
            const deleteSql = `
                DELETE FROM market_prices
                WHERE workspace_id = $1
                  AND min_price = 5
                  AND max_price = 5
                  AND avg_price = 5
                  AND (product_name IS NULL OR btrim(product_name) = '')
                  AND date BETWEEN $2 AND $3
            `;
            const deleted = await pool.query(deleteSql, [workspaceId, fromDate, toDate]);
            deletedRows = deleted.rowCount || 0;
        }

        let deletedNonVegetableRows = 0;
        if (cleanupNonVegetable) {
            const deleteNonVegetableSql = `
                DELETE FROM market_prices
                WHERE workspace_id = $1
                  AND date BETWEEN $2 AND $3
                AND product_id !~ '^P13(00[1-9]|0[1-8][0-9]|09[0-2])$'
            `;
            const deletedNonVegetable = await pool.query(deleteNonVegetableSql, [workspaceId, fromDate, toDate]);
            deletedNonVegetableRows = deletedNonVegetable.rowCount || 0;
        }

        let repairedNameRows = 0;
        if (repairMissingNames) {
            for (const [productId, mapping] of Object.entries(PRODUCT_MAP)) {
                const displayName = mapping?.name || '';
                if (!displayName) continue;

                const updateSql = `
                    UPDATE market_prices
                    SET product_name = $1
                    WHERE workspace_id = $2
                      AND product_id = $3
                      AND (product_name IS NULL OR btrim(product_name) = '')
                      AND date BETWEEN $4 AND $5
                `;
                const updated = await pool.query(updateSql, [displayName, workspaceId, productId, fromDate, toDate]);
                repairedNameRows += updated.rowCount || 0;
            }
        }

        await priceScheduler.backfillPricesInRange(fromDate, toDate);

        res.json({
            success: true,
            fromDate,
            toDate,
            workspaceId,
            deletedRows,
            deletedNonVegetableRows,
            repairedNameRows,
            message: 'Market price repair completed',
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
