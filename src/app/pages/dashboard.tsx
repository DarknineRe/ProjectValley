import { useData } from "../context/data-context";
import { Card } from "../components/ui/card";
import {
  Package,
  Calendar,
  TrendingUp,
  Sprout,
} from "lucide-react";
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
import { Badge } from "../components/ui/badge";

export function Dashboard() {
  const { products, schedules, priceHistory } = useData();
  const fallbackLowStockThreshold = 10;

  const activePlantings = schedules.filter((s) => s.status === "planted").length;
  const plannedPlantings = schedules.filter((s) => s.status === "planned").length;
  const lowStockProducts = products
    .filter((product) => {
      const threshold = product.minStock > 0 ? product.minStock : fallbackLowStockThreshold;
      return product.quantity <= threshold;
    })
    .sort((a, b) => a.quantity - b.quantity);

  const stats = [
    {
      title: "จำนวนสินค้า",
      value: products.length,
      subtitle: "ผลผลิต",
      icon: Package,
      color: "bg-blue-500",
      textColor: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "กำลังปลูก",
      value: activePlantings,
      subtitle: `วางแผนแล้ว ${plannedPlantings} แปลง`,
      icon: Sprout,
      color: "bg-green-500",
      textColor: "text-green-600",
      bgColor: "bg-green-50",
    },
  ];

  // ข้อมูลสำหรับกราฟประเภทผลผลิต
  const categoryData = products.reduce((acc, product) => {
    const existing = acc.find((item) => item.category === product.category);
    if (existing) {
      existing.quantity += product.quantity;
    } else {
      acc.push({
        category: product.category,
        quantity: product.quantity,
      });
    }
    return acc;
  }, [] as { category: string; quantity: number }[]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                  <p className={`text-3xl font-bold ${stat.textColor} mb-1`}>
                    {stat.value}
                  </p>
                  <p className="text-xs text-gray-500">{stat.subtitle}</p>
                </div>
                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                  <Icon className={`h-6 w-6 ${stat.textColor}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6">
        {/* Price Trend Chart */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold">แนวโน้มราคาพืชผล (6 เดือน)</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={priceHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="ข้าวหอมมะลิ"
                stroke="#10b981"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="มะม่วง"
                stroke="#f59e0b"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="ผักกาดหอม"
                stroke="#3b82f6"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Category Distribution Chart */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">จำนวนตามประเภทผลผลิต</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="quantity" fill="#10b981" name="จำนวน" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Additional Info Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-amber-600" />
            <h3 className="text-lg font-semibold">แจ้งเตือนสินค้าใกล้หมด</h3>
          </div>
          {lowStockProducts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">ยังไม่มีสินค้าใกล้หมด</p>
          ) : (
            <div className="space-y-3">
              {lowStockProducts.slice(0, 6).map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3"
                >
                  <div>
                    <p className="font-medium text-gray-900">{product.name}</p>
                    <p className="text-sm text-amber-700">
                      คงเหลือ {product.quantity.toLocaleString()} {product.unit} (ขั้นต่ำ {(product.minStock > 0 ? product.minStock : fallbackLowStockThreshold).toLocaleString()} {product.unit})
                    </p>
                  </div>
                  <Badge className="bg-amber-600">ใกล้หมด</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Upcoming Harvests */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold">การเก็บเกี่ยวที่กำลังมาถึง</h3>
          </div>
          {schedules.filter((s) => s.status === "planted").length === 0 ? (
            <p className="text-gray-500 text-center py-8">ไม่มีแผนที่กำลังปลูก</p>
          ) : (
            <div className="space-y-3">
              {schedules
                .filter((s) => s.status === "planted")
                .slice(0, 5)
                .map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {schedule.cropName}
                      </p>
                      <p className="text-sm text-gray-600">
                        เก็บเกี่ยว:{" "}
                        {new Date(schedule.harvestDate).toLocaleDateString(
                          "th-TH",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </p>
                    </div>
                    <Badge className="bg-green-600">
                      {schedule.area} ไร่
                    </Badge>
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}