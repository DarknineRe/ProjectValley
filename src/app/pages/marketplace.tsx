import { useMemo, useState } from "react";
import { useData } from "../context/data-context";
import { useAuth } from "../context/auth-context";
import { useWorkspace } from "../context/workspace-context";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Search, Store, Package2, Users, Filter, Sparkles, Edit, Trash2 } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { EditProductDialog } from "../components/edit-product-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

export function Marketplace() {
  const { products, deleteProduct } = useData();
  const { user } = useAuth();
  const { currentWorkspace, isGlobalAdmin, getUserRole, getUserPermissions } = useWorkspace();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ทั้งหมด");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const userRole = getUserRole();
  const permissions = getUserPermissions();
  const selectedEditingProduct =
    editingProductId ? products.find((product) => product.id === editingProductId) || null : null;

  const categories = useMemo(
    () => ["ทั้งหมด", ...new Set(products.map((product) => product.category))],
    [products]
  );

  const visibleProducts = useMemo(() => {
    return products
      .filter((product) => {
        const q = search.toLowerCase();
        const matchesSearch =
          product.name.toLowerCase().includes(q) ||
          product.category.toLowerCase().includes(q) ||
          product.sellerName.toLowerCase().includes(q);
        const matchesCategory =
          categoryFilter === "ทั้งหมด" || product.category === categoryFilter;
        return matchesSearch && matchesCategory;
      })
      .sort((left, right) => {
        if (left.price !== right.price) return left.price - right.price;
        return left.name.localeCompare(right.name, "th");
      });
  }, [categoryFilter, products, search]);

  const featuredOffers = useMemo(() => visibleProducts.slice(0, 3), [visibleProducts]);

  const summary = useMemo(() => {
    const sellerCount = new Set(products.map((product) => product.sellerId)).size;
    return {
      offers: products.length,
      sellers: sellerCount,
      categories: categories.length - 1,
    };
  }, [categories.length, products]);

  const canManageOffer = (sellerId: string) => {
    if (!permissions.canEdit) return false;
    if (isGlobalAdmin || userRole === "owner") return true;
    return sellerId === user?.id;
  };

  const handleDeleteProduct = async () => {
    if (!deletingProductId) return;
    await deleteProduct(deletingProductId);
    setDeletingProductId(null);
  };

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-emerald-800 bg-[radial-gradient(circle_at_top_right,_#166534_0%,_#064e3b_45%,_#052e16_100%)] px-6 py-10 text-white shadow-xl md:px-10">
        <div className="absolute -top-16 -right-8 h-48 w-48 rounded-full bg-emerald-300/10 blur-2xl" />
        <div className="absolute bottom-0 left-0 h-24 w-full bg-gradient-to-t from-black/25 to-transparent" />
        <div className="relative">
          <p className="mb-2 text-xs uppercase tracking-[0.3em] text-emerald-200">Welcome To Marketplace</p>
          <h2 className="text-3xl font-bold md:text-4xl">Discover Our Latest Collection</h2>
          <p className="mt-2 max-w-2xl text-sm text-neutral-200 md:text-base">
            ตลาดกลางสไตล์โชว์เคสสินค้า เน้นดูรายการและเทียบข้อเสนอแบบไม่มีตะกร้า โดยผู้ดูแลยังแก้ไขสินค้าได้ตามปกติ
          </p>
          <p className="mt-2 text-xs text-emerald-200">
            Workspace ปัจจุบัน: {currentWorkspace?.name || "-"}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-200/10 px-4 py-2 text-sm text-emerald-100">
            <Sparkles className="h-4 w-4" />
            {user ? `กำลังดูในชื่อ ${user.name}` : "เข้าสู่ระบบเพื่อดูข้อมูลตลาดกลาง"}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-neutral-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">รายการสินค้าทั้งหมด</p>
              <p className="text-3xl font-bold text-gray-900">{summary.offers}</p>
            </div>
            <Store className="h-6 w-6 text-emerald-700" />
          </div>
        </Card>
        <Card className="border-neutral-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ผู้ขายทั้งหมด</p>
              <p className="text-3xl font-bold text-gray-900">{summary.sellers}</p>
            </div>
            <Users className="h-6 w-6 text-emerald-700" />
          </div>
        </Card>
        <Card className="border-neutral-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">หมวดหมู่</p>
              <p className="text-3xl font-bold text-gray-900">{summary.categories}</p>
            </div>
            <Package2 className="h-6 w-6 text-emerald-700" />
          </div>
        </Card>
      </div>

      <Card className="border-neutral-200 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาตามชื่อสินค้า หมวดหมู่ หรือชื่อผู้ขาย"
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const isActive = category === categoryFilter;
              return (
                <Button
                  key={category}
                  type="button"
                  variant={isActive ? "default" : "outline"}
                  className={isActive ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                  onClick={() => setCategoryFilter(category)}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  {category}
                </Button>
              );
            })}
          </div>
        </div>
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">Limited Time Offers</h3>
          <Badge className="bg-emerald-600 hover:bg-emerald-600">Top 3 ราคาดีสุด</Badge>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {featuredOffers.map((offer) => (
            <Card key={`featured-${offer.id}`} className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4">
              <p className="text-sm font-medium text-emerald-800">{offer.name}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">฿{offer.price.toFixed(2)}</p>
              <p className="text-xs text-gray-500 line-through">฿{(offer.price * 1.25).toFixed(2)}</p>
              <p className="mt-2 text-xs text-gray-600">โดย {offer.sellerName}</p>
            </Card>
          ))}
        </div>
      </section>

      {visibleProducts.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">ยังไม่มีสินค้าที่ตรงกับเงื่อนไขที่ค้นหา</Card>
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleProducts.map((offer) => (
            <Card key={offer.id} className="overflow-hidden border-neutral-200 p-0 shadow-sm">
              <div className="h-48 w-full bg-neutral-100">
                {offer.imageUrl ? (
                  <ImageWithFallback
                    src={offer.imageUrl}
                    alt={offer.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-neutral-400">
                    <Package2 className="h-10 w-10" />
                  </div>
                )}
              </div>

              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">{offer.name}</h4>
                    <p className="text-sm text-gray-600">{offer.category}</p>
                  </div>
                  <Badge variant="outline">{offer.unit}</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">ผู้ขาย: {offer.sellerName}</p>
                  <p className="text-sm text-gray-600">คงเหลือ {offer.quantity.toLocaleString()}</p>
                </div>

                <div className="flex items-end justify-between">
                  <p className="text-2xl font-bold text-emerald-800">฿{offer.price.toFixed(2)}</p>
                  {offer.sellerId === user?.id && <Badge variant="secondary">สินค้าของฉัน</Badge>}
                </div>

                {canManageOffer(offer.sellerId) && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingProductId(offer.id)}
                    >
                      <Edit className="mr-1 h-3.5 w-3.5" />
                      แก้ไข
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setDeletingProductId(offer.id)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      ลบ
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </section>
      )}

      {selectedEditingProduct && (
        <EditProductDialog
          product={selectedEditingProduct}
          open={!!selectedEditingProduct}
          onOpenChange={(open) => {
            if (!open) {
              setEditingProductId(null);
            }
          }}
        />
      )}

      <AlertDialog
        open={!!deletingProductId}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingProductId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบสินค้า</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการลบรายการสินค้านี้ออกจากตลาดกลางใช่หรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDeleteProduct}>
              ลบสินค้า
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}