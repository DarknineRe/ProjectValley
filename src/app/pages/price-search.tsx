import { useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Calendar, Search, TrendingUp } from "lucide-react";
import { toast } from "sonner";
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

interface PriceData {
  product_id: string;
  product_name: string;
  market_name: string;
  price: number;
  currency: string;
  date: string;
  unit: string;
}

const PRODUCTS = [
  { id: "P11001", name: "ข้าวเจ้า" },
  { id: "P11002", name: "ข้าวเหนียว" },
  { id: "P11012", name: "ถั่วเขียว" },
  { id: "P11013", name: "ถั่วแดง" },
  { id: "P12001", name: "ปลาทู" },
  { id: "P12002", name: "ปลาสลิด" },
  { id: "P13001", name: "หมู" },
  { id: "P13002", name: "ไก่" },
  { id: "P14001", name: "ไข่ไก่" },
];

export function PriceSearch() {
  const [productId, setProductId] = useState("P11012");
  const [fromDate, setFromDate] = useState("2026-02-27");
  const [toDate, setToDate] = useState("2026-02-28");
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<PriceData[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!productId || !fromDate || !toDate) {
      toast.error("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    setIsLoading(true);
    try {
      const url = `https://data.moc.go.th/OpenData/GISProductPrice?product_id=${productId}&from_date=${fromDate}&to_date=${toDate}&task=search`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("ไม่สามารถดึงข้อมูลราคาได้");
      }

      const data = await response.json();
      setSearchResults(Array.isArray(data) ? data : data.data || []);
      setHasSearched(true);
      
      if (Array.isArray(data) && data.length === 0) {
        toast.info("ไม่พบข้อมูลราคา");
      } else {
        toast.success("ค้นหาราคาสำเร็จ");
      }
    } catch (error: any) {
      toast.error(error.message || "เกิดข้อผิดพลาด");
      setSearchResults([]);
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
        item.market_name,
        item.price,
        item.currency,
        item.unit,
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
        <p className="text-gray-600">ค้นหาข้อมูลราคาสินค้าจากตลาดกลาง (กระทรวงพาณิชย์)</p>
      </div>

      {/* Search Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <Label className="text-sm font-medium mb-2 block">เลือกสินค้า</Label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCTS.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        </Card>

        <Card className="p-4 flex flex-col justify-end">
          <Button
            onClick={handleSearch}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Search className="h-4 w-4 mr-2" />
            {isLoading ? "กำลังค้นหา..." : "ค้นหา"}
          </Button>
        </Card>
      </div>

      {/* Results */}
      {hasSearched && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">
              ผลการค้นหา ({searchResults.length} รายการ)
            </h2>
            <Button
              onClick={handleExport}
              variant="outline"
              disabled={searchResults.length === 0}
            >
              ส่งออก CSV
            </Button>
          </div>

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
                      <TableCell>{item.market_name}</TableCell>
                      <TableCell className="text-right font-semibold">
                        ฿{item.price?.toFixed(2) || "N/A"}
                      </TableCell>
                      <TableCell>{item.unit}</TableCell>
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
