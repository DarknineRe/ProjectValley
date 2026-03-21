import { useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Search, Package, Leaf, ShoppingCart, MapPin, Phone, Mail } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  seller: string;
  price: number;
  quantity: number;
  unit: string;
  category: string;
  image?: string;
}

const MOCK_PRODUCTS: Product[] = [
  {
    id: "1",
    name: "ข้าวเจ้า",
    seller: "ไร่ไทยวิล",
    price: 15,
    quantity: 500,
    unit: "กิโลกรัม",
    category: "เมล็ดพันธุ์",
  },
  {
    id: "2",
    name: "ถั่วเขียว",
    seller: "สวนธรรมชาติ",
    price: 25,
    quantity: 200,
    unit: "กิโลกรัม",
    category: "ถั่ว",
  },
  {
    id: "3",
    name: "ผักกาดขาว",
    seller: "เกษตรเหนือ",
    price: 8,
    quantity: 100,
    unit: "กิโลกรัม",
    category: "ผัก",
  },
  {
    id: "4",
    name: "มันฝรั่ง",
    seller: "ไร่ไทยวิล",
    price: 12,
    quantity: 300,
    unit: "กิโลกรัม",
    category: "ผัก",
  },
  {
    id: "5",
    name: "ข้าวเหนียว",
    seller: "สวนธรรมชาติ",
    price: 18,
    quantity: 400,
    unit: "กิโลกรัม",
    category: "เมล็ดพันธุ์",
  },
  {
    id: "6",
    name: "มะม่วง",
    seller: "เกษตรเหนือ",
    price: 35,
    quantity: 150,
    unit: "กิโลกรัม",
    category: "ผลไม้",
  },
];

export function BuyerShop() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<Map<string, number>>(new Map());

  const categories = Array.from(new Set(MOCK_PRODUCTS.map((p) => p.category)));

  const filteredProducts = MOCK_PRODUCTS.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.seller.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddToCart = (productId: string) => {
    const newCart = new Map(cart);
    newCart.set(productId, (newCart.get(productId) || 0) + 1);
    setCart(newCart);
    toast.success("เพิ่มลงตะกร้าแล้ว");
  };

  const cartTotal = Array.from(cart.entries()).reduce((total, [productId, qty]) => {
    const product = MOCK_PRODUCTS.find((p) => p.id === productId);
    return total + (product?.price || 0) * qty;
  }, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="h-8 w-8 text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">ตลาดกลาง</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-gray-600">ตะกร้า: </span>
              <span className="font-bold text-green-600">{cart.size} รายการ</span>
            </div>
            {cartTotal > 0 && (
              <Badge className="bg-green-600">฿{cartTotal.toFixed(2)}</Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg p-8 mb-8 text-white">
          <h2 className="text-4xl font-bold mb-2">ซื้อผลผลิตเกษตรตรงจากผู้ขาย</h2>
          <p className="text-lg opacity-90">สินค้าสดใหม่ราคาดี จากเกษตรกรทั่วประเทศ</p>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="ค้นหาสินค้าหรือชื่อผู้ขาย..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 py-3 text-lg"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              onClick={() => setSelectedCategory(null)}
              size="sm"
            >
              ทั้งหมด
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                onClick={() => setSelectedCategory(category)}
                size="sm"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <Card
                key={product.id}
                className="overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="bg-gradient-to-br from-green-100 to-emerald-100 h-40 flex items-center justify-center">
                  <Package className="h-16 w-16 text-green-600 opacity-50" />
                </div>
                <div className="p-4">
                  <Badge variant="outline" className="mb-2">
                    {product.category}
                  </Badge>
                  <h3 className="text-lg font-bold mb-2">{product.name}</h3>
                  <div className="text-sm text-gray-600 mb-3 flex items-center gap-2">
                    <Leaf className="h-4 w-4" />
                    {product.seller}
                  </div>
                  <div className="bg-gray-50 p-3 rounded mb-4 text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-600">ราคา</span>
                      <span className="font-bold text-green-600">
                        ฿{product.price}/{product.unit}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">คงเหลือ</span>
                      <span className="font-semibold">
                        {product.quantity} {product.unit}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleAddToCart(product.id)}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      ซื้อ
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">ไม่พบสินค้าที่คุณค้นหา</p>
            </div>
          )}
        </div>

        {/* Contact Section */}
        <div className="bg-white rounded-lg p-8 border border-gray-200">
          <h2 className="text-2xl font-bold mb-6">ติดต่อเรา</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-start gap-4">
              <Phone className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-bold mb-1">โทรศัพท์</h3>
                <p className="text-gray-600">+66-2-XXX-XXXX</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Mail className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-bold mb-1">อีเมล</h3>
                <p className="text-gray-600">contact@market.co.th</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <MapPin className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-bold mb-1">ที่ตั้ง</h3>
                <p className="text-gray-600">ตลาดกลาง กรุงเทพฯ</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p>&copy; 2026 ตลาดกลาง. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
