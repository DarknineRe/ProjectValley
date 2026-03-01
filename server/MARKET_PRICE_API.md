# Market Price API Documentation

This backend integrates real market prices from Thailand's **Ministry of Commerce (MOC) Open Data API** to provide live agricultural product pricing information.

Primary upstream source used by backend:
- `https://dataapi.moc.go.th/gis-product-price`

Fallback source (for compatibility):
- `https://data.moc.go.th/OpenData/GISProductPrice`

## API Endpoints

### 1. Fetch Real-Time Market Price
Fetch current market prices from MOC Thailand API

**Endpoint:**
```
GET /api/market-prices?product_id=P11012&from_date=2026-02-27&to_date=2026-02-28
```

**Query Parameters:**
- `product_id` (required) - MOC Product ID (e.g., "P11012" for chicken)
- `from_date` (required) - Start date in YYYY-MM-DD format
- `to_date` (required) - End date in YYYY-MM-DD format

**Response Example:**
```json
{
  "productId": "P11012",
  "productName": "ไก่สดชำแหละ เนื้ออก (เนื้อล้วน)",
  "minPrice": 80.00,
  "maxPrice": 90.00,
  "avgPrice": 85.00,
  "fromDate": "2026-02-27",
  "toDate": "2026-02-28",
  "fetchedAt": "2026-02-28T10:30:00.000Z"
}
```

---

### 2. Get Today's Market Price
Quick endpoint to get market price for today

**Endpoint:**
```
GET /api/market-prices/today?product_id=P11012
```

**Query Parameters:**
- `product_id` (required) - MOC Product ID

**Response:**
Same as above, but for today's date

---

### 3. Store Market Price in Database
Save fetched market prices to your database for historical tracking

**Endpoint:**
```
POST /api/market-prices/store
```

**Request Body:**
```json
{
  "date": "2026-02-28",
  "productId": "P11012",
  "productName": "ไก่สดชำแหละ",
  "minPrice": 80.00,
  "maxPrice": 90.00,
  "avgPrice": 85.00
}
```

**Response:**
```json
{
  "message": "Market price stored successfully",
  "date": "2026-02-28",
  "productId": "P11012",
  "avgPrice": 85.00
}
```

---

### 4. Get Market Price History
Retrieve historical market prices for a product

**Endpoint:**
```
GET /api/market-prices/history/:product_id?from_date=2026-02-01&to_date=2026-02-28
```

**URL Parameters:**
- `product_id` - MOC Product ID

**Query Parameters:**
- `from_date` (optional) - Start date in YYYY-MM-DD format
- `to_date` (optional) - End date in YYYY-MM-DD format

**Response:**
```json
[
  {
    "id": 1,
    "date": "2026-02-28",
    "product_id": "P11012",
    "product_name": "ไก่สดชำแหละ",
    "min_price": 80.00,
    "max_price": 90.00,
    "avg_price": 85.00,
    "created_at": "2026-02-28T10:30:00.000Z"
  },
  ...
]
```

---

### 5. Compare Prices Across Products
Compare market prices for multiple products on the same date

**Endpoint:**
```
POST /api/market-prices/compare
```

**Request Body:**
```json
{
  "date": "2026-02-28",
  "product_ids": ["P11012", "P14001", "P12005"]
}
```

**Response:**
```json
{
  "date": "2026-02-28",
  "products": [
    {
      "id": 1,
      "date": "2026-02-28",
      "product_id": "P11012",
      "product_name": "ไก่สดชำแหละ",
      "avg_price": 85.00
    },
    {
      "id": 2,
      "date": "2026-02-28",
      "product_id": "P14001",
      "product_name": "มะม่วง",
      "avg_price": 65.00
    }
  ],
  "count": 2
}
```

---

## Common Product IDs (MOC Thailand)

| Code | Product (Thai) | Category |
|------|---|---|
| P11012 | ไก่สดชำแหละ เนื้ออก | Meat |
| P11001 | ข้าวเหนียว | Rice |
| P14001 | มะม่วง | Fruit |
| P12005 | มะเขือเทศ | Vegetables |
| P12001 | กะหล่ำปลี | Vegetables |

---

## Usage Examples

### 1. Fetch Today's Chicken Price and Store It
```javascript
// Frontend/Script
const productId = 'P11012';

// Fetch from MOC API
const priceData = await fetch(`/api/market-prices/today?product_id=${productId}`)
  .then(r => r.json());

// Store in database
await fetch('/api/market-prices/store', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    date: priceData.toDate,
    productId: priceData.productId,
    productName: priceData.productName,
    minPrice: priceData.minPrice,
    maxPrice: priceData.maxPrice,
    avgPrice: priceData.avgPrice
  })
});
```

### 2. Get Price History for the Last 7 Days
```javascript
const productId = 'P11012';
const today = new Date();
const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

const history = await fetch(
  `/api/market-prices/history/${productId}?from_date=${sevenDaysAgo.toISOString().split('T')[0]}&to_date=${today.toISOString().split('T')[0]}`
).then(r => r.json());

console.log(history);
```

### 3. Compare Multiple Products
```javascript
const comparison = await fetch('/api/market-prices/compare', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    date: '2026-02-28',
    product_ids: ['P11012', 'P14001', 'P12005', 'P12001']
  })
}).then(r => r.json());

console.log(comparison);
```

---

## Database Schema

```sql
CREATE TABLE market_prices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    product_id VARCHAR(50) NOT NULL,
    product_name VARCHAR(255),
    min_price DECIMAL(10, 2),
    max_price DECIMAL(10, 2),
    avg_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_date_product (date, product_id)
);
```

---

## Notes

- **Data Source**: Ministry of Commerce Thailand Open Data API (`dataapi.moc.go.th/gis-product-price`)
- **Update Frequency**: Daily
- **Duplicate Handling**: `ON DUPLICATE KEY UPDATE` prevents duplicate entries for the same product and date
- **Rate Limiting**: MOC API may have rate limiting; implement appropriate delays between requests
- **Error Handling**: Always wrap API calls in try-catch blocks

