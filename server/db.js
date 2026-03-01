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
            CREATE TABLE IF NOT EXISTS products (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                quantity INT NOT NULL,
                unit VARCHAR(50) NOT NULL,
                minStock INT NOT NULL,
                harvestDate VARCHAR(255),
                lastUpdated VARCHAR(255) NOT NULL
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS schedules (
                id VARCHAR(255) PRIMARY KEY,
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
            CREATE TABLE IF NOT EXISTS price_history (
                id SERIAL PRIMARY KEY,
                date VARCHAR(50) NOT NULL,
                cropData JSON NOT NULL
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS market_prices (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                product_id VARCHAR(50) NOT NULL,
                product_name VARCHAR(255),
                min_price DECIMAL(10, 2),
                max_price DECIMAL(10, 2),
                avg_price DECIMAL(10, 2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (date, product_id)
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id VARCHAR(255) PRIMARY KEY,
                action VARCHAR(100) NOT NULL,
                type VARCHAR(50) NOT NULL,
                itemName VARCHAR(255) NOT NULL,
                "user" VARCHAR(255) NOT NULL,
                timestamp VARCHAR(255) NOT NULL,
                details TEXT NOT NULL
            );
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

        const productsResult = await client.query('SELECT COUNT(*) as count FROM products');
        if (parseInt(productsResult.rows[0].count, 10) === 0) {
            const initialProducts = [
                ["1", "ข้าวหอมมะลิ", "ข้าว", 1500, "กิโลกรัม", 200, "2026-10-30T00:00:00.000Z", "2026-02-20T00:00:00.000Z"],
                ["2", "มะม่วงน้ำดอกไม้", "ผลไม้", 85, "กิโลกรัม", 30, "2026-03-31T00:00:00.000Z", "2026-02-23T00:00:00.000Z"],
                ["3", "ผักกาดหอม", "ผักสด", 45, "กิโลกรัม", 20, "2026-02-15T00:00:00.000Z", "2026-02-23T00:00:00.000Z"],
                ["4", "มะเขือเทศ", "ผักสด", 120, "กิโลกรัม", 40, "2026-03-25T00:00:00.000Z", "2026-02-22T00:00:00.000Z"],
                ["5", "กล้วยหอม", "ผลไม้", 180, "หวี", 50, "2026-02-10T00:00:00.000Z", "2026-02-21T00:00:00.000Z"],
                ["6", "มันฝรั่ง", "พืชผล", 350, "กิโลกรัม", 100, "2026-03-01T00:00:00.000Z", "2026-02-19T00:00:00.000Z"]
            ];
            for (const product of initialProducts) {
                await client.query(
                    'INSERT INTO products (id, name, category, quantity, unit, minStock, harvestDate, lastUpdated) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                    product
                );
            }
            console.log('Seeded products data.');
        }

        const schedulesResult = await client.query('SELECT COUNT(*) as count FROM schedules');
        if (parseInt(schedulesResult.rows[0].count, 10) === 0) {
            const initialSchedules = [
                ["1", "ข้าวหอมมะลิ", "ข้าว", "2026-05-01T00:00:00.000Z", "2026-09-30T00:00:00.000Z", 10, 5000, "planned", "เตรียมพื้นที่และปรับสภาพดินให้พร้อม"],
                ["2", "มะม่วงน้ำดอกไม้", "ผลไม้", "2026-01-15T00:00:00.000Z", "2026-04-30T00:00:00.000Z", 5, 800, "planted", "ดูแลรักษาและให้น้ำสม่ำเสมอ"],
                ["3", "ผักกาดหอม", "ผักสด", "2026-01-10T00:00:00.000Z", "2026-02-20T00:00:00.000Z", 2, 300, "harvested", "เก็บเกี่ยวเสร็จแล้ว คุณภาพดี"]
            ];
            for (const schedule of initialSchedules) {
                await client.query(
                    'INSERT INTO schedules (id, cropName, category, plantingDate, harvestDate, area, estimatedYield, status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                    schedule
                );
            }
            console.log('Seeded schedules data.');
        }

        const priceHistoryResult = await client.query('SELECT COUNT(*) as count FROM price_history');
        if (parseInt(priceHistoryResult.rows[0].count, 10) === 0) {
            const initialPriceHistory = [
                ["2026-01", JSON.stringify({"ข้าวหอมมะลิ": 25, "มะม่วงน้ำดอกไม้": 55, "ผักกาดหอม": 32, "มะเขือเทศ": 18, "กล้วยหอม": 22})],
                ["2026-02", JSON.stringify({"ข้าวหอมมะลิ": 26, "มะม่วงน้ำดอกไม้": 60, "ผักกาดหอม": 35, "มะเขือเทศ": 20, "กล้วยหอม": 25})],
                ["2026-03", JSON.stringify({"ข้าวหอมมะลิ": 24, "มะม่วงน้ำดอกไม้": 65, "ผักกาดหอม": 30, "มะเขือเทศ": 22, "กล้วยหอม": 28})]
            ];
            for (const price of initialPriceHistory) {
                await client.query(
                    'INSERT INTO price_history (date, cropData) VALUES ($1, $2)',
                    price
                );
            }
            console.log('Seeded price history data.');
        }
    } catch (err) {
        console.error('Error seeding data:', err.message);
    }
}

// Initialize database on startup
initializeDatabase();

module.exports = pool;
