const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL configuration. Prefer a single DATABASE_URL if provided,
// otherwise fall back to individual components.  Render (and many
// hosted Postgres services) expose a connection string like the one the
// user just provided.
const connectionString = process.env.DATABASE_URL;

// determine database name early so initializeDatabase can reference it
let dbName = process.env.DB_NAME;
if (!dbName && connectionString) {
    try {
        // extract pathname from connection string (/dbname)
        const url = new URL(connectionString);
        dbName = url.pathname.slice(1);
    } catch (_) {
        dbName = 'agricultural_db';
    }
}
if (!dbName) {
    dbName = 'agricultural_db';
}

let poolConfig;
if (connectionString) {
    console.log('Using DATABASE_URL for postgres connection');
    let ssl;
    try {
        const url = new URL(connectionString);
        const isRenderHost = /render\.com$/i.test(url.hostname);
        const sslMode = String(process.env.PGSSLMODE || '').toLowerCase();
        if (sslMode === 'disable') {
            ssl = undefined;
        } else if (isRenderHost || sslMode === 'require') {
            ssl = { rejectUnauthorized: false };
        }
    } catch (_) {
        ssl = undefined;
    }

    poolConfig = {
        connectionString,
        ...(ssl ? { ssl } : {}),
        max: 10
    };
} else {
    console.warn('WARNING: DATABASE_URL not set, falling back to individual DB_* variables (likely localhost)');
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    };

    poolConfig = {
        ...dbConfig,
        database: dbName,
        max: 10
    };
}

// pool connected to the application database (created/verified below)
const pool = new Pool(poolConfig);

