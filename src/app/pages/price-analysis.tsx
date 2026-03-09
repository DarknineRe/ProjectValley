import { useState, useMemo } from "react";
import { useData } from "../context/data-context";
import { Card } from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import { Badge } from "../components/ui/badge";

export function PriceAnalysis() {
  const { priceHistory, products } = useData();
  const [selectedCrop, setSelectedCrop] = useState<string>("");

  // Get available crops from price history
  const availableCrops = useMemo(() => {
    const cropSet = new Set<string>();

    for (const row of priceHistory) {
      for (const key of Object.keys(row)) {
        if (key !== "date" && !key.startsWith("__")) {
          cropSet.add(key);
        }
      }
    }

    return Array.from(cropSet);
  }, [priceHistory]);

  // Set default crop when available crops change
  useMemo(() => {
    if (availableCrops.length > 0 && !selectedCrop) {
      setSelectedCrop(availableCrops[0]);
    }
  }, [availableCrops, selectedCrop]);

  // Calculate price statistics for selected crop
  const getPriceStats = (cropName: string) => {
    const prices = priceHistory
      .map((h) => h[cropName] as number)
      .filter((p) => typeof p === "number" && !isNaN(p));

    if (prices.length === 0) {
      return null;
    }

    const currentPrice = prices[prices.length - 1];
    const previousPrice = prices.length > 1 ? prices[prices.length - 2] : currentPrice;
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const computedMaxPrice = Math.max(...prices);
    const computedMinPrice = Math.min(...prices);

    const marketMinSeries = priceHistory
      .map((h) => h[`__min__${cropName}`] as number)
      .filter((p) => typeof p === "number" && !isNaN(p));
    const marketMaxSeries = priceHistory
      .map((h) => h[`__max__${cropName}`] as number)
      .filter((p) => typeof p === "number" && !isNaN(p));

    const minPrice =
      marketMinSeries.length > 0
        ? Math.min(...marketMinSeries)
        : computedMinPrice;
    const maxPrice =
      marketMaxSeries.length > 0
        ? Math.max(...marketMaxSeries)
        : computedMaxPrice;
    const priceChange = currentPrice - previousPrice;
    const priceChangePercent = previousPrice > 0 
      ? ((priceChange / previousPrice) * 100).toFixed(1)
      : "0.0";

    return {
      currentPrice,
      previousPrice,
      avgPrice,
      maxPrice,
      minPrice,
      priceChange,
      priceChangePercent,
    };
  };

  const stats = selectedCrop ? getPriceStats(selectedCrop) : null;

  // Best month to sell (highest price)
  const getBestMonthToSell = (cropName: string) => {
    const priceData = priceHistory
      .map((h) => ({
        month: h.date,
        price: h[cropName] as number,
      }))
      .filter((p) => typeof p.price === "number" && !isNaN(p.price));

    if (priceData.length === 0) return null;

    const bestMonth = priceData.reduce((best, current) =>
      current.price > best.price ? current : best
    );
    return bestMonth;
  };

  const bestMonth = selectedCrop ? getBestMonthToSell(selectedCrop) : null;

  // Recommendations based on price trends
  const getRecommendations = (cropName: string) => {
    const cropStats = getPriceStats(cropName);
    
    if (!cropStats) {
      return [];
    }

    const stats = cropStats;
    const recommendations = [];

    if (stats.currentPrice > stats.avgPrice * 1.1) {
      recommendations.push({
        type: "success",
        message: "ราคาสูงกว่าค่าเฉลี่ย - เหมาะสำหรับการขาย",
        icon: TrendingUp,
      });
    }

    if (stats.currentPrice === stats.maxPrice) {
      recommendations.push({
        type: "success",
        message: "ราคาอยู่ในจุดสูงสุด - แนะนำให้ขายเดี๋ยวนี้",
        icon: DollarSign,
      });
    }

    if (stats.priceChange < 0) {
      recommendations.push({
        type: "warning",
        message: "ราคากำลังลดลง - ควรรอจังหวะที่เหมาะสม",
        icon: TrendingDown,
      });
    }

    if (stats.currentPrice < stats.avgPrice * 0.9) {
      recommendations.push({
        type: "info",
        message: "ราคาต่ำกว่าค่าเฉลี่ย - เหมาะสำหรับเก็บสต็อก",
        icon: Lightbulb,
      });
    }

    return recommendations;
  };

  const recommendations = selectedCrop ? getRecommendations(selectedCrop) : [];

  const trendSignal = useMemo(() => {
    if (!selectedCrop) return null;

    const prices = priceHistory
      .map((h) => h[selectedCrop] as number)
      .filter((p) => typeof p === "number" && !isNaN(p));

    if (prices.length < 2) return null;

    const recent = prices.slice(-3);
    const firstRecent = recent[0];
    const lastRecent = recent[recent.length - 1];
    const shortTermPercent = firstRecent > 0
      ? ((lastRecent - firstRecent) / firstRecent) * 100
      : 0;

    const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    const volatilityPercent = avg > 0 ? (stdDev / avg) * 100 : 0;

    let direction: "up" | "down" | "stable" = "stable";
    if (shortTermPercent > 3) direction = "up";
    else if (shortTermPercent < -3) direction = "down";

    let volatilityLevel: "low" | "medium" | "high" = "low";
    if (volatilityPercent >= 15) volatilityLevel = "high";
    else if (volatilityPercent >= 8) volatilityLevel = "medium";

    return {
      shortTermPercent,
      volatilityPercent,
      direction,
      volatilityLevel,
    };
  }, [priceHistory, selectedCrop]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          วิเคราะห์ราคาและแนวโน้ม
        </h2>
        <p className="text-gray-600 mt-1">
          ติดตามและวิเคราะห์ราคาผลผลิตเพื่อการตัดสินใจที่ดีขึ้น
        </p>
      </div>

      {/* Crop Selector */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <label className="font-medium text-gray-700">เลือกพืชผล:</label>
          {availableCrops.length > 0 ? (
            <Select value={selectedCrop} onValueChange={setSelectedCrop}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="เลือกพืชผล" />
              </SelectTrigger>
              <SelectContent>
                {availableCrops.map((crop) => (
                  <SelectItem key={crop} value={crop}>
                    {crop}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-gray-500">ไม่มีข้อมูลราคาที่ดี</p>
          )}
        </div>
      </Card>

      {availableCrops.length === 0 && (
        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900">ไม่มีข้อมูลราคา</h3>
              <p className="text-blue-800 text-sm mt-1">
                ยังไม่มีข้อมูลราคาในระบบ โปรดรอการอัพเดตข้อมูลราคาจากตลาด
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Price Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-gray-700">ราคาปัจจุบัน</h3>
            </div>
            <p className="text-3xl font-bold text-green-600">
              ฿{stats.currentPrice}
            </p>
            <div className="flex items-center gap-1 mt-2">
              {stats.priceChange >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span
                className={`text-sm ${
                  stats.priceChange >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {stats.priceChangePercent}% จากเดือนที่แล้ว
              </span>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-gray-700 mb-2">ราคาเฉลี่ย</h3>
            <p className="text-3xl font-bold text-blue-600">
              ฿{stats.avgPrice.toFixed(2)}
            </p>
            <p className="text-sm text-gray-600 mt-2">จาก 6 เดือนที่ผ่านมา</p>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-gray-700 mb-2">ราคาสูงสุด</h3>
            <p className="text-3xl font-bold text-orange-600">
              ฿{stats.maxPrice}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              สูงกว่าปัจจุบัน ฿{stats.maxPrice - stats.currentPrice}
            </p>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-gray-700 mb-2">ราคาต่ำสุด</h3>
            <p className="text-3xl font-bold text-purple-600">
              ฿{stats.minPrice}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              ต่ำกว่าปัจจุบัน ฿{stats.currentPrice - stats.minPrice}
            </p>
          </Card>
        </div>
      )}

      {/* Price Trend Chart */}
      {availableCrops.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            แนวโน้มราคา 6 เดือนย้อนหลัง
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={priceHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              {selectedCrop && (
                <Line
                  key={selectedCrop}
                  type="monotone"
                  dataKey={selectedCrop}
                  stroke="#10b981"
                  strokeWidth={3}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Trend Signal */}
      {trendSignal && selectedCrop && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            {trendSignal.direction === "up" ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : trendSignal.direction === "down" ? (
              <TrendingDown className="h-5 w-5 text-red-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-blue-600" />
            )}
            <h3 className="text-lg font-semibold">สัญญาณแนวโน้มระยะสั้น</h3>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-3">
            <Badge
              className={
                trendSignal.direction === "up"
                  ? "bg-green-600"
                  : trendSignal.direction === "down"
                  ? "bg-red-600"
                  : "bg-blue-600"
              }
            >
              {trendSignal.direction === "up"
                ? "แนวโน้มขึ้น"
                : trendSignal.direction === "down"
                ? "แนวโน้มลง"
                : "ทรงตัว"}
            </Badge>

            <Badge variant="secondary">
              เปลี่ยนแปลง 3 เดือนล่าสุด {trendSignal.shortTermPercent >= 0 ? "+" : ""}
              {trendSignal.shortTermPercent.toFixed(1)}%
            </Badge>

            <Badge
              variant="outline"
              className={
                trendSignal.volatilityLevel === "high"
                  ? "text-red-700"
                  : trendSignal.volatilityLevel === "medium"
                  ? "text-amber-700"
                  : "text-green-700"
              }
            >
              ความผันผวน {trendSignal.volatilityLevel === "high"
                ? "สูง"
                : trendSignal.volatilityLevel === "medium"
                ? "ปานกลาง"
                : "ต่ำ"}
            </Badge>
          </div>

          <p className="text-sm text-gray-600">
            {selectedCrop} มีความผันผวนประมาณ {trendSignal.volatilityPercent.toFixed(1)}% จากราคาเฉลี่ย
            {trendSignal.direction === "up"
              ? " เหมาะสำหรับติดตามจังหวะขายในช่วงใกล้เคียงนี้"
              : trendSignal.direction === "down"
              ? " ควรระวังการขายเร่งด่วนและติดตามราคาตลาดเพิ่ม"
              : " แนวโน้มยังนิ่ง เหมาะกับการวางแผนแบบค่อยเป็นค่อยไป"}
          </p>
        </Card>
      )}

      {/* Comparison Chart */}
      {availableCrops.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            เปรียบเทียบราคาเฉลี่ยทุกพืชผล
          </h3>
          {availableCrops.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={availableCrops
                  .map((crop) => {
                    const stats = getPriceStats(crop);
                    return stats
                      ? {
                          name: crop,
                          avgPrice: stats.avgPrice,
                          currentPrice: stats.currentPrice,
                        }
                      : null;
                  })
                  .filter((item) => item !== null) as Array<{
                  name: string;
                  avgPrice: number;
                  currentPrice: number;
                }>}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgPrice" fill="#94a3b8" name="ราคาเฉลี่ย" />
                <Bar dataKey="currentPrice" fill="#10b981" name="ราคาปัจจุบัน" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-gray-500">
              ไม่มีข้อมูลราคาที่ดี
            </div>
          )}
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-5 w-5 text-yellow-600" />
            <h3 className="text-lg font-semibold">
              คำแนะนำสำหรับ {selectedCrop}
            </h3>
          </div>
          <div className="space-y-3">
            {recommendations.map((rec, index) => {
              const Icon = rec.icon;
              const bgColor =
                rec.type === "success"
                  ? "bg-green-50 border-green-200"
                  : rec.type === "warning"
                  ? "bg-amber-50 border-amber-200"
                  : "bg-blue-50 border-blue-200";
              const textColor =
                rec.type === "success"
                  ? "text-green-800"
                  : rec.type === "warning"
                  ? "text-amber-800"
                  : "text-blue-800";

              return (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-4 border rounded-lg ${bgColor}`}
                >
                  <Icon className={`h-5 w-5 ${textColor}`} />
                  <p className={`${textColor} font-medium`}>{rec.message}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Best Time to Sell */}
      {bestMonth && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold">ช่วงเวลาที่ราคาดีที่สุด</h3>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-gray-700">
              <span className="font-semibold">{selectedCrop}</span> มีราคาสูงสุดในเดือน{" "}
              <span className="font-bold text-green-700">{bestMonth.month}</span>{" "}
              ที่ราคา{" "}
              <span className="font-bold text-green-700">
                ฿{bestMonth.price}
              </span>
            </p>
            <p className="text-sm text-gray-600 mt-2">
              💡 วางแผนการเก็บเกี่ยวให้ตรงกับช่วงนี้เพื่อรายได้สูงสุด
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
