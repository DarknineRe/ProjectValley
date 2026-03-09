import { useEffect, useMemo, useState } from "react";
import { useData } from "../context/data-context";
import { Card } from "../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  Info,
  Calendar,
} from "lucide-react";
import { Alert, AlertDescription } from "../components/ui/alert";
import { API_BASE } from "../../api";
import { useWorkspace } from "../context/workspace-context";

interface MOCPriceData {
  productName: string;
  category: string;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  unit: string;
  lastUpdated: string;
  source: string;
}

export function PriceComparison() {
  const { products } = useData();
  const { currentWorkspace } = useWorkspace();
  const [vegetableMOCPrices, setVegetableMOCPrices] = useState<MOCPriceData[]>([]);

  useEffect(() => {
    const loadLatestMarketPrices = async () => {
      try {
        const workspaceId = currentWorkspace?.id || "default";
        const res = await fetch(
          `${API_BASE}/api/market-prices/latest?workspace_id=${encodeURIComponent(workspaceId)}&limit=500`
        );
        if (!res.ok) {
          setVegetableMOCPrices([]);
          return;
        }
        const rows = await res.json();
        const mapped: MOCPriceData[] = (rows || [])
          .map((row: any) => ({
            productName: row.product_name || row.productName || row.product_id,
            category: "ผักสด",
            minPrice: Number(row.min_price ?? row.minPrice ?? row.avg_price ?? row.avgPrice ?? 0),
            maxPrice: Number(row.max_price ?? row.maxPrice ?? row.avg_price ?? row.avgPrice ?? 0),
            avgPrice: Number(row.avg_price ?? row.avgPrice ?? 0),
            unit: "กิโลกรัม",
            lastUpdated: row.date || row.created_at,
            source: "MOC Open Data",
          }))
          .filter((item: MOCPriceData) => Number.isFinite(item.avgPrice) && item.avgPrice > 0);

        setVegetableMOCPrices(mapped);
      } catch {
        setVegetableMOCPrices([]);
      }
    };

    loadLatestMarketPrices();
  }, [currentWorkspace?.id]);

  // จับคู่สินค้าในสต็อกกับราคาอ้างอิง
  const matchedProducts = useMemo(() => products.map((product: any) => {
    const mocPrice = vegetableMOCPrices.find(
      (moc: MOCPriceData) =>
        moc.productName.toLowerCase().includes(product.name.toLowerCase()) ||
        product.name.toLowerCase().includes(moc.productName.toLowerCase()) ||
        (moc.category === product.category &&
          moc.productName.toLowerCase().split(" ")[0] ===
            product.name.toLowerCase().split(" ")[0])
    );

    return {
      ...product,
      mocPrice,
    };
  }), [products, vegetableMOCPrices]);

  const getPriceTrend = (currentPrice: number, mocAvgPrice: number) => {
    const diff = ((currentPrice - mocAvgPrice) / mocAvgPrice) * 100;
    if (diff > 5) return { icon: TrendingUp, color: "text-green-600", label: "สูงกว่า" };
    if (diff < -5) return { icon: TrendingDown, color: "text-red-600", label: "ต่ำกว่า" };
    return { icon: Minus, color: "text-gray-600", label: "ใกล้เคียง" };
  };

  const getPriceBadge = (currentPrice: number, mocAvgPrice: number) => {
    const diff = ((currentPrice - mocAvgPrice) / mocAvgPrice) * 100;
    if (diff > 10)
      return { variant: "default" as const, label: `+${diff.toFixed(1)}%` };
    if (diff < -10)
      return { variant: "destructive" as const, label: `${diff.toFixed(1)}%` };
    return { variant: "secondary" as const, label: `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%` };
  };

  // แยกสินค้าที่มีและไม่มีข้อมูลราคาอ้างอิง
  const productsWithMOC = matchedProducts.filter((p: any) => p.mocPrice);
  const productsWithoutMOC = matchedProducts.filter((p: any) => !p.mocPrice);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          เปรียบเทียบราคากับกระทรวงพาณิชย์
        </h2>
        <p className="text-gray-600 mt-1">
          ตรวจสอบราคาสินค้าเทียบกับราคาอ้างอิงจากกระทรวงพาณิชย์
        </p>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <div>
            <p className="font-medium">
              ข้อมูลราคาอ้างอิงจากกระทรวงพาณิชย์
            </p>
            <p className="text-sm text-gray-600 mt-1">
              ราคาที่แสดงเป็นราคาเฉลี่ยจากตลาดต่างๆ อัปเดตทุกวัน
            </p>
          </div>
          <a
            href="https://www.moc.go.th/th/content/category/detail/id/311/iid/3054"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            เว็บไซต์กระทรวงพาณิชย์
            <ExternalLink className="h-4 w-4" />
          </a>
        </AlertDescription>
      </Alert>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">สินค้าทั้งหมด</p>
              <p className="text-3xl font-bold text-gray-900">
                {matchedProducts.length}
              </p>
              <p className="text-xs text-gray-500 mt-1">รายการ</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">มีข้อมูลอ้างอิง</p>
              <p className="text-3xl font-bold text-green-600">
                {productsWithMOC.length}
              </p>
              <p className="text-xs text-gray-500 mt-1">รายการ</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">ไม่มีข้อมูลอ้างอิง</p>
              <p className="text-3xl font-bold text-amber-600">
                {productsWithoutMOC.length}
              </p>
              <p className="text-xs text-gray-500 mt-1">รายการ</p>
            </div>
            <div className="p-3 bg-amber-100 rounded-full">
              <Info className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* สินค้าที่มีข้อมูลราคาอ้างอิง */}
      {productsWithMOC.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            สินค้าที่มีข้อมูลราคาอ้างอิง
          </h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อสินค้า</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead className="text-right">ราคาปัจจุบัน</TableHead>
                  <TableHead className="text-right">ราคาอ้างอิง (MOC)</TableHead>
                  <TableHead className="text-center">ช่วงราคา</TableHead>
                  <TableHead className="text-center">เปรียบเทียบ</TableHead>
                  <TableHead>แหล่งข้อมูล</TableHead>
                  <TableHead className="text-center">อัปเดต</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productsWithMOC.map((product: any) => {
                  if (!product.mocPrice) return null;
                  
                  // ใช้ราคาจากฟิลด์ price ถ้ามี ถ้าไม่มีใช้ราคาเฉลี่ย MOC
                  const currentPrice = (product as any).price || product.mocPrice.avgPrice;
                  const trend = getPriceTrend(currentPrice, product.mocPrice.avgPrice);
                  const badge = getPriceBadge(currentPrice, product.mocPrice.avgPrice);
                  const TrendIcon = trend.icon;

                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ฿{currentPrice.toFixed(2)}
                        <span className="text-xs text-gray-500 ml-1">
                          /{product.mocPrice.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">
                            ฿{product.mocPrice.avgPrice.toFixed(2)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="text-xs text-gray-600">
                          ฿{product.mocPrice.minPrice} - ฿
                          {product.mocPrice.maxPrice}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <TrendIcon className={`h-4 w-4 ${trend.color}`} />
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {product.mocPrice.source}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" />
                          {new Date(product.mocPrice.lastUpdated).toLocaleDateString(
                            "th-TH",
                            {
                              day: "numeric",
                              month: "short",
                            }
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* สินค้าที่ไม่มีข้อมูลราคาอ้างอิง */}
      {productsWithoutMOC.length > 0 && (
        <Card className="p-6 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <Info className="h-6 w-6 text-amber-600 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-amber-900 mb-2">
                สินค้าที่ไม่มีข้อมูลราคาอ้างอิง
              </h3>
              <p className="text-sm text-amber-700 mb-3">
                มีสินค้า {productsWithoutMOC.length}{" "}
                รายการที่ยังไม่มีข้อมูลราคาอ้างอิงจากกระทรวงพาณิชย์
              </p>
              <div className="bg-white rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {productsWithoutMOC.map((product: any) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {product.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {product.category}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ตารางราคาอ้างอิงทั้งหมดจาก MOC */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          ราคาอ้างอิงผัก (กิโลกรัม) จากกระทรวงพาณิชย์
        </h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อสินค้า</TableHead>
                <TableHead>หมวดหมู่</TableHead>
                <TableHead className="text-right">ราคาต่ำสุด</TableHead>
                <TableHead className="text-right">ราคาสูงสุด</TableHead>
                <TableHead className="text-right">ราคาเฉลี่ย</TableHead>
                <TableHead>แหล่งข้อมูล</TableHead>
                <TableHead className="text-center">อัปเดต</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vegetableMOCPrices.map((moc: MOCPriceData, index: number) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{moc.productName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{moc.category}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    ฿{moc.minPrice.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    ฿{moc.maxPrice.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-green-600">
                    ฿{moc.avgPrice.toFixed(2)}
                    <span className="text-xs text-gray-500 ml-1">
                      /{moc.unit}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {moc.source}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
                      <Calendar className="h-3 w-3" />
                      {new Date(moc.lastUpdated).toLocaleDateString("th-TH", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
