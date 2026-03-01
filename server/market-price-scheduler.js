/**
 * Market Price Scheduler
 * Automatically fetches and stores real market prices from MOC Thailand API
 * 
 * Usage in your main index.js:
 * const scheduler = require('./market-price-scheduler');
 * scheduler.startScheduler(); // Runs daily at 6 AM
 */

const { fetchMarketPrice, PRODUCT_MAP } = require('./market-price-service');
const pool = require('./db');
const SYSTEM_WORKSPACE_ID = 'default';

// List of products to track
const PRODUCTS_TO_TRACK = [
    { id: 'P11012', name: 'ไก่สดชำแหละ' },
    { id: 'P11001', name: 'ข้าวเหนียว' },
    { id: 'P14001', name: 'มะม่วง' },
    { id: 'P12005', name: 'มะเขือเทศ' },
    { id: 'P12001', name: 'กะหล่ำปลี' },
];

/**
 * Fetch and store market prices for all tracked products
 */
async function fetchAndStoreMarketPrices(date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    console.log(`[Market Price Scheduler] Fetching prices for ${targetDate}...`);
    
    for (const product of PRODUCTS_TO_TRACK) {
        try {
            console.log(`  Fetching ${product.name} (${product.id})...`);
            
            const priceData = await fetchMarketPrice(product.id, targetDate, targetDate);
            
            if (priceData.avgPrice !== null) {
                // Store in database
                const sql = `
                    INSERT INTO market_prices (workspace_id, date, product_id, product_name, min_price, max_price, avg_price) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (workspace_id, date, product_id) DO UPDATE SET
                        min_price = EXCLUDED.min_price,
                        max_price = EXCLUDED.max_price,
                        avg_price = EXCLUDED.avg_price
                `;
                
                await pool.query(sql, [
                    SYSTEM_WORKSPACE_ID,
                    targetDate,
                    priceData.productId,
                    priceData.productName,
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
 * Get available product IDs
 */
function getAvailableProducts() {
    return PRODUCTS_TO_TRACK.map(p => ({
        id: p.id,
        name: p.name
    }));
}

module.exports = {
    startScheduler,
    fetchAndStoreMarketPrices,
    fetchPricesForDate,
    getAvailableProducts
};