// Initialize database tables
async function initializeDatabase() {
    try {
        // if a connection string was provided, assume the database already
        // exists and skip attempting to create it, since managed providers
        // usually do not allow creating databases from within the database.
        if (!connectionString) {
            // create the database if it doesn't exist by connecting to the default 'postgres' database
            const adminPool = new Pool({ host: process.env.DB_HOST || 'localhost',
                                           user: process.env.DB_USER || 'postgres',
                                           password: process.env.DB_PASSWORD || '',
                                           port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
                                           database: 'postgres' });
            await adminPool.query(`CREATE DATABASE "${dbName}"`).catch(err => {
                if (err.code === '42P04') {
                    // database already exists
                    console.log(`Database '${dbName}' already exists.`);
                } else {
                    throw err;
                }
            });
            await adminPool.end();
            console.log(`✅ Database '${dbName}' created/verified.`);
        } else {
            console.log('Using DATABASE_URL; skipping database creation step.');
        }

        let client;
        try {
            client = await pool.connect();
        } catch (connErr) {
            console.error('Failed to obtain a database connection:', connErr.message);
            throw connErr;
        }

        // create tables with Postgres syntax
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'farmer',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS workspaces (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                code VARCHAR(20) NOT NULL UNIQUE,
                owner_id VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS workspace_members (
                workspace_id VARCHAR(255) NOT NULL,
                user_id VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'employee',
                can_view BOOLEAN NOT NULL DEFAULT TRUE,
                can_add BOOLEAN NOT NULL DEFAULT FALSE,
                can_edit BOOLEAN NOT NULL DEFAULT FALSE,
                can_manage_permissions BOOLEAN NOT NULL DEFAULT FALSE,
                view_dashboard BOOLEAN NOT NULL DEFAULT TRUE,
                view_inventory BOOLEAN NOT NULL DEFAULT TRUE,
                view_summary BOOLEAN NOT NULL DEFAULT TRUE,
                view_calendar BOOLEAN NOT NULL DEFAULT TRUE,
                view_analysis BOOLEAN NOT NULL DEFAULT TRUE,
                view_price_comparison BOOLEAN NOT NULL DEFAULT TRUE,
                view_recommendations BOOLEAN NOT NULL DEFAULT TRUE,
                view_members BOOLEAN NOT NULL DEFAULT TRUE,
                view_activity BOOLEAN NOT NULL DEFAULT TRUE,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (workspace_id, user_id)
            );
        `);
        await client.query(`
            ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS can_view BOOLEAN;
        `);
        await client.query(`
            ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS can_add BOOLEAN;
        `);
        await client.query(`
            ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS can_edit BOOLEAN;
        `);
        await client.query(`
            ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS can_manage_permissions BOOLEAN;
        `);
        await client.query(`
            ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS view_dashboard BOOLEAN;
        `);
        await client.query(`
            ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS view_inventory BOOLEAN;
        `);
        await client.query(`
            ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS view_summary BOOLEAN;
        `);
        await client.query(`
            ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS view_calendar BOOLEAN;
        `);
        await client.query(`
            ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS view_analysis BOOLEAN;
        `);
        await client.query(`
            ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS view_price_comparison BOOLEAN;
        `);
        await client.query(`
            ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS view_recommendations BOOLEAN;
        `);
        await client.query(`
            ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS view_members BOOLEAN;
        `);
        await client.query(`
            ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS view_activity BOOLEAN;
        `);
        await client.query(`
            UPDATE workspace_members
            SET can_view = COALESCE(can_view, TRUE),
                can_add = COALESCE(can_add, CASE WHEN role = 'owner' THEN TRUE ELSE FALSE END),
                can_edit = COALESCE(can_edit, CASE WHEN role = 'owner' THEN TRUE ELSE FALSE END),
                can_manage_permissions = COALESCE(can_manage_permissions, CASE WHEN role = 'owner' THEN TRUE ELSE FALSE END),
                view_dashboard = COALESCE(view_dashboard, TRUE),
                view_inventory = COALESCE(view_inventory, TRUE),
                view_summary = COALESCE(view_summary, TRUE),
                view_calendar = COALESCE(view_calendar, TRUE),
                view_analysis = COALESCE(view_analysis, TRUE),
                view_price_comparison = COALESCE(view_price_comparison, TRUE),
                view_recommendations = COALESCE(view_recommendations, TRUE),
                view_members = COALESCE(view_members, TRUE),
                view_activity = COALESCE(view_activity, TRUE)
            WHERE can_view IS NULL
               OR can_add IS NULL
               OR can_edit IS NULL
               OR can_manage_permissions IS NULL
               OR view_dashboard IS NULL
               OR view_inventory IS NULL
               OR view_summary IS NULL
               OR view_calendar IS NULL
               OR view_analysis IS NULL
               OR view_price_comparison IS NULL
               OR view_recommendations IS NULL
               OR view_members IS NULL
               OR view_activity IS NULL;
        `);
        await client.query(`
            ALTER TABLE workspace_members ALTER COLUMN can_view SET NOT NULL;
        `);
        await client.query(`
            ALTER TABLE workspace_members ALTER COLUMN can_add SET NOT NULL;
        `);
        await client.query(`
            ALTER TABLE workspace_members ALTER COLUMN can_edit SET NOT NULL;
        `);
        await client.query(`
            ALTER TABLE workspace_members ALTER COLUMN can_manage_permissions SET NOT NULL;
        `);
        await client.query(`
            ALTER TABLE workspace_members ALTER COLUMN view_dashboard SET NOT NULL;
        `);
        await client.query(`
            ALTER TABLE workspace_members ALTER COLUMN view_inventory SET NOT NULL;
        `);
        await client.query(`
            ALTER TABLE workspace_members ALTER COLUMN view_summary SET NOT NULL;
        `);
        await client.query(`
            ALTER TABLE workspace_members ALTER COLUMN view_calendar SET NOT NULL;
        `);
        await client.query(`
            ALTER TABLE workspace_members ALTER COLUMN view_analysis SET NOT NULL;
        `);
        await client.query(`
            ALTER TABLE workspace_members ALTER COLUMN view_price_comparison SET NOT NULL;
        `);
        await client.query(`
            ALTER TABLE workspace_members ALTER COLUMN view_recommendations SET NOT NULL;
        `);
        await client.query(`
            ALTER TABLE workspace_members ALTER COLUMN view_members SET NOT NULL;
        `);
        await client.query(`
            ALTER TABLE workspace_members ALTER COLUMN view_activity SET NOT NULL;
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS products (
                id VARCHAR(255) PRIMARY KEY,
                workspace_id VARCHAR(255) NOT NULL DEFAULT 'default',
                name VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                quantity INT NOT NULL,
                unit VARCHAR(50) NOT NULL,
                price NUMERIC(10, 2) NOT NULL DEFAULT 0,
                image_url TEXT,
                seller_id VARCHAR(255) NOT NULL DEFAULT 'legacy',
                seller_name VARCHAR(255) NOT NULL DEFAULT 'ไม่ระบุผู้ขาย',
                minStock INT NOT NULL DEFAULT 0,
                harvestDate VARCHAR(255),
                lastUpdated VARCHAR(255) NOT NULL
            );
        `);
        // ensure default exists even if table was created earlier without it
        await client.query(`
            ALTER TABLE products ALTER COLUMN minStock SET DEFAULT 0;
        `);
        await client.query(`
            ALTER TABLE products ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(255);
        `);
        await client.query(`
            ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
        `);
        await client.query(`
            ALTER TABLE products ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2);
        `);
        await client.query(`
            ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_id VARCHAR(255);
        `);
        await client.query(`
            ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_name VARCHAR(255);
        `);
        await client.query(`
            UPDATE products SET workspace_id = 'default' WHERE workspace_id IS NULL;
        `);
        await client.query(`
            UPDATE products
            SET price = COALESCE(price, 0),
                seller_id = COALESCE(seller_id, 'legacy'),
                seller_name = COALESCE(NULLIF(seller_name, ''), 'ไม่ระบุผู้ขาย')
            WHERE price IS NULL
               OR seller_id IS NULL
               OR seller_name IS NULL
               OR seller_name = '';
        `);
        await client.query(`
            ALTER TABLE products ALTER COLUMN workspace_id SET NOT NULL;
        `);
        await client.query(`
            ALTER TABLE products ALTER COLUMN price SET DEFAULT 0;
        `);
        await client.query(`
            ALTER TABLE products ALTER COLUMN price SET NOT NULL;
        `);
        await client.query(`
            ALTER TABLE products ALTER COLUMN seller_id SET NOT NULL;
        `);
        await client.query(`
            ALTER TABLE products ALTER COLUMN seller_name SET NOT NULL;
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS schedules (
                id VARCHAR(255) PRIMARY KEY,
                workspace_id VARCHAR(255) NOT NULL DEFAULT 'default',
                cropName VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                plantingDate VARCHAR(255) NOT NULL,
                harvestDate VARCHAR(255) NOT NULL,
                area DECIMAL(10, 2) NOT NULL,
                estimatedYield DECIMAL(10, 2),
                status VARCHAR(50) NOT NULL,
                notes TEXT
            );
        `);
        await client.query(`
            ALTER TABLE schedules ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(255);
        `);
        await client.query(`
            UPDATE schedules SET workspace_id = 'default' WHERE workspace_id IS NULL;
        `);
        await client.query(`
            ALTER TABLE schedules ALTER COLUMN workspace_id SET NOT NULL;
        `);

        // Market price data is now fetched in real time from MOC API, not persisted locally.
        await client.query('DROP TABLE IF EXISTS price_history;');
        await client.query('DROP TABLE IF EXISTS market_prices;');

        await client.query(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id VARCHAR(255) PRIMARY KEY,
                workspace_id VARCHAR(255) NOT NULL DEFAULT 'default',
                action VARCHAR(100) NOT NULL,
                type VARCHAR(50) NOT NULL,
                itemName VARCHAR(255) NOT NULL,
                "user" VARCHAR(255) NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                details TEXT NOT NULL
            );
        `);
        await client.query(`
            ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(255);
        `);
        await client.query(`
            UPDATE activity_logs SET workspace_id = 'default' WHERE workspace_id IS NULL;
        `);
        await client.query(`
            ALTER TABLE activity_logs ALTER COLUMN workspace_id SET NOT NULL;
        `);
        // ensure existing column is timestamp and convert if necessary
        await client.query(`
            ALTER TABLE activity_logs
            ALTER COLUMN timestamp TYPE TIMESTAMP USING timestamp::timestamp;
        `);

        console.log('Database tables created/verified successfully.');
        await seedData(client);
        client.release();
    } catch (err) {
        console.error('Error initializing database:', err.message);
        console.error('Full error:', err);
        // let the app continue anyway
    }
}

async function seedData(client) {
    try {
        const usersResult = await client.query('SELECT COUNT(*) as count FROM users');
        if (parseInt(usersResult.rows[0].count, 10) === 0) {
            const initialUsers = [
                ["สมชาย เกษตรกร", "farmer@example.com", "password123", "farmer"]
            ];
            for (const user of initialUsers) {
                await client.query(
                    'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
                    user
                );
            }
            console.log('Seeded users data.');
        }

        // product, schedule, and price history seeding removed

    } catch (err) {
        console.error('Error seeding data:', err.message);
    }
}

// Initialize database on startup
initializeDatabase();

module.exports = pool;
