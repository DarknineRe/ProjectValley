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
    poolConfig = {
        connectionString,
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
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (workspace_id, user_id)
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS products (
                id VARCHAR(255) PRIMARY KEY,
                workspace_id VARCHAR(255) NOT NULL DEFAULT 'default',
                name VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                quantity INT NOT NULL,
                unit VARCHAR(50) NOT NULL,
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
            UPDATE products SET workspace_id = 'default' WHERE workspace_id IS NULL;
        `);
        await client.query(`
            ALTER TABLE products ALTER COLUMN workspace_id SET NOT NULL;
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

        await client.query(`
            CREATE TABLE IF NOT EXISTS price_history (
                id SERIAL PRIMARY KEY,
                workspace_id VARCHAR(255) NOT NULL DEFAULT 'default',
                date VARCHAR(50) NOT NULL,
                cropData JSON NOT NULL
            );
        `);
        await client.query(`
            ALTER TABLE price_history ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(255);
        `);
        await client.query(`
            UPDATE price_history SET workspace_id = 'default' WHERE workspace_id IS NULL;
        `);
        await client.query(`
            ALTER TABLE price_history ALTER COLUMN workspace_id SET NOT NULL;
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS market_prices (
                id SERIAL PRIMARY KEY,
                workspace_id VARCHAR(255) NOT NULL DEFAULT 'default',
                date DATE NOT NULL,
                product_id VARCHAR(50) NOT NULL,
                product_name VARCHAR(255),
                min_price DECIMAL(10, 2),
                max_price DECIMAL(10, 2),
                avg_price DECIMAL(10, 2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (workspace_id, date, product_id)
            );
        `);
        await client.query(`
            ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(255);
        `);
        await client.query(`
            UPDATE market_prices SET workspace_id = 'default' WHERE workspace_id IS NULL;
        `);
        await client.query(`
            ALTER TABLE market_prices ALTER COLUMN workspace_id SET NOT NULL;
        `);
        await client.query(`
            ALTER TABLE market_prices DROP CONSTRAINT IF EXISTS market_prices_date_product_id_key;
        `);
        await client.query(`
            ALTER TABLE market_prices DROP CONSTRAINT IF EXISTS market_prices_workspace_date_product_key;
        `);
        await client.query(`
            ALTER TABLE market_prices ADD CONSTRAINT market_prices_workspace_date_product_key UNIQUE (workspace_id, date, product_id);
        `);

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
                ["สมชาย เกษตรกร", "farmer@example.com", "password123", "farmer"],
                ["ศรีสมหมาย เกษตรกร", "srisommai@example.com", "password123", "farmer"],
                ["admin", "admin@example.com", "admin123", "admin"]
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
