import { useMemo, useState } from "react";
import { useData } from "../context/data-context";
import { useAuth } from "../context/auth-context";
import { useWorkspace } from "../context/workspace-context";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Search, Store, Package2, Users, Layers3, Filter, Edit, Trash2 } from "lucide-react";
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

function normalizeMarketplaceName(name: string) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function Marketplace() {
  const { products, deleteProduct } = useData();
  const { user } = useAuth();
  const { isGlobalAdmin, getUserRole, getUserPermissions } = useWorkspace();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ทั้งหมด");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const userRole = getUserRole();
  const permissions = getUserPermissions();
  const canManageProducts = permissions.canEdit;
  const selectedEditingProduct =
    editingProductId ? products.find((product) => product.id === editingProductId) || null : null;

  const categories = useMemo(
    () => ["ทั้งหมด", ...new Set(products.map((product) => product.category))],
    [products]
  );

  const visibleProducts = useMemo(() => {
    return products
      .filter((product) => {
        const matchesSearch =
          product.name.toLowerCase().includes(search.toLowerCase()) ||
          product.category.toLowerCase().includes(search.toLowerCase()) ||
          product.sellerName.toLowerCase().includes(search.toLowerCase());
        const matchesCategory =
          categoryFilter === "ทั้งหมด" || product.category === categoryFilter;

        return matchesSearch && matchesCategory;
      })
      .sort((left, right) => {
        if (left.category !== right.category) {
          return left.category.localeCompare(right.category, "th");
        }
        const leftName = normalizeMarketplaceName(left.name);
        const rightName = normalizeMarketplaceName(right.name);
        if (leftName !== rightName) {
          return leftName.localeCompare(rightName, "th");
        }
        return left.price - right.price;
      });
  }, [categoryFilter, products, search]);

  const groupedByCategory = useMemo(() => {
    const categoryMap = new Map<
      string,
      Array<{
        groupKey: string;
        displayName: string;
        offers: typeof visibleProducts;
      }>
    >();

    for (const product of visibleProducts) {
      const categoryGroups = categoryMap.get(product.category) || [];
      const groupKey = normalizeMarketplaceName(product.name);
      const existingGroup = categoryGroups.find((group) => group.groupKey === groupKey);

      if (existingGroup) {
        existingGroup.offers.push(product);
        continue;
      }

      categoryGroups.push({
        groupKey,
        displayName: product.name,
        offers: [product],
      });
      categoryMap.set(product.category, categoryGroups);
    }

    return Array.from(categoryMap.entries()).map(([category, groups]) => ({
      category,
      groups: groups
        .map((group) => ({
          ...group,
          offers: [...group.offers].sort((left, right) => left.price - right.price),
        }))
        .sort((left, right) => left.displayName.localeCompare(right.displayName, "th")),
    }));
  }, [visibleProducts]);

  const summary = useMemo(() => {
    const sellerCount = new Set(products.map((product) => product.sellerId)).size;
    const groupedProductCount = new Set(products.map((product) => normalizeMarketplaceName(product.name))).size;
    return {
      offers: products.length,
      sellers: sellerCount,
      groups: groupedProductCount,
      categories: categories.length - 1,
    };
  }, [categories.length, products]);

  const canManageOffer = (sellerId: string) => {
    if (!canManageProducts) return false;
    if (isGlobalAdmin || userRole === "owner") return true;
    return sellerId === user?.id;
  };

  const handleDeleteProduct = async () => {
    if (!deletingProductId) return;
    await deleteProduct(deletingProductId);
    setDeletingProductId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">ตลาดกลางสินค้าเกษตร</h2>
          <p className="mt-1 text-gray-600">
            แสดงสินค้าแบบหน้าผู้ซื้อเพื่อเปรียบเทียบข้อเสนอได้ง่าย ไม่มีระบบตะกร้า และให้ผู้ดูแลแก้ไขสินค้าได้ทันที
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {user ? `กำลังดูในชื่อ ${user.name}` : "เข้าสู่ระบบเพื่อดูข้อมูลตลาดกลาง"}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ข้อเสนอขายทั้งหมด</p>
              <p className="text-3xl font-bold text-gray-900">{summary.offers}</p>
            </div>
            <Store className="h-6 w-6 text-emerald-600" />
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ผู้ค้าทั้งหมด</p>
              <p className="text-3xl font-bold text-gray-900">{summary.sellers}</p>
            </div>
            <Users className="h-6 w-6 text-blue-600" />
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">กลุ่มชื่อสินค้า</p>
              <p className="text-3xl font-bold text-gray-900">{summary.groups}</p>
            </div>
            <Layers3 className="h-6 w-6 text-amber-600" />
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">หมวดหมู่</p>
              <p className="text-3xl font-bold text-gray-900">{summary.categories}</p>
            </div>
            <Package2 className="h-6 w-6 text-violet-600" />
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาตามชื่อสินค้า หมวดหมู่ หรือชื่อผู้ค้า"
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

      {groupedByCategory.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">ยังไม่มีสินค้าที่ตรงกับเงื่อนไขที่ค้นหา</Card>
      ) : (
        groupedByCategory.map(({ category, groups }) => (
          <div key={category} className="space-y-4">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-semibold text-gray-900">{category}</h3>
              <Badge variant="outline">{groups.length} กลุ่มสินค้า</Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {groups.map((group) => {
                const bestOffer = group.offers[0];
                return (
                  <Card key={`${category}-${group.groupKey}`} className="border-emerald-100 p-5 shadow-sm">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">{group.displayName}</h4>
                        <p className="text-sm text-gray-600">
                          จัดเรียงตามราคาต่ำสุดก่อน เพื่อให้ผู้ซื้อเทียบข้อเสนอของสินค้าชื่อเดียวกันได้ทันที
                        </p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 px-3 py-2 text-right">
                        <p className="text-xs text-emerald-700">เริ่มต้นที่</p>
                        <p className="text-lg font-bold text-emerald-800">฿{bestOffer.price.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {group.offers.map((offer) => (
                        <div
                          key={offer.id}
                          className="rounded-2xl border border-gray-200 bg-white px-4 py-3"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-4">
                              <div className="h-20 w-20 overflow-hidden rounded-2xl bg-emerald-50">
                                {offer.imageUrl ? (
                                  <ImageWithFallback
                                    src={offer.imageUrl}
                                    alt={offer.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-emerald-600">
                                    <Package2 className="h-8 w-8 opacity-60" />
                                  </div>
                                )}
                              </div>
                              <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900">{offer.sellerName}</p>
                                {offer.sellerId === user?.id && (
                                  <Badge variant="secondary">สินค้าของฉัน</Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">
                                คงเหลือ {offer.quantity.toLocaleString()} {offer.unit}
                                {offer.minStock > 0 ? ` • แจ้งเตือนเมื่อเหลือ ${offer.minStock.toLocaleString()} ${offer.unit}` : ""}
                              </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-gray-900">฿{offer.price.toFixed(2)}</p>
                              <p className="text-sm text-gray-500">ต่อ {offer.unit}</p>
                              {canManageOffer(offer.sellerId) && (
                                <div className="mt-2 flex items-center justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setEditingProductId(offer.id)}
                                  >
                                    <Edit className="mr-1 h-3.5 w-3.5" />
                                    แก้ไข
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => setDeletingProductId(offer.id)}
                                  >
                                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                                    ลบ
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
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