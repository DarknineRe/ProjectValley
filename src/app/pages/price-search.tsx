import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Calendar, Search, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { API_BASE } from "../../api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
});

function getDateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

interface PriceData {
  product_id: string;
  product_name: string;
  market_name?: string;
  avg_price?: number;
  min_price?: number;
  max_price?: number;
  date: string;
  unit?: string;
}

interface ProductOption {
  id: string;
  name: string;
}

export function PriceSearch() {
  const [productId, setProductId] = useState("");
  const [productSearchText, setProductSearchText] = useState("");
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [fromDate, setFromDate] = useState(() => getDateOffset(-7));
  const [toDate, setToDate] = useState(() => getDateOffset(0));
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [searchResults, setSearchResults] = useState<PriceData[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      setIsLoadingProducts(true);
      try {
        const base = API_BASE;
        const response = await fetch(`${base}/api/market-prices/products?limit=2000`);
        if (!response.ok) {
          throw new Error("ไม่สามารถโหลดรายการสินค้าได้");
        }

        const data = await response.json();
        if (cancelled) return;

        const normalized: ProductOption[] = Array.isArray(data)
          ? data
              .map((item) => ({
                id: String(item.id || "").toUpperCase(),
                name: String(item.name || item.id || "").trim(),
              }))
              .filter((item) => item.id.length > 0)
              .sort((left, right) => left.name.localeCompare(right.name, "th"))
          : [];

        setProducts(normalized);
      } catch (error: any) {
        if (!cancelled) {
          toast.error(error.message || "โหลดรายการสินค้าไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProducts(false);
        }
      }
    };

    loadProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const q = productSearchText.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (product) =>
        product.id.toLowerCase().includes(q) ||
        product.name.toLowerCase().includes(q)
    );
  }, [products, productSearchText]);

  const visibleProductOptions = useMemo(
    () => filteredProducts.slice(0, 100),
    [filteredProducts]
  );

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId) || null,
    [productId, products]
  );

  const resultSummary = useMemo(() => {
    if (searchResults.length === 0) {
      return null;
    }

    const prices = searchResults
      .map((item) => item.avg_price ?? item.min_price ?? item.max_price)
      .filter((price): price is number => typeof price === "number" && Number.isFinite(price));

    if (prices.length === 0) {
      return null;
    }

    const total = prices.reduce((sum, price) => sum + price, 0);
    return {
      average: total / prices.length,
      lowest: Math.min(...prices),
      highest: Math.max(...prices),
    };
  }, [searchResults]);

  const handleSearch = async () => {
    if (!productId || !fromDate || !toDate) {
      toast.error("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    if (fromDate > toDate) {
      toast.error("วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด");
      return;
    }

    setIsLoading(true);
    try {
      const base = API_BASE;
      const url = `${base}/api/market-prices/history/${productId}?from_date=${fromDate}&to_date=${toDate}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || error?.message || "ไม่สามารถดึงข้อมูลราคาได้");
      }

      const data = await response.json();
      setSearchResults(Array.isArray(data) ? data : []);
      setHasSearched(true);
      
      if (Array.isArray(data) && data.length === 0) {
        toast.info("ไม่พบข้อมูลราคา");
      } else {
        toast.success("ค้นหาราคาสำเร็จ");
      }
    } catch (error: any) {
      toast.error(error.message || "เกิดข้อผิดพลาด");
      setSearchResults([]);
      setHasSearched(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (searchResults.length === 0) {
      toast.error("ไม่มีข้อมูลให้ส่งออก");
      return;
    }

    const csv = [
      ["รหัสสินค้า", "ชื่อสินค้า", "ตลาด", "ราคา", "สกุลเงิน", "หน่วย", "วันที่"],
      ...searchResults.map((item) => [
        item.product_id,
        item.product_name,
        item.market_name || "MOC Realtime",
        item.avg_price ?? item.min_price ?? item.max_price ?? 0,
        "THB",
        item.unit || "กก.",
        item.date,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `price-search-${new Date().toISOString()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("ส่งออกข้อมูลเรียบร้อย");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-lg border border-blue-100">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-6 w-6 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">ค้นหาราคาสินค้า</h1>
        </div>
        <p className="text-gray-600">ค้นหาข้อมูลราคาย้อนหลังจากตลาดกลางของกระทรวงพาณิชย์ พร้อมช่วงวันที่ที่ต้องการเปรียบเทียบ</p>
      </div>

      {/* Search Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <Label className="text-sm font-medium mb-2 block">เลือกสินค้า</Label>
          <Input
            value={productSearchText}
            onChange={(e) => {
              setProductSearchText(e.target.value);
              setProductId("");
            }}
            placeholder="พิมพ์ชื่อหรือรหัสสินค้า เช่น ข้าว มะม่วง P11012"
            className="mb-2"
          />
          <Select
            value={productId}
            onValueChange={(value) => {
              setProductId(value);
              const selected = products.find((product) => product.id === value);
              if (selected) {
                setProductSearchText(selected.name);
              }
            }}
          >
            <SelectTrigger disabled={isLoadingProducts || products.length === 0}>
              <SelectValue placeholder={isLoadingProducts ? "กำลังโหลดสินค้า..." : "เลือกสินค้า"} />
            </SelectTrigger>
            <SelectContent>
              {visibleProductOptions.length > 0 ? (
                visibleProductOptions.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} ({product.id})
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-2 text-sm text-gray-500">ไม่พบสินค้า</div>
              )}
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-gray-500">
            {productId && selectedProduct
              ? `เลือกแล้ว: ${selectedProduct.name} (${selectedProduct.id})`
              : `สินค้าทั้งหมด ${products.length} รายการ`}
          </p>
          {filteredProducts.length > 100 && (
            <p className="mt-1 text-xs text-amber-600">พบหลายรายการ กรุณาพิมพ์เพิ่มเพื่อจำกัดผลลัพธ์</p>
          )}
        </Card>

        <Card className="p-4">
          <Label className="text-sm font-medium mb-2 block">วันที่เริ่มต้น</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        <Card className="p-4">
          <Label className="text-sm font-medium mb-2 block">วันที่สิ้นสุด</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[7, 14, 30].map((days) => (
              <Button
                key={days}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFromDate(getDateOffset(-(days - 1)));
                  setToDate(getDateOffset(0));
                }}
              >
                ย้อนหลัง {days} วัน
              </Button>
            ))}
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-end">
          <Button
            onClick={handleSearch}
            disabled={isLoading || isLoadingProducts || !productId}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Search className="h-4 w-4 mr-2" />
            {isLoading ? "กำลังค้นหา..." : "ค้นหา"}
          </Button>
          <p className="mt-3 text-xs text-gray-500">
            เลือกสินค้าและช่วงวันที่ก่อนค้นหา
          </p>
        </Card>
      </div>

      {/* Results */}
      {hasSearched && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">
                ผลการค้นหา ({searchResults.length} รายการ)
              </h2>
              {selectedProduct && (
                <p className="mt-1 text-sm text-gray-500">
                  สินค้า: {selectedProduct.name} ({selectedProduct.id}) | ช่วงวันที่ {fromDate} ถึง {toDate}
                </p>
              )}
            </div>
            <Button
              onClick={handleExport}
              variant="outline"
              disabled={searchResults.length === 0}
            >
              ส่งออก CSV
            </Button>
          </div>

          {resultSummary && (
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <Card className="border-blue-100 p-4">
                <p className="text-sm text-gray-500">ราคาเฉลี่ย</p>
                <p className="text-xl font-semibold text-gray-900">{currencyFormatter.format(resultSummary.average)}</p>
              </Card>
              <Card className="border-blue-100 p-4">
                <p className="text-sm text-gray-500">ราคาต่ำสุด</p>
                <p className="text-xl font-semibold text-gray-900">{currencyFormatter.format(resultSummary.lowest)}</p>
              </Card>
              <Card className="border-blue-100 p-4">
                <p className="text-sm text-gray-500">ราคาสูงสุด</p>
                <p className="text-xl font-semibold text-gray-900">{currencyFormatter.format(resultSummary.highest)}</p>
              </Card>
            </div>
          )}

          {searchResults.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>สินค้า</TableHead>
                    <TableHead>ตลาด</TableHead>
                    <TableHead className="text-right">ราคา</TableHead>
                    <TableHead>หน่วย</TableHead>
                    <TableHead>วันที่</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell>{item.market_name || "MOC Realtime"}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {typeof (item.avg_price ?? item.min_price ?? item.max_price) === "number"
                          ? currencyFormatter.format(item.avg_price ?? item.min_price ?? item.max_price ?? 0)
                          : "N/A"}
                      </TableCell>
                      <TableCell>{item.unit || "กก."}</TableCell>
                      <TableCell>{item.date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">ไม่พบข้อมูลราคาสำหรับวันที่ที่เลือก</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
