const https = require('https');

const PRIMARY_API_BASE = 'https://dataapi.moc.go.th/gis-product-price';
const FALLBACK_API_BASE = 'https://data.moc.go.th/OpenData/GISProductPrice';

/**
 * Fetch market prices from Thailand MOC Open Data API
 * @param {string} productId - Product ID (e.g., "P11012")
 * @param {string} fromDate - Start date (YYYY-MM-DD)
 * @param {string} toDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Market price data
 */
function fetchMarketPrice(productId, fromDate, toDate) {
    return new Promise((resolve, reject) => {
        const query = `product_id=${encodeURIComponent(productId)}&from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}&task=search`;
        const urls = [
            `${PRIMARY_API_BASE}?${query}`,
            `${FALLBACK_API_BASE}?${query}`
        ];

        const parseAsNumber = (value) => {
            if (value === null || value === undefined) return null;
            const numeric = Number(String(value).replace(/,/g, ''));
            return Number.isFinite(numeric) ? numeric : null;
        };

        const parseFromJson = (payload) => {
            const first = Array.isArray(payload)
                ? payload[0]
                : (payload?.data?.[0] || payload?.result?.[0] || payload?.rows?.[0] || payload);

            if (!first || typeof first !== 'object') return null;

            const productName = first.product_name || first.productName || first.name || first.product || 'Unknown';
            const minPrice = parseAsNumber(first.min_price ?? first.minPrice ?? first.low_price ?? first.lowPrice);
            const maxPrice = parseAsNumber(first.max_price ?? first.maxPrice ?? first.high_price ?? first.highPrice);
            const avgPrice = parseAsNumber(
                first.avg_price ?? first.avgPrice ?? first.price_avg ?? first.priceAvg ??
                ((minPrice !== null && maxPrice !== null) ? (minPrice + maxPrice) / 2 : null)
            );

            if (avgPrice === null && minPrice === null && maxPrice === null) return null;

            return {
                productId,
                productName,
                minPrice,
                maxPrice,
                avgPrice,
                fromDate,
                toDate,
                fetchedAt: new Date().toISOString()
            };
        };

        const parseFromHtml = (html) => {
            const minPriceMatch = html.match(/ราคาต่ำสุดเฉลี่ย[^0-9]*([0-9.]+)/);
            const maxPriceMatch = html.match(/ราคาสูงสุดเฉลี่ย[^0-9]*([0-9.]+)/);
            const productNameMatch = html.match(/ชื่อสินค้า[^<]*<[^>]*>([^<]+)</);

            const minPrice = minPriceMatch ? parseFloat(minPriceMatch[1]) : null;
            const maxPrice = maxPriceMatch ? parseFloat(maxPriceMatch[1]) : null;
            const avgPrice = minPrice !== null && maxPrice !== null ? (minPrice + maxPrice) / 2 : null;

            return {
                productId,
                productName: productNameMatch ? productNameMatch[1].trim() : 'Unknown',
                minPrice,
                maxPrice,
                avgPrice,
                fromDate,
                toDate,
                fetchedAt: new Date().toISOString()
            };
        };

        const tryFetch = (index) => {
            if (index >= urls.length) {
                return reject(new Error('Failed to fetch market price from all configured MOC endpoints'));
            }

            const request = https.get(
                urls[index],
                {
                    headers: {
                        Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
                        'User-Agent': 'ProjectValley/1.0'
                    },
                    timeout: 15000
                },
                (res) => {
                    let data = '';

                    res.on('data', (chunk) => {
                        data += chunk;
                    });

                    res.on('end', () => {
                        try {
                            if (res.statusCode && res.statusCode >= 400) {
                                return tryFetch(index + 1);
                            }

                            let result = null;
                            const contentType = String(res.headers['content-type'] || '').toLowerCase();

                            if (contentType.includes('application/json')) {
                                result = parseFromJson(JSON.parse(data));
                            } else {
                                try {
                                    result = parseFromJson(JSON.parse(data));
                                } catch {
                                    result = parseFromHtml(data);
                                }
                            }

                            if (!result) {
                                return tryFetch(index + 1);
                            }

                            resolve(result);
                        } catch (err) {
                            tryFetch(index + 1);
                        }
                    });
                }
            );

            request.on('timeout', () => {
                request.destroy(new Error('Request timeout'));
            });

            request.on('error', () => {
                tryFetch(index + 1);
            });
        };

        tryFetch(0);
    });
}

// Thai product IDs and their mapping to local crop names
const PRODUCT_MAP = {
    'P11012': { name: 'ไก่สดชำแหละ', localName: 'ไก่' },
    'P11001': { name: 'ข้าวเหนียว', localName: 'ข้าว' },
    'P14001': { name: 'มะม่วง', localName: 'มะม่วงน้ำดอกไม้' },
    'P12005': { name: 'มะเขือเทศ', localName: 'มะเขือเทศ' },
    'P12001': { name: 'กะหล่ำปลี', localName: 'ผักกาดหอม' },
};

module.exports = {
    fetchMarketPrice,
    PRODUCT_MAP
};