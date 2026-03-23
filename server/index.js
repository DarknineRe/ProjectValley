const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { fetchMarketPrice, fetchProductCatalog } = require('./market-price-service');

const app = express();
const port = 3001;

const SYSTEM_ADMIN_EMAILS = new Set(
    String(
        process.env.SYSTEM_ADMIN_EMAILS ||
            'farmer@example.com,srisommai@example.com,admin@example.com'
    )
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
);

function isGlobalAdminUser(user) {
    if (!user) return false;
    const role = String(user.role || '').toLowerCase();
    const email = String(user.email || '').toLowerCase();
    return role === 'admin' || SYSTEM_ADMIN_EMAILS.has(email);
}

const OTP_EXPIRE_MS = 5 * 60 * 1000;
const loginOtpStore = new Map();
const registerOtpStore = new Map();

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
    return /^P\d{5}$/i.test(String(productId || ''));
}

function normalizeMarketProductName(name) {
    return String(name || '')
    .replace(/\s*\(\s*บาท\s*\/\s*กก\.?\s*\)\s*/gi, ' ')
        .replace(/\s+(คละ|คัด)(?=\s*\(|$)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

const REALTIME_CACHE_TTL_MS = 5 * 60 * 1000;
const realtimePriceCache = new Map();
const realtimeCatalogCache = {
    expiresAt: 0,
    products: [],
};

function formatDateKey(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function listDateRange(fromDate, toDate, maxDays = 45) {
    const from = new Date(`${fromDate}T00:00:00.000Z`);
    const to = new Date(`${toDate}T00:00:00.000Z`);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        throw new Error('Invalid date format, expected YYYY-MM-DD');
    }
    if (from > to) {
        throw new Error('from_date must be earlier than or equal to to_date');
    }

    const days = [];
    const cursor = new Date(from);
    while (cursor <= to) {
        days.push(formatDateKey(cursor));
        if (days.length > maxDays) {
            throw new Error(`Date range too large. Maximum ${maxDays} days per request`);
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return days;
}

async function runWithConcurrency(items, concurrency, worker) {
    const safeConcurrency = Math.max(1, Math.min(concurrency || 1, items.length || 1));
    const results = [];
    let index = 0;

    async function runner() {
        while (true) {
            const current = index;
            index += 1;
            if (current >= items.length) return;
            const value = await worker(items[current], current);
            if (value !== null && value !== undefined) {
                results.push(value);
            }
        }
    }

    await Promise.all(Array.from({ length: safeConcurrency }, () => runner()));
    return results;
}

async function getRealtimePrice(productId, fromDate, toDate) {
    const key = `${productId}|${fromDate}|${toDate}`;
    const cached = realtimePriceCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
    }

    const value = await fetchMarketPrice(productId, fromDate, toDate);
    const normalized = {
        ...value,
        productName: normalizeMarketProductName(value?.productName || ''),
    };

    realtimePriceCache.set(key, {
        expiresAt: Date.now() + REALTIME_CACHE_TTL_MS,
        value: normalized,
    });

    return normalized;
}

async function getTrackedMarketProducts(limit = 300) {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 2000) : 300;
    if (realtimeCatalogCache.expiresAt > Date.now() && realtimeCatalogCache.products.length > 0) {
        return realtimeCatalogCache.products.slice(0, safeLimit);
    }

    const generated = Array.from({ length: 92 }, (_, i) => {
        const sequence = String(i + 1).padStart(3, '0');
        return {
            id: `P13${sequence}`,
            name: `P13${sequence}`,
        };
    });

    let catalog = [];
    try {
        catalog = await fetchProductCatalog(2000);
    } catch {
        catalog = [];
    }

    const combined = [...catalog, ...generated]
        .filter((item) => item?.id && isAllowedMarketProductId(item.id))
        .map((item) => ({
            id: String(item.id).toUpperCase(),
            name: normalizeMarketProductName(item.name || item.id),
        }));

    const deduped = [];
    const seen = new Set();
    for (const item of combined) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        deduped.push(item);
    }

    realtimeCatalogCache.expiresAt = Date.now() + REALTIME_CACHE_TTL_MS;
    realtimeCatalogCache.products = deduped;

    return deduped.slice(0, safeLimit);
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

async function generateUniqueWorkspaceCodeWithClient(client) {
    for (let i = 0; i < 10; i++) {
        const code = generateWorkspaceCode();
        const { rows } = await client.query('SELECT id FROM workspaces WHERE code = $1 LIMIT 1', [code]);
        if (rows.length === 0) {
            return code;
        }
    }
    throw new Error('Failed to generate unique workspace code');
}

async function createOwnedWorkspaceForUser(client, userId, ownerName) {
    const workspaceId = `${Date.now()}_${String(userId)}`;
    const workspaceCode = await generateUniqueWorkspaceCodeWithClient(client);
    const workspaceName = `${ownerName} Workspace`;

    await client.query(
        'INSERT INTO workspaces (id, name, code, owner_id) VALUES ($1, $2, $3, $4)',
        [workspaceId, workspaceName, workspaceCode, String(userId)]
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
        ) VALUES ($1, $2, 'owner', true, true, true, true, true, true, true, true, true, true, true, true, true)
        ON CONFLICT (workspace_id, user_id) DO NOTHING`,
        [workspaceId, String(userId)]
    );

    return {
        id: workspaceId,
        name: workspaceName,
        code: workspaceCode,
        ownerId: String(userId),
    };
}

async function ensureAdminSharedWorkspace(client, adminUserId) {
    const { rows: farmerRows } = await client.query(
        'SELECT id, name FROM users WHERE email = $1 LIMIT 1',
        ['farmer@example.com']
    );

    if (farmerRows.length === 0) {
        throw new Error('Shared workspace owner (farmer@example.com) not found');
    }

    const farmer = farmerRows[0];
    const { rows: workspaceRows } = await client.query(
        'SELECT id, name, code, owner_id FROM workspaces WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
        [String(farmer.id)]
    );

    let workspace;
    if (workspaceRows.length === 0) {
        workspace = await createOwnedWorkspaceForUser(client, farmer.id, farmer.name || 'Farmer');
    } else {
        const row = workspaceRows[0];
        workspace = {
            id: row.id,
            name: row.name,
            code: row.code,
            ownerId: String(row.owner_id),
        };
    }

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
        ) VALUES ($1, $2, 'employee', true, true, true, true, true, true, true, true, true, true, true, true, true)
        ON CONFLICT (workspace_id, user_id) DO NOTHING`,
        [workspace.id, String(adminUserId)]
    );

    return workspace;
}

async function ensureWorkspaceMembershipForUser(client, user) {
    const { rows: membershipRows } = await client.query(
        'SELECT COUNT(*)::int AS count FROM workspace_members WHERE user_id = $1',
        [String(user.id)]
    );
    const membershipCount = membershipRows[0]?.count || 0;
    if (membershipCount > 0) {
        return null;
    }

    if (isGlobalAdminUser(user)) {
        return await ensureAdminSharedWorkspace(client, user.id);
    }

    return await createOwnedWorkspaceForUser(
        client,
        user.id,
        user.name || String(user.email || 'user').split('@')[0]
    );
}

// --- Workspaces API ---

app.get('/api/workspaces', async (req, res) => {
    try {
        const userId = req.query.user_id;
        if (!userId) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        const { rows: requesterRows } = await pool.query(
            'SELECT id, role, email FROM users WHERE id = $1 LIMIT 1',
            [String(userId)]
        );

        if (requesterRows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const requester = requesterRows[0];
        const isGlobalAdmin = isGlobalAdminUser(requester);

        const baseSelect = `
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
        `;

        const sql = isGlobalAdmin
            ? `${baseSelect}
            ORDER BY w.created_at DESC, wm.joined_at ASC`
            : `${baseSelect}
            JOIN workspace_members filter_wm ON filter_wm.workspace_id = w.id
            WHERE filter_wm.user_id = $1
            ORDER BY w.created_at DESC, wm.joined_at ASC
        `;

        const { rows } = isGlobalAdmin
            ? await pool.query(sql)
            : await pool.query(sql, [String(userId)]);

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

        const { rows: requesterRows } = await client.query(
            'SELECT role, email FROM users WHERE id = $1 LIMIT 1',
            [String(userId)]
        );

        if (requesterRows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isGlobalAdmin = isGlobalAdminUser(requesterRows[0]);

        if (!isGlobalAdmin && workspaceRows[0].owner_id !== String(userId)) {
            return res.status(403).json({ error: 'Only workspace owner can delete this workspace' });
        }

        await client.query('BEGIN');

        await client.query('DELETE FROM products WHERE workspace_id = $1', [workspaceId]);
        await client.query('DELETE FROM schedules WHERE workspace_id = $1', [workspaceId]);
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

        const { rows: requesterUserRows } = await client.query(
            'SELECT role, email FROM users WHERE id = $1 LIMIT 1',
            [String(requesterUserId)]
        );

        if (requesterUserRows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Requester user not found' });
        }

        const isGlobalAdmin = isGlobalAdminUser(requesterUserRows[0]);

        const { rows: requesterRows } = await client.query(
            `SELECT role, can_manage_permissions
             FROM workspace_members
             WHERE workspace_id = $1 AND user_id = $2
             LIMIT 1`,
            [workspaceId, String(requesterUserId)]
        );

        if (!isGlobalAdmin && requesterRows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Requester is not a workspace member' });
        }

        const requester = requesterRows[0];
        const canManage =
            isGlobalAdmin ||
            (requester && (requester.role === 'owner' || requester.can_manage_permissions === true));
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

app.post('/api/workspaces/:id/guest-accounts', async (req, res) => {
    const client = await pool.connect();
    try {
        const workspaceId = req.params.id;
        const { creatorUserId, name, email, password } = req.body;

        if (!workspaceId || !creatorUserId || !name || !email || !password) {
            return res.status(400).json({ error: 'workspace id, creatorUserId, name, email and password are required' });
        }

        await client.query('BEGIN');

        const { rows: creatorRows } = await client.query(
            'SELECT role, email FROM users WHERE id = $1 LIMIT 1',
            [String(creatorUserId)]
        );

        if (creatorRows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Creator user not found' });
        }

        const creatorIsGlobalAdmin = isGlobalAdminUser(creatorRows[0]);

        const { rows: workspaceRows } = await client.query(
            'SELECT id, owner_id FROM workspaces WHERE id = $1 LIMIT 1',
            [workspaceId]
        );

        if (workspaceRows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Workspace not found' });
        }

        const workspace = workspaceRows[0];

        if (!creatorIsGlobalAdmin && workspace.owner_id !== String(creatorUserId)) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Only workspace owner can create guest accounts' });
        }

        let userId;
        const normalizedEmail = String(email).trim().toLowerCase();

        const { rows: existingUsers } = await client.query(
            'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
            [normalizedEmail]
        );

        if (existingUsers.length > 0) {
            userId = String(existingUsers[0].id);
        } else {
            const { rows: createdUsers } = await client.query(
                'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
                [String(name).trim(), normalizedEmail, String(password), 'farmer']
            );
            userId = String(createdUsers[0].id);
        }

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
            ) VALUES ($1, $2, 'employee', true, false, false, false, true, true, true, true, true, true, true, true, true)
            ON CONFLICT (workspace_id, user_id) DO NOTHING`,
            [workspaceId, userId]
        );

        await client.query('COMMIT');

        return res.status(201).json({
            success: true,
            workspaceId,
            userId,
            email: normalizedEmail,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Transfer workspace ownership to a different user
app.put('/api/workspaces/:id/transfer-ownership', async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const { newOwnerId } = req.body;

        if (!workspaceId || !newOwnerId) {
            return res.status(400).json({ error: 'workspaceId and newOwnerId are required' });
        }

        // Verify the new owner exists
        const { rows: userRows } = await pool.query('SELECT id FROM users WHERE id = $1', [newOwnerId]);
        if (userRows.length === 0) {
            return res.status(404).json({ error: 'New owner user not found' });
        }

        // Update the workspace owner
        const { rows } = await pool.query(
            'UPDATE workspaces SET owner_id = $1 WHERE id = $2 RETURNING *',
            [newOwnerId, workspaceId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Workspace not found' });
        }

        res.json({
            success: true,
            message: 'Workspace ownership transferred',
            workspace: rows[0]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Authentication API ---

function generateOtpCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function sendOtpByEmail(email, otpCode) {
    // Placeholder email sender. Integrate SMTP provider later.
    console.log(`[OTP] Send ${otpCode} to ${email}`);
}

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

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await ensureWorkspaceMembershipForUser(client, user);
            await client.query('COMMIT');
        } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        } finally {
            client.release();
        }

        res.json({
            success: true,
            user: {
                id: user.id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (err) {
        console.error('[LOGIN] Error:', err.message, err.stack);
        res.status(500).json({ error: err.message });
    }
}

async function handleVerifyLoginOtp(req, res) {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: 'Email and otp are required' });
        }

        const key = String(email).toLowerCase();
        const otpSession = loginOtpStore.get(key);

        if (!otpSession) {
            return res.status(400).json({ error: 'OTP session not found. Please login again.' });
        }

        if (Date.now() > otpSession.expiresAt) {
            loginOtpStore.delete(key);
            return res.status(400).json({ error: 'OTP expired. Please login again.' });
        }

        if (String(otpSession.code) !== String(otp).trim()) {
            return res.status(401).json({ error: 'Invalid OTP code' });
        }

        loginOtpStore.delete(key);
        return res.json({
            success: true,
            user: otpSession.user,
        });
    } catch (err) {
        console.error('[LOGIN OTP VERIFY] Error:', err.message, err.stack);
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

        const otpCode = generateOtpCode();
        const expiresAt = Date.now() + OTP_EXPIRE_MS;

        registerOtpStore.set(String(email).toLowerCase(), {
            code: otpCode,
            expiresAt,
            pendingUser: {
                name,
                email,
                password,
                role: 'farmer',
            },
        });

        sendOtpByEmail(email, otpCode);
        console.log(`[REGISTER] OTP requested for ${email}`);

        const response = {
            success: true,
            requiresOtp: true,
            email,
            message: 'OTP sent to your email',
        };

        if (process.env.NODE_ENV !== 'production') {
            response.devOtp = otpCode;
        }

        res.status(200).json(response);
    } catch (err) {
        console.error('[REGISTER] Error:', err.message, err.stack);
        res.status(500).json({ error: err.message });
    }
}

async function handleVerifyRegisterOtp(req, res) {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: 'Email and otp are required' });
        }

        const key = String(email).toLowerCase();
        const otpSession = registerOtpStore.get(key);

        if (!otpSession) {
            return res.status(400).json({ error: 'OTP session not found. Please register again.' });
        }

        if (Date.now() > otpSession.expiresAt) {
            registerOtpStore.delete(key);
            return res.status(400).json({ error: 'OTP expired. Please register again.' });
        }

        if (String(otpSession.code) !== String(otp).trim()) {
            return res.status(401).json({ error: 'Invalid OTP code' });
        }

        const { pendingUser } = otpSession;

        const { rows: existingUsers } = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [pendingUser.email]
        );

        if (existingUsers.length > 0) {
            registerOtpStore.delete(key);
            return res.status(409).json({ error: 'Email already exists' });
        }

        const client = await pool.connect();
        let newUserId;
        let createdWorkspace;
        try {
            await client.query('BEGIN');
            const insertResult = await client.query(
                'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
                [pendingUser.name, pendingUser.email, pendingUser.password, pendingUser.role]
            );
            newUserId = insertResult.rows[0].id;
            createdWorkspace = await ensureWorkspaceMembershipForUser(client, {
                id: newUserId,
                name: pendingUser.name,
                email: pendingUser.email,
                role: pendingUser.role,
            });
            await client.query('COMMIT');
        } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        } finally {
            client.release();
        }

        registerOtpStore.delete(key);

        return res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: newUserId.toString(),
                name: pendingUser.name,
                email: pendingUser.email,
                role: pendingUser.role,
            },
            workspace: createdWorkspace,
        });
    } catch (err) {
        console.error('[REGISTER OTP VERIFY] Error:', err.message, err.stack);
        res.status(500).json({ error: err.message });
    }
}

// mount both canonical and alias routes
app.post('/api/auth/login', handleLogin);
app.post('/api/login', handleLogin);
app.post('/api/auth/login/verify-otp', handleVerifyLoginOtp);
app.post('/api/login/verify-otp', handleVerifyLoginOtp);

app.post('/api/auth/register', handleRegister);
app.post('/api/register', handleRegister);
app.post('/api/auth/register/verify-otp', handleVerifyRegisterOtp);
app.post('/api/register/verify-otp', handleVerifyRegisterOtp);

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

            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await ensureWorkspaceMembershipForUser(client, user);
                await client.query('COMMIT');
            } catch (txErr) {
                await client.query('ROLLBACK');
                throw txErr;
            } finally {
                client.release();
            }
        } else {
            // Create new user from Google auth
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const insertResult = await client.query(
                    'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
                    [name || email.split('@')[0], email, 'google_oauth', 'farmer']
                );
                user = insertResult.rows[0];
                await ensureWorkspaceMembershipForUser(client, user);
                await client.query('COMMIT');
            } catch (txErr) {
                await client.query('ROLLBACK');
                throw txErr;
            } finally {
                client.release();
            }
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

app.get('/api/public/products', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                p.*,
                w.name AS workspace_name
            FROM products p
            LEFT JOIN workspaces w ON w.id = p.workspace_id
            WHERE p.quantity > 0
            ORDER BY COALESCE(w.name, 'ทั่วไป') ASC, p.lastUpdated DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin endpoint: fetch all products from all workspaces
app.get('/api/admin/all-products', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                p.*,
                w.name AS workspace_name
            FROM products p
            LEFT JOIN workspaces w ON w.id = p.workspace_id
            ORDER BY COALESCE(w.name, 'ทั่วไป') ASC, p.lastUpdated DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const workspaceId = requireWorkspaceId(req, res);
        if (!workspaceId) return;
        let {
            name,
            category,
            quantity,
            unit,
            price,
            imageUrl,
            sellerId,
            sellerName,
            minStock,
            harvestDate,
            lastUpdated,
        } = req.body;
        // enforce non-null minStock; default to 0 if missing or null
        if (minStock === undefined || minStock === null) {
            minStock = 0;
        }
        if (price === undefined || price === null || Number.isNaN(Number(price))) {
            price = 0;
        }
        if (!sellerId || !sellerName) {
            return res.status(400).json({ error: 'sellerId and sellerName are required' });
        }
        const id = Date.now().toString();
        const insertSql = `
            INSERT INTO products (id, workspace_id, name, category, quantity, unit, price, image_url, seller_id, seller_name, minStock, harvestDate, lastUpdated)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `;

        const insertResult = await pool.query(insertSql, [
            id,
            workspaceId,
            name,
            category,
            quantity,
            unit,
            Number(price),
            imageUrl || null,
            String(sellerId),
            String(sellerName),
            minStock,
            harvestDate,
            lastUpdated,
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
        let {
            name,
            category,
            quantity,
            unit,
            price,
            imageUrl,
            sellerId,
            sellerName,
            minStock,
            harvestDate,
            lastUpdated,
        } = req.body;
        if (minStock === undefined || minStock === null) {
            minStock = 0;
        }
        if (price === undefined || price === null || Number.isNaN(Number(price))) {
            price = 0;
        }
        if (!sellerId || !sellerName) {
            return res.status(400).json({ error: 'sellerId and sellerName are required' });
        }
        const sql = `
            UPDATE products
            SET name=$1, category=$2, quantity=$3, unit=$4, price=$5, image_url=$6, seller_id=$7, seller_name=$8, minStock=$9, harvestDate=$10, lastUpdated=$11
            WHERE id=$12 AND workspace_id=$13
            RETURNING *
        `;

        const result = await pool.query(sql, [
            name,
            category,
            quantity,
            unit,
            Number(price),
            imageUrl || null,
            String(sellerId),
            String(sellerName),
            minStock,
            harvestDate,
            lastUpdated,
            req.params.id,
            workspaceId,
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
        const daysParam = Number(req.query.days || 14);
        const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 30) : 14;
        const productLimitParam = Number(req.query.product_limit || 12);
        const productLimit = Number.isFinite(productLimitParam) && productLimitParam > 0
            ? Math.min(productLimitParam, 20)
            : 12;

        const end = new Date();
        const start = new Date();
        start.setUTCDate(end.getUTCDate() - (days - 1));

        const dateKeys = listDateRange(formatDateKey(start), formatDateKey(end), 30);
        const products = await getTrackedMarketProducts(productLimit);

        const grouped = new Map(dateKeys.map((date) => [date, { date }]));

        await runWithConcurrency(products, 4, async (product) => {
            const dailyRows = await runWithConcurrency(dateKeys, 5, async (date) => {
                try {
                    const price = await getRealtimePrice(product.id, date, date);
                    if (!Number.isFinite(price?.avgPrice)) return null;
                    return {
                        date,
                        productName: normalizeMarketProductName(price.productName || product.name || product.id),
                        minPrice: Number.isFinite(price.minPrice) ? Number(price.minPrice) : Number(price.avgPrice),
                        maxPrice: Number.isFinite(price.maxPrice) ? Number(price.maxPrice) : Number(price.avgPrice),
                        avgPrice: Number(price.avgPrice),
                    };
                } catch {
                    return null;
                }
            });

            for (const row of dailyRows) {
                const target = grouped.get(row.date);
                if (!target || !row.productName) continue;
                target[row.productName] = row.avgPrice;
                target[`__min__${row.productName}`] = row.minPrice;
                target[`__max__${row.productName}`] = row.maxPrice;
            }

            return null;
        });

        const result = Array.from(grouped.values()).filter((row) => Object.keys(row).length > 1);
        res.json(result);
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
 * Get market product catalog for selector/search
 * GET /api/market-prices/products?limit=200
 */
app.get('/api/market-prices/products', async (req, res) => {
    try {
        const limit = Number(req.query.limit || 200);
        const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 2000) : 200;
        const products = await getTrackedMarketProducts(safeLimit);

        res.json(
            products.map((product) => ({
                id: String(product.id).toUpperCase(),
                name: normalizeMarketProductName(product.name || product.id),
            }))
        );
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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
            return res.status(400).json({ error: 'Invalid product ID format. Expected values like P11012' });
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
            return res.status(400).json({ error: 'Invalid product ID format. Expected values like P11012' });
        }
        
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const priceData = await fetchMarketPrice(product_id, today, today);
        res.json(priceData);
    } catch (err) {
        res.status(500).json({ error: err.message });
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

        if (!isAllowedMarketProductId(product_id)) {
            return res.status(400).json({ error: 'Invalid product ID format. Expected values like P11012' });
        }

        const end = String(to_date || new Date().toISOString().split('T')[0]);
        const startObj = new Date(`${end}T00:00:00.000Z`);
        startObj.setUTCDate(startObj.getUTCDate() - 13);
        const start = String(from_date || formatDateKey(startObj));

        const dateKeys = listDateRange(start, end, 45);
        const rows = await runWithConcurrency(dateKeys, 6, async (date) => {
            try {
                const price = await getRealtimePrice(product_id, date, date);
                if (!Number.isFinite(price?.avgPrice)) return null;
                return {
                    date,
                    product_id,
                    product_name: normalizeMarketProductName(price.productName || product_id),
                    min_price: Number.isFinite(price.minPrice) ? Number(price.minPrice) : Number(price.avgPrice),
                    max_price: Number.isFinite(price.maxPrice) ? Number(price.maxPrice) : Number(price.avgPrice),
                    avg_price: Number(price.avgPrice),
                    source: 'moc-realtime',
                };
            } catch {
                return null;
            }
        });

        if (rows.length === 0) {
            return res.status(404).json({ message: 'No price history found' });
        }

        rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
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
        const limit = Number(req.query.limit || 200);
        const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 92) : 40;
        const today = new Date().toISOString().split('T')[0];
        const products = await getTrackedMarketProducts(safeLimit);

        const rows = await runWithConcurrency(products, 6, async (product, index) => {
            try {
                const price = await getRealtimePrice(product.id, today, today);
                if (!Number.isFinite(price?.avgPrice)) return null;
                const productName = normalizeMarketProductName(price.productName || product.name || product.id);
                if (!productName) return null;
                return {
                    id: `${today}-${product.id}-${index}`,
                    date: today,
                    product_id: product.id,
                    product_name: productName,
                    min_price: Number.isFinite(price.minPrice) ? Number(price.minPrice) : Number(price.avgPrice),
                    max_price: Number.isFinite(price.maxPrice) ? Number(price.maxPrice) : Number(price.avgPrice),
                    avg_price: Number(price.avgPrice),
                    created_at: price.fetchedAt || new Date().toISOString(),
                    source: 'moc-realtime',
                };
            } catch {
                return null;
            }
        });

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
        const invalidId = product_ids.find((id) => !isAllowedMarketProductId(id));
        if (invalidId) {
            return res.status(400).json({
                error: `Unsupported product_id: ${invalidId}. Only P13001-P13092 are allowed`
            });
        }

        const rows = await runWithConcurrency(product_ids, 6, async (productId, index) => {
            try {
                const price = await getRealtimePrice(productId, date, date);
                if (!Number.isFinite(price?.avgPrice)) return null;
                return {
                    id: `${date}-${productId}-${index}`,
                    date,
                    product_id: productId,
                    product_name: normalizeMarketProductName(price.productName || productId),
                    min_price: Number.isFinite(price.minPrice) ? Number(price.minPrice) : Number(price.avgPrice),
                    max_price: Number.isFinite(price.maxPrice) ? Number(price.maxPrice) : Number(price.avgPrice),
                    avg_price: Number(price.avgPrice),
                    source: 'moc-realtime',
                };
            } catch {
                return null;
            }
        });
        
        res.json({
            date,
            products: rows,
            count: rows.length
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/market-prices/store', async (req, res) => {
    res.status(410).json({
        error: 'Market price storage endpoint has been removed. Use real-time market APIs instead.',
    });
});

app.post('/api/market-prices/maintenance/repair', async (req, res) => {
    res.status(410).json({
        error: 'Market price maintenance endpoint has been removed. Data is now fetched in real-time.',
    });
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
});
