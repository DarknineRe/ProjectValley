import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Search, Package, Leaf, ShoppingCart, MapPin, Mail, LockKeyhole, Store, LayoutGrid, Sprout, ChevronRight } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { API_BASE } from "../../api";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

interface BuyerProduct {
  id: string;
  name: string;
  sellerId: string;
  sellerName: string;
  workspaceId: string;
  workspaceName: string;
  price: number;
  quantity: number;
  unit: string;
  category: string;
  imageUrl?: string;
}

export function BuyerShop() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [products, setProducts] = useState<BuyerProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    const loadProducts = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${API_BASE}/api/public/products`);
        if (!response.ok) {
          throw new Error("โหลดสินค้าสำหรับผู้ซื้อไม่สำเร็จ");
        }
        const data = await response.json();
        if (!ignore) {
          setProducts(
            Array.isArray(data)
              ? data.map((item) => ({
                  id: String(item.id),
                  name: String(item.name || ""),
                  sellerId: String(item.seller_id ?? item.sellerId ?? ""),
                  sellerName: String(item.seller_name ?? item.sellerName ?? "ไม่ระบุผู้ขาย"),
                  workspaceId: String(item.workspace_id ?? item.workspaceId ?? "default"),
                  workspaceName: String(item.workspace_name ?? item.workspaceName ?? "ทั่วไป"),
                  price: Number(item.price ?? 0),
                  quantity: Number(item.quantity ?? 0),
                  unit: String(item.unit || "หน่วย"),
                  category: String(item.category || "อื่นๆ"),
                  imageUrl: item.image_url ?? item.imageUrl ?? undefined,
                }))
              : []
          );
        }
      } catch (error) {
        if (!ignore) {
          console.error(error);
          toast.error("ไม่สามารถโหลดสินค้าได้");
          setProducts([]);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    loadProducts();
    return () => {
      ignore = true;
    };
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))),
    [products]
  );

  const workspaces = useMemo(
    () => Array.from(new Set(products.map((p) => p.workspaceName))).sort((left, right) => left.localeCompare(right, "th")),
    [products]
  );

  const workspaceSummaries = useMemo(() => {
    const summaryMap = new Map<string, { workspaceName: string; offers: number; sellers: Set<string>; categories: Set<string> }>();

    for (const product of products) {
      const current = summaryMap.get(product.workspaceId) || {
        workspaceName: product.workspaceName,
        offers: 0,
        sellers: new Set<string>(),
        categories: new Set<string>(),
      };

      current.offers += 1;
      current.sellers.add(product.sellerId);
      current.categories.add(product.category);
      summaryMap.set(product.workspaceId, current);
    }

    return Array.from(summaryMap.values())
      .map((item) => ({
        workspaceName: item.workspaceName,
        offers: item.offers,
        sellers: item.sellers.size,
        categories: item.categories.size,
      }))
      .sort((left, right) => right.offers - left.offers)
      .slice(0, 6);
  }, [products]);

  const filteredProducts = useMemo(
    () =>
      products
        .filter((product) => {
          const normalizedQuery = searchQuery.trim().toLowerCase();
          const matchesSearch =
            normalizedQuery.length === 0 ||
            product.name.toLowerCase().includes(normalizedQuery) ||
            product.sellerName.toLowerCase().includes(normalizedQuery) ||
            product.workspaceName.toLowerCase().includes(normalizedQuery) ||
            product.category.toLowerCase().includes(normalizedQuery);
          const matchesCategory = !selectedCategory || product.category === selectedCategory;
          const matchesWorkspace = !selectedWorkspace || product.workspaceName === selectedWorkspace;
          return matchesSearch && matchesCategory && matchesWorkspace;
        })
        .sort((left, right) => {
          if (left.workspaceName !== right.workspaceName) {
            return left.workspaceName.localeCompare(right.workspaceName, "th");
          }
          if (left.name !== right.name) {
            return left.name.localeCompare(right.name, "th");
          }
          return left.price - right.price;
        }),
    [products, searchQuery, selectedCategory, selectedWorkspace]
  );

  const handleAddToCart = (productId: string) => {
    const newCart = new Map(cart);
    newCart.set(productId, (newCart.get(productId) || 0) + 1);
    setCart(newCart);
    toast.success("เพิ่มลงตะกร้าแล้ว");
  };

  const cartTotal = Array.from(cart.entries()).reduce((total, [productId, qty]) => {
    const product = products.find((p) => p.id === productId);
    return total + (product?.price || 0) * qty;
  }, 0);

  const totalQuantity = useMemo(
    () => filteredProducts.reduce((sum, product) => sum + product.quantity, 0),
    [filteredProducts]
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(22,163,74,0.16),_transparent_28%),linear-gradient(180deg,_#f6fff7_0%,_#ffffff_42%,_#eefaf2_100%)]">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-emerald-100/80 bg-white/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="rounded-2xl bg-emerald-600 p-2 text-white shadow-sm">
              <Leaf className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ตลาดกลางรวมทุก Workspace</h1>
              <p className="text-sm text-gray-600">รวมสินค้าจากทุกทีมขายไว้ในหน้าเดียว</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate("/login")}>เลือก Buyer / Seller</Button>
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
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <Card className="border-white/20 bg-white/10 p-4 text-white shadow-none">
              <div className="flex items-start gap-3">
                <ShoppingCart className="mt-1 h-5 w-5" />
                <div>
                  <p className="font-semibold">ผู้ซื้อ</p>
                  <p className="text-sm text-white/80">เลือกดูสินค้าได้ทันทีจากหน้านี้</p>
                </div>
              </div>
            </Card>
            <Card className="border-white/20 bg-white/10 p-4 text-white shadow-none">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <LockKeyhole className="mt-1 h-5 w-5" />
                  <div>
                    <p className="font-semibold">ผู้ขาย</p>
                    <p className="text-sm text-white/80">เข้าสู่ระบบเพื่อเพิ่มสินค้าและลงขายพร้อมรูปภาพ</p>
                  </div>
                </div>
                <Button asChild variant="secondary" className="bg-white text-emerald-800 hover:bg-emerald-50">
                  <Link to="/login">Seller Login</Link>
                </Button>
              </div>
            </Card>
          </div>
        </div>
                    <section className="relative overflow-hidden rounded-[32px] border border-emerald-200/70 bg-[linear-gradient(135deg,_rgba(5,150,105,0.96),_rgba(16,185,129,0.88))] p-8 text-white shadow-[0_24px_80px_-32px_rgba(5,150,105,0.55)] mb-8">
                      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                      <div className="absolute bottom-0 right-24 h-24 w-24 rounded-full bg-lime-200/20 blur-xl" />
                      <div className="relative grid gap-6 lg:grid-cols-[1.35fr_0.95fr] lg:items-end">
                        <div>
                          <Badge className="mb-4 bg-white/15 text-white hover:bg-white/15">ทุก workspace เชื่อมถึงหน้าเดียว</Badge>
                          <h2 className="max-w-3xl text-4xl font-bold tracking-tight mb-3">ซื้อผลผลิตเกษตรจากทุก workspace ได้ในหน้าเดียว</h2>
                          <p className="max-w-2xl text-base text-emerald-50/90">
                            หน้าผู้ซื้อดึงรายการจากผู้ขายทุก workspace แล้ว คุณสามารถค้นหาตามสินค้า ผู้ขาย หรือชื่อ workspace และเปรียบเทียบข้อเสนอได้เร็วขึ้น
                          </p>
                          <div className="mt-6 flex flex-wrap gap-3">
                            <Button className="bg-white text-emerald-800 hover:bg-emerald-50" onClick={() => document.getElementById("buyer-products")?.scrollIntoView({ behavior: "smooth" })}>
                              เริ่มเลือกซื้อ
                              <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                            <Button variant="secondary" className="bg-emerald-950/20 text-white hover:bg-emerald-950/30" onClick={() => navigate("/price-search")}>
                              เช็กราคาตลาด
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Card className="border-white/20 bg-white/10 p-4 text-white shadow-none">
                            <p className="text-sm text-white/75">Workspace ที่เชื่อมอยู่</p>
                            <p className="mt-1 text-3xl font-bold">{workspaces.length}</p>
                            <p className="mt-2 text-xs text-white/75">รวมสินค้าจากทุกทีมขายที่เปิดขายอยู่</p>
                          </Card>
                          <Card className="border-white/20 bg-white/10 p-4 text-white shadow-none">
                            <p className="text-sm text-white/75">สินค้าพร้อมขาย</p>
                            <p className="mt-1 text-3xl font-bold">{products.length}</p>
                            <p className="mt-2 text-xs text-white/75">อัปเดตอัตโนมัติจากทุก workspace</p>
                          </Card>
                          <Card className="border-white/20 bg-white/10 p-4 text-white shadow-none sm:col-span-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <LockKeyhole className="mt-1 h-5 w-5" />
                                <div>
                                  <p className="font-semibold">ทางเข้าผู้ขาย</p>
                                  <p className="text-sm text-white/80">ผู้ขายลงสินค้าและรูปได้ แล้วรายการจะมาแสดงที่หน้านี้ทันที</p>
                                </div>
                              </div>
                              <Button asChild variant="secondary" className="bg-white text-emerald-800 hover:bg-emerald-50">
                                <Link to="/login">Seller Login</Link>
                              </Button>
                            </div>
                          </Card>
                        </div>
                      </div>
                    </section>

                    <section className="mb-8 grid gap-4 md:grid-cols-4">
                      <Card className="rounded-3xl border-emerald-100 p-5 shadow-sm">
                        <p className="text-sm text-gray-600">สินค้าพร้อมขาย</p>
                        <p className="text-3xl font-bold text-gray-900">{products.length}</p>
                      </Card>
                      <Card className="rounded-3xl border-emerald-100 p-5 shadow-sm">
                        <p className="text-sm text-gray-600">ผู้ขาย</p>
                        <p className="text-3xl font-bold text-gray-900">{new Set(products.map((product) => product.sellerId)).size}</p>
                      </Card>
                      <Card className="rounded-3xl border-emerald-100 p-5 shadow-sm">
                        <p className="text-sm text-gray-600">หมวดหมู่</p>
                        <p className="text-3xl font-bold text-gray-900">{categories.length}</p>
                      </Card>
                      <Card className="rounded-3xl border-emerald-100 p-5 shadow-sm">
                        <p className="text-sm text-gray-600">สต็อกรวมที่แสดง</p>
                        <p className="text-3xl font-bold text-gray-900">{totalQuantity.toLocaleString()}</p>
                      </Card>
                    </section>

                    <section className="mb-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                      <Card className="rounded-[28px] border-emerald-100 p-6 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                          <div className="rounded-2xl bg-emerald-100 p-2 text-emerald-700">
                            <LayoutGrid className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold text-gray-900">ค้นหาจากทุก workspace</h3>
                            <p className="text-sm text-gray-600">ค้นหาตามสินค้า ผู้ขาย หมวดหมู่ หรือชื่อ workspace</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <Input
                              type="text"
                              placeholder="ค้นหาสินค้า ผู้ขาย หรือชื่อ workspace..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="h-12 rounded-2xl pl-10 text-base"
                            />
                          </div>

                          <div>
                            <p className="mb-2 text-sm font-medium text-gray-700">เลือก workspace</p>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant={selectedWorkspace === null ? "default" : "outline"}
                                onClick={() => setSelectedWorkspace(null)}
                                size="sm"
                                className={selectedWorkspace === null ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                              >
                                ทั้งหมด
                              </Button>
                              {workspaces.map((workspace) => (
                                <Button
                                  key={workspace}
                                  variant={selectedWorkspace === workspace ? "default" : "outline"}
                                  onClick={() => setSelectedWorkspace(workspace)}
                                  size="sm"
                                  className={selectedWorkspace === workspace ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                                >
                                  {workspace}
                                </Button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="mb-2 text-sm font-medium text-gray-700">เลือกหมวดหมู่</p>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant={selectedCategory === null ? "default" : "outline"}
                                onClick={() => setSelectedCategory(null)}
                                size="sm"
                                className={selectedCategory === null ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                              >
                                ทั้งหมด
                              </Button>
                              {categories.map((category) => (
                                <Button
                                  key={category}
                                  variant={selectedCategory === category ? "default" : "outline"}
                                  onClick={() => setSelectedCategory(category)}
                                  size="sm"
                                  className={selectedCategory === category ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                                >
                                  {category}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </Card>

                      <Card className="rounded-[28px] border-emerald-100 p-6 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                          <div className="rounded-2xl bg-lime-100 p-2 text-lime-700">
                            <Sprout className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold text-gray-900">Workspace ที่กำลังขาย</h3>
                            <p className="text-sm text-gray-600">สรุปผู้ขายและจำนวนรายการจากแต่ละ workspace</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {workspaceSummaries.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-gray-200 p-5 text-sm text-gray-500">
                              ยังไม่มี workspace ที่มีสินค้าสาธารณะ
                            </div>
                          ) : (
                            workspaceSummaries.map((workspace) => (
                              <button
                                key={workspace.workspaceName}
                                type="button"
                                onClick={() => setSelectedWorkspace(workspace.workspaceName)}
                                className="flex w-full items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-4 text-left transition-colors hover:bg-emerald-100/60"
                              >
                                <div>
                                  <p className="font-semibold text-gray-900">{workspace.workspaceName}</p>
                                  <p className="text-sm text-gray-600">{workspace.sellers} ผู้ขาย • {workspace.categories} หมวดหมู่</p>
                                </div>
                                <Badge className="bg-emerald-600">{workspace.offers} รายการ</Badge>
                              </button>
                            ))
                          )}
                        </div>
                      </Card>
                    </section>
        <section id="buyer-products" className="mb-12">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-2xl font-semibold text-gray-900">รายการสินค้าจากทุก workspace</h3>
              <p className="text-sm text-gray-600">
                {selectedWorkspace ? `กำลังดูจาก workspace: ${selectedWorkspace}` : "กำลังแสดงสินค้าจากทุก workspace"}
                {selectedCategory ? ` • หมวดหมู่ ${selectedCategory}` : ""}
              </p>
            </div>
            <Badge variant="outline" className="w-fit rounded-full px-4 py-1 text-sm">
              {filteredProducts.length} รายการที่ตรงกับตัวกรอง
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <Card key={index} className="overflow-hidden rounded-[28px] p-4 shadow-sm">
                  <div className="h-48 animate-pulse rounded-2xl bg-gray-100" />
                  <div className="mt-4 space-y-3">
                    <div className="h-4 animate-pulse rounded bg-gray-100" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
                    <div className="h-10 animate-pulse rounded bg-gray-100" />
                  </div>
                </Card>
              ))
            ) : filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <Card
                  key={product.id}
                  className="overflow-hidden rounded-[28px] border-emerald-100 bg-white/95 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative h-48 overflow-hidden bg-gradient-to-br from-green-100 to-emerald-100">
                    {product.imageUrl ? (
                      <ImageWithFallback
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-16 w-16 text-green-600 opacity-50" />
                      </div>
                    )}
                    <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                      <Badge className="bg-white/90 text-emerald-900 hover:bg-white/90">{product.workspaceName}</Badge>
                      <Badge variant="outline" className="border-white/60 bg-white/80">{product.category}</Badge>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{product.name}</h3>
                        <div className="mt-2 space-y-1 text-sm text-gray-600">
                          <p className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-emerald-600" />
                            {product.workspaceName}
                          </p>
                          <p className="flex items-center gap-2">
                            <Leaf className="h-4 w-4 text-emerald-600" />
                            {product.sellerName}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-right">
                        <p className="text-xs text-emerald-700">ราคาขาย</p>
                        <p className="text-2xl font-bold text-emerald-800">฿{product.price.toFixed(2)}</p>
                        <p className="text-xs text-emerald-700">ต่อ {product.unit}</p>
                      </div>
                    </div>

                    <div className="mb-5 grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-4 text-sm">
                      <div>
                        <p className="text-gray-500">คงเหลือ</p>
                        <p className="font-semibold text-gray-900">{product.quantity.toLocaleString()} {product.unit}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">แหล่งขาย</p>
                        <p className="font-semibold text-gray-900">{product.workspaceName}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAddToCart(product.id)}
                        className="flex-1 rounded-2xl bg-green-600 hover:bg-green-700"
                      >
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        ซื้อ
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() => navigate("/price-search")}
                      >
                        เช็กราคา
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="col-span-full py-12 text-center">
                <Package className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                <p className="text-lg text-gray-500">ไม่พบสินค้าที่คุณค้นหา</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-emerald-100 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-2xl font-bold">ติดต่อเรา</h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="flex items-start gap-4">
              <Mail className="mt-1 h-6 w-6 flex-shrink-0 text-green-600" />
              <div>
                <h3 className="mb-1 font-bold">อีเมล</h3>
                <p className="text-gray-600">contact@market.co.th</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <MapPin className="mt-1 h-6 w-6 flex-shrink-0 text-green-600" />
              <div>
                <h3 className="mb-1 font-bold">ที่ตั้ง</h3>
                <p className="text-gray-600">ตลาดกลาง กรุงเทพฯ</p>
              </div>
            </div>
          </div>
        </section>
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
