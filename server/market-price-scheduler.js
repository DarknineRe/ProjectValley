/**
 * Market Price Scheduler
 * Automatically fetches and stores real market prices from MOC Thailand API
 * 
 * Usage in your main index.js:
 * const scheduler = require('./market-price-scheduler');
 * scheduler.startScheduler(); // Runs daily at 6 AM
 */

const { fetchMarketPrice, PRODUCT_MAP, fetchProductCatalog } = require('./market-price-service');
const pool = require('./db');
const SYSTEM_WORKSPACE_ID = 'default';

const CORE_PRODUCTS = [];

const EXTRA_P13_PRODUCTS = Array.from({ length: 92 }, (_, i) => {
    const sequence = String(i + 1).padStart(3, '0');
    const id = `P13${sequence}`;
    return { id, name: id };
});

function normalizeMarketProductName(name) {
    return String(name || '')
        .replace(/\s+(คละ|คัด)(?=\s*\(|$)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function isAllowedProduct(product) {
    const id = String(product?.id || '');
    return /^P13(00[1-9]|0[1-8][0-9]|09[0-2])$/i.test(id);
}

async function getProductsToTrack() {
    const limit = Number(process.env.MARKET_PRICE_TRACK_LIMIT || 20);
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 80) : 20;

    try {
        const catalogProducts = await fetchProductCatalog(safeLimit);
        const combined = [
            ...CORE_PRODUCTS,
            ...EXTRA_P13_PRODUCTS,
            ...catalogProducts.filter(isAllowedProduct),
        ];
        const unique = [];
        const seen = new Set();

        for (const product of combined) {
            if (!product?.id || !isAllowedProduct(product) || seen.has(product.id)) continue;
            seen.add(product.id);
            unique.push(product);
        }

        if (unique.length > 0) {
            console.log(`[Market Price Scheduler] Tracking ${unique.length} vegetable products (P13001-P13092)`);
            return unique;
        }
    } catch (err) {
        console.warn('[Market Price Scheduler] Failed to load product catalog, using core products only:', err.message);
    }

    return CORE_PRODUCTS;
}

/**
 * Fetch and store market prices for all tracked products
 */
async function fetchAndStoreMarketPrices(date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const productsToTrack = await getProductsToTrack();
    
    console.log(`[Market Price Scheduler] Fetching prices for ${targetDate}...`);
    
    for (const product of productsToTrack) {
        try {
            console.log(`  Fetching ${product.name} (${product.id})...`);
            
            const priceData = await fetchMarketPrice(product.id, targetDate, targetDate);

            const suspiciousFlatPrice =
                Number(priceData.minPrice) === 5 &&
                Number(priceData.maxPrice) === 5 &&
                Number(priceData.avgPrice) === 5;

            if (suspiciousFlatPrice) {
                console.log(`    ✗ Skipped suspicious placeholder price for ${product.name}`);
                continue;
            }
            
            if (priceData.avgPrice !== null) {
                const productNameToStore =
                    (priceData.productName && String(priceData.productName).trim())
                        ? priceData.productName
                        : product.name;
                const normalizedNameToStore = normalizeMarketProductName(productNameToStore);

                // Store in database
                const sql = `
                    INSERT INTO market_prices (workspace_id, date, product_id, product_name, min_price, max_price, avg_price) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (workspace_id, date, product_id) DO UPDATE SET
                        product_name = COALESCE(NULLIF(EXCLUDED.product_name, ''), market_prices.product_name),
                        min_price = EXCLUDED.min_price,
                        max_price = EXCLUDED.max_price,
                        avg_price = EXCLUDED.avg_price
                `;
                
                await pool.query(sql, [
                    SYSTEM_WORKSPACE_ID,
                    targetDate,
                    priceData.productId,
                    normalizedNameToStore,
                    priceData.minPrice,
                    priceData.maxPrice,
                    priceData.avgPrice
                ]);
                
                console.log(`    ✓ Stored: ${product.name} @ ${priceData.avgPrice} บาท/unit`);
            } else {
                console.log(`    ✗ No data available for ${product.name}`);
            }
        } catch (err) {
            console.error(`    ✗ Error fetching ${product.name}:`, err.message);
        }
    }
    
    console.log(`[Market Price Scheduler] Completed for ${targetDate}`);
}

/**
 * Schedule automatic price fetching
 * Default: Runs daily at 6:00 AM
 */
function startScheduler(hourOfDay = 6, minuteOfDay = 0) {
    console.log(`[Market Price Scheduler] Starting scheduler (runs daily at ${hourOfDay}:${String(minuteOfDay).padStart(2, '0')})`);
    
    // Run immediately on startup
    fetchAndStoreMarketPrices().catch(console.error);
    
    // Calculate time until next scheduled run
    function scheduleNextRun() {
        const now = new Date();
        const targetTime = new Date();
        
        targetTime.setHours(hourOfDay, minuteOfDay, 0, 0);
        
        // If target time has already passed today, schedule for tomorrow
        if (targetTime <= now) {
            targetTime.setDate(targetTime.getDate() + 1);
        }
        
        const msUntilRun = targetTime.getTime() - now.getTime();
        
        console.log(`[Market Price Scheduler] Next run scheduled for ${targetTime.toLocaleString()}`);
        
        setTimeout(() => {
            fetchAndStoreMarketPrices().catch(console.error);
            scheduleNextRun(); // Schedule the next run
        }, msUntilRun);
    }
    
    scheduleNextRun();
}

/**
 * Fetch prices for a specific date manually
 */
async function fetchPricesForDate(date) {
    try {
        await fetchAndStoreMarketPrices(date);
    } catch (err) {
        console.error('Error fetching prices for date:', err.message);
        throw err;
    }
}

/**
 * Backfill prices for an inclusive date range (YYYY-MM-DD to YYYY-MM-DD)
 */
async function backfillPricesInRange(fromDate, toDate) {
    if (!fromDate || !toDate) {
        throw new Error('fromDate and toDate are required');
    }

    const from = new Date(`${fromDate}T00:00:00.000Z`);
    const to = new Date(`${toDate}T00:00:00.000Z`);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        throw new Error('Invalid date format, expected YYYY-MM-DD');
    }

    if (from > to) {
        throw new Error('fromDate must be earlier than or equal to toDate');
    }

    const current = new Date(from);
    while (current <= to) {
        const day = current.toISOString().split('T')[0];
        await fetchAndStoreMarketPrices(day);
        current.setUTCDate(current.getUTCDate() + 1);
    }
}

/**
 * Get available product IDs
 */
function getAvailableProducts() {
    return [...CORE_PRODUCTS, ...EXTRA_P13_PRODUCTS].map(p => ({
        id: p.id,
        name: p.name
    }));
}

module.exports = {
    startScheduler,
    fetchAndStoreMarketPrices,
    fetchPricesForDate,
    backfillPricesInRange,
    getAvailableProducts
};
