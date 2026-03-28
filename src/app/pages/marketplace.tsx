import { useMemo, useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/auth-context";
import { useWorkspace } from "../context/workspace-context";
import { useData } from "../context/data-context";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Skeleton } from "../components/ui/skeleton";
import { Search, Store, Package2, Users, Filter, Edit, Trash2, MessageSquarePlus, Check, X, Clock, ChevronLeft, ChevronRight, Building2, ChevronDown, ChevronUp, Mail } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { EditProductDialog } from "../components/edit-product-dialog";
import { toast } from "sonner";
import { API_BASE } from "../../api";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

const priceFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
});

const PAGE_SIZE = 12;

export interface Product {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  price: number;
  imageUrl?: string;
  sellerId: string;
  sellerName: string;
  minStock: number;
  harvestDate?: Date;
  expireDate?: Date;
  lastUpdated: Date;
  workspace_id?: string;
  workspace_name?: string;
  workspace_owner_id?: string;
  workspace_owner_name?: string;
  workspace_owner_email?: string;
}

interface ItemChangeRequest {
  id: string;
  product_id: string;
  product_name: string;
  request_type: "delete" | "decrease";
  decrease_by: number | null;
  requester_name: string;
  message: string;
  status: "pending" | "accepted" | "rejected";
  created_at?: string;
}

export function Marketplace() {
  const { user } = useAuth();
  const { isGlobalAdmin } = useWorkspace();
  const { refreshData } = useData();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ทั้งหมด");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [requestingProduct, setRequestingProduct] = useState<Product | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestType, setRequestType] = useState<"delete" | "decrease">("delete");
  const [decreaseBy, setDecreaseBy] = useState<string>("");
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [ownerRequests, setOwnerRequests] = useState<ItemChangeRequest[]>([]);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [workspaceFilter, setWorkspaceFilter] = useState<string>("ทั้งหมด");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [allOwnerRequests, setAllOwnerRequests] = useState<ItemChangeRequest[]>([]);
  const [showAdminOverview, setShowAdminOverview] = useState(false);
  const [requestTab, setRequestTab] = useState<"pending" | "history">("pending");

  // Fetch all products from all workspaces
  const loadAllProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/all-products`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.map((p: any) => ({
          id: p.id,
          name: p.name ?? p.product_name ?? p.productName ?? '',
          category: p.category ?? 'ไม่ระบุหมวดหมู่',
          quantity: Number(p.quantity ?? 0),
          unit: p.unit ?? 'หน่วย',
          price: Number(p.price ?? 0),
          imageUrl: p.image_url ?? p.imageUrl,
          sellerId: p.workspace_owner_id ?? p.workspaceOwnerId ?? p.seller_id ?? p.sellerId ?? 'legacy',
          sellerName: p.workspace_owner_name ?? p.workspaceOwnerName ?? p.seller_name ?? p.sellerName ?? 'ไม่ระบุผู้ขาย',
          minStock: p.minstock ?? p.minStock ?? 0,
          harvestDate: p.harvestdate ? new Date(p.harvestdate) : p.harvestDate ? new Date(p.harvestDate) : undefined,
          expireDate: p.expiredate ? new Date(p.expiredate) : p.expireDate ? new Date(p.expireDate) : undefined,
          lastUpdated: p.lastupdated ? new Date(p.lastupdated) : p.lastUpdated ? new Date(p.lastUpdated) : new Date(),
          workspace_id: p.workspace_id,
          workspace_name: p.workspace_name ?? 'ไม่ระบุ Workspace',
          workspace_owner_id: p.workspace_owner_id,
          workspace_owner_name: p.workspace_owner_name,
          workspace_owner_email: p.workspace_owner_email,
        })));
      } else {
        const errorText = await res.text();
        console.error(`Error loading products: ${res.status} ${errorText}`);
        toast.error(`ไม่สามารถโหลดข้อมูลสินค้า (${res.status})`);
      }
    } catch (error) {
      console.error('Error loading marketplace products:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllProducts();
  }, [loadAllProducts]);

  useEffect(() => {
    const loadOwnerRequests = async () => {
      if (!user?.id) return;
      try {
        const res = await fetch(`${API_BASE}/api/item-requests?seller_id=${encodeURIComponent(user.id)}`);
        if (!res.ok) return;
        const data = await res.json();
        const requests = Array.isArray(data) ? data : [];
        setOwnerRequests(requests.filter((r) => r.status === "pending"));
        setAllOwnerRequests(requests);
      } catch {}
    };
    loadOwnerRequests();
  }, [user?.id]);

  const selectedEditingProduct =
    editingProductId ? products.find((product) => product.id === editingProductId) || null : null;

  const categories = useMemo(
    () => ["ทั้งหมด", ...new Set(products.map((product) => product.category))],
    [products]
  );

  const workspaceNames = useMemo(
    () => ["ทั้งหมด", ...new Set(products.map((p) => p.workspace_name || "ไม่ระบุ"))],
    [products]
  );

  const getExpireStatus = (expireDate?: Date): "expired" | "soon" | "ok" | "none" => {
    if (!expireDate) return "none";
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const exp = new Date(expireDate);
    exp.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return "expired";
    if (diffDays <= 3) return "soon";
    return "ok";
  };

  const visibleProducts = useMemo(() => {
    return products
      .filter((product) => {
        const q = search.toLowerCase();
        const matchesSearch =
          product.name.toLowerCase().includes(q) ||
          product.category.toLowerCase().includes(q) ||
          product.sellerName.toLowerCase().includes(q) ||
          (product.workspace_name || "").toLowerCase().includes(q);
        const matchesCategory =
          categoryFilter === "ทั้งหมด" || product.category === categoryFilter;
        const matchesWorkspace =
          workspaceFilter === "ทั้งหมด" || (product.workspace_name || "ไม่ระบุ") === workspaceFilter;
        return matchesSearch && matchesCategory && matchesWorkspace;
      })
      .sort((left, right) => {
        if (left.price !== right.price) return left.price - right.price;
        return left.name.localeCompare(right.name, "th");
      });
  }, [categoryFilter, workspaceFilter, products, search]);

  const totalPages = Math.ceil(visibleProducts.length / PAGE_SIZE);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return visibleProducts.slice(start, start + PAGE_SIZE);
  }, [visibleProducts, currentPage]);

  const workspaceOverview = useMemo(() => {
    if (!isGlobalAdmin) return [];
    const map = new Map<string, { name: string; count: number; totalValue: number; expiring: number; expired: number }>();
    for (const p of products) {
      const key = p.workspace_id || "default";
      const name = p.workspace_name || "ไม่ระบุ";
      const existing = map.get(key) || { name, count: 0, totalValue: 0, expiring: 0, expired: 0 };
      existing.count++;
      existing.totalValue += p.price * p.quantity;
      const expStatus = getExpireStatus(p.expireDate);
      if (expStatus === "expired") existing.expired++;
      else if (expStatus === "soon") existing.expiring++;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [products, isGlobalAdmin]);

  const summary = useMemo(() => {
    const sellerCount = new Set(products.map((product) => product.sellerId)).size;
    return {
      offers: products.length,
      sellers: sellerCount,
      categories: categories.length - 1,
    };
  }, [categories.length, products]);

  const hasActiveFilters = search.trim().length > 0 || categoryFilter !== "ทั้งหมด" || workspaceFilter !== "ทั้งหมด";

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, workspaceFilter]);

  const canManageOffer = (sellerId: string) => {
    return sellerId === user?.id;
  };

  const handleDeleteProduct = async () => {
    if (!deletingProductId) return;
    const productToDelete = products.find((product) => product.id === deletingProductId);
    if (!productToDelete) {
      toast.error('ไม่พบข้อมูลสินค้าที่ต้องการลบ');
      return;
    }

    try {
      const workspaceQuery = productToDelete.workspace_id
        ? `?workspace_id=${encodeURIComponent(productToDelete.workspace_id)}`
        : '';
      const res = await fetch(`${API_BASE}/api/products/${deletingProductId}${workspaceQuery}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.changes > 0) {
        setProducts(prev => prev.filter(p => p.id !== deletingProductId));
        toast.success('ลบสินค้าสำเร็จ');
        if (selectedProduct?.id === deletingProductId) setSelectedProduct(null);
        setDeletingProductId(null);
      } else {
        toast.error(data?.error || 'ไม่สามารถลบสินค้า');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการลบสินค้า');
    }
  };

  const handleSendRequest = async () => {
    if (!requestingProduct || !user || !requestMessage.trim()) return;
    const decreaseAmount = Number(decreaseBy || 0);
    if (requestType === "decrease" && (!Number.isFinite(decreaseAmount) || decreaseAmount <= 0)) {
      toast.error("กรุณาระบุจำนวนที่ต้องการลดให้มากกว่า 0");
      return;
    }
    setIsSendingRequest(true);
    try {
      const res = await fetch(`${API_BASE}/api/item-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: requestingProduct.id,
          productName: requestingProduct.name,
          requesterId: user.id,
          requesterName: user.name,
          requesterEmail: user.email,
          sellerId: requestingProduct.sellerId,
          sellerName: requestingProduct.sellerName,
          sellerEmail: requestingProduct.workspace_owner_email,
          requestType,
          decreaseBy: requestType === "decrease" ? decreaseAmount : null,
          message: requestMessage.trim(),
        }),
      });
      if (res.ok) {
        toast.success("ส่งคำขอถึงเจ้าของ Workspace เรียบร้อยแล้ว");
        setRequestingProduct(null);
        setRequestMessage("");
        setRequestType("delete");
        setDecreaseBy("");
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "ไม่สามารถส่งคำขอได้");
      }
    } catch {
      toast.error("เกิดข้อผิดพลาดในการส่งคำขอ");
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleRequestDecision = async (requestId: string, status: "accepted" | "rejected") => {
    setUpdatingRequestId(requestId);
    try {
      const res = await fetch(`${API_BASE}/api/item-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const req = ownerRequests.find((r) => r.id === requestId);
        setOwnerRequests((prev) => prev.filter((r) => r.id !== requestId));
        setAllOwnerRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status } : r)));
        toast.success(status === "accepted" ? "ยืนยันคำขอเรียบร้อยแล้ว" : "ปฏิเสธคำขอเรียบร้อยแล้ว");
        if (status === "accepted" && req) {
          if (req.request_type === "delete") {
            setProducts((prev) => prev.filter((p) => p.id !== req.product_id));
          } else if (req.request_type === "decrease") {
            setProducts((prev) => prev.map((p) =>
              p.id === req.product_id
                ? { ...p, quantity: Math.max(0, p.quantity - Number(req.decrease_by || 0)) }
                : p
            ));
          }
          // Sync the inventory page's data-context so it also reflects the change
          refreshData();
        }
      } else {
        toast.error("ไม่สามารถอัปเดตคำขอได้");
      }
    } catch {
      toast.error("เกิดข้อผิดพลาดในการอัปเดตคำขอ");
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const getPageNumbers = (current: number, total: number): (number | "...")[] => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (current > 3) pages.push("...");
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (current < total - 2) pages.push("...");
    pages.push(total);
    return pages;
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <section className="rounded-2xl border bg-white px-6 py-8 md:px-10">
          <Skeleton className="mb-2 h-3 w-24" />
          <Skeleton className="h-9 w-64 mt-2" />
          <Skeleton className="h-4 w-96 mt-3" />
        </section>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="border-neutral-200 p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
            </Card>
          ))}
        </div>
        <Card className="border-neutral-200 p-6">
          <Skeleton className="h-10 w-full" />
        </Card>
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="overflow-hidden border-neutral-200 p-0">
              <Skeleton className="h-48 w-full" />
              <div className="space-y-3 p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-24 mt-2" />
              </div>
            </Card>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-white px-6 py-8 md:px-10">
        <div className="relative">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-green-600">Marketplace</p>
          <h2 className="text-3xl font-semibold text-green-900 md:text-4xl">ตลาดกลางสินค้า</h2>
          <p className="mt-3 max-w-3xl text-sm text-green-700 md:text-base">
            ผู้ดูแลระบบต้องส่งคำขอให้เจ้าของ Workspace ยืนยันก่อนลบหรือลดจำนวนสินค้า
          </p>
        </div>
      </section>

      {isGlobalAdmin && workspaceOverview.length > 0 && (
        <Card className="border-blue-200 bg-blue-50 p-5">
          <button
            type="button"
            className="flex w-full items-center justify-between"
            onClick={() => setShowAdminOverview((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-blue-900">
                ภาพรวม Workspace ({workspaceOverview.length})
              </h3>
            </div>
            {showAdminOverview ? (
              <ChevronUp className="h-4 w-4 text-blue-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-blue-600" />
            )}
          </button>
          {showAdminOverview && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-blue-200 text-left text-blue-700">
                    <th className="pb-2 pr-4 font-medium">Workspace</th>
                    <th className="pb-2 pr-4 text-right font-medium">สินค้า</th>
                    <th className="pb-2 pr-4 text-right font-medium">มูลค่ารวม</th>
                    <th className="pb-2 pr-4 text-right font-medium">ใกล้หมดอายุ</th>
                    <th className="pb-2 text-right font-medium">หมดอายุแล้ว</th>
                  </tr>
                </thead>
                <tbody>
                  {workspaceOverview.map((ws) => (
                    <tr key={ws.name} className="border-b border-blue-100 last:border-0">
                      <td className="py-2 pr-4 font-medium text-gray-900">{ws.name}</td>
                      <td className="py-2 pr-4 text-right text-gray-700">{ws.count}</td>
                      <td className="py-2 pr-4 text-right text-gray-700">
                        {priceFormatter.format(ws.totalValue)}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {ws.expiring > 0 ? (
                          <span className="font-medium text-orange-600">{ws.expiring}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {ws.expired > 0 ? (
                          <span className="font-medium text-red-600">{ws.expired}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {allOwnerRequests.length > 0 && (
        <Card className="border-green-200 bg-green-50 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-green-900">คำขอสินค้า</h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={requestTab === "pending" ? "default" : "outline"}
                className={requestTab === "pending" ? "bg-green-600 hover:bg-green-700" : ""}
                onClick={() => setRequestTab("pending")}
              >
                รอยืนยัน
                {ownerRequests.length > 0 && (
                  <span className="ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                    {ownerRequests.length}
                  </span>
                )}
              </Button>
              <Button
                size="sm"
                variant={requestTab === "history" ? "default" : "outline"}
                className={requestTab === "history" ? "bg-green-600 hover:bg-green-700" : ""}
                onClick={() => setRequestTab("history")}
              >
                ประวัติ
              </Button>
            </div>
          </div>

          {requestTab === "pending" && (
            <div className="mt-4">
              {ownerRequests.length === 0 ? (
                <p className="text-sm text-green-700">ไม่มีคำขอที่รอยืนยัน</p>
              ) : (
                <div className="space-y-3">
                  {ownerRequests.map((req) => (
                    <div key={req.id} className="rounded-lg border border-green-200 bg-white p-4">
                      <p className="font-semibold text-gray-900">{req.product_name}</p>
                      <p className="text-sm text-green-800 mt-1">
                        {req.request_type === "delete"
                          ? "ขอลบรายการสินค้า"
                          : `ขอลดจำนวนสินค้า ${Number(req.decrease_by || 0).toLocaleString("th-TH")}`}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">ผู้ส่งคำขอ: {req.requester_name}</p>
                      <p className="text-sm text-gray-600 mt-1">เหตุผล: {req.message}</p>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          disabled={updatingRequestId === req.id}
                          onClick={() => handleRequestDecision(req.id, "accepted")}
                        >
                          <Check className="mr-1 h-3.5 w-3.5" />
                          ยืนยัน
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          disabled={updatingRequestId === req.id}
                          onClick={() => handleRequestDecision(req.id, "rejected")}
                        >
                          <X className="mr-1 h-3.5 w-3.5" />
                          ปฏิเสธ
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {requestTab === "history" && (
            <div className="mt-4">
              {allOwnerRequests.filter((r) => r.status !== "pending").length === 0 ? (
                <p className="text-sm text-green-700">ยังไม่มีประวัติคำขอ</p>
              ) : (
                <div className="space-y-3">
                  {allOwnerRequests
                    .filter((r) => r.status !== "pending")
                    .map((req) => (
                      <div key={req.id} className="rounded-lg border border-green-100 bg-white p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{req.product_name}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              {req.request_type === "delete"
                                ? "ขอลบรายการสินค้า"
                                : `ขอลดจำนวนสินค้า ${Number(req.decrease_by || 0).toLocaleString("th-TH")}`}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">ผู้ส่งคำขอ: {req.requester_name}</p>
                            <p className="text-sm text-gray-500">เหตุผล: {req.message}</p>
                          </div>
                          <Badge
                            className={
                              req.status === "accepted"
                                ? "bg-green-100 text-green-800 hover:bg-green-100 shrink-0"
                                : "bg-red-100 text-red-800 hover:bg-red-100 shrink-0"
                            }
                          >
                            {req.status === "accepted" ? "ยืนยันแล้ว" : "ปฏิเสธแล้ว"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-neutral-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">รายการสินค้าทั้งหมด</p>
              <p className="text-3xl font-bold text-gray-900">{summary.offers}</p>
            </div>
            <Store className="h-6 w-6 text-green-700" />
          </div>
        </Card>
        <Card className="border-neutral-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ผู้ขายทั้งหมด</p>
              <p className="text-3xl font-bold text-gray-900">{summary.sellers}</p>
            </div>
            <Users className="h-6 w-6 text-green-700" />
          </div>
        </Card>
        <Card className="border-neutral-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">หมวดหมู่</p>
              <p className="text-3xl font-bold text-gray-900">{summary.categories}</p>
            </div>
            <Package2 className="h-6 w-6 text-green-700" />
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
              placeholder="ค้นหาตามชื่อสินค้า หมวดหมู่ หรือผู้ขาย"
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
                  className={isActive ? "bg-green-600 hover:bg-green-700" : ""}
                  onClick={() => setCategoryFilter(category)}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  {category}
                </Button>
              );
            })}
          </div>
        </div>
        {workspaceNames.length > 2 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
            <Building2 className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-500">Workspace:</span>
            <Select value={workspaceFilter} onValueChange={(v) => setWorkspaceFilter(v)}>
              <SelectTrigger className="h-8 w-52 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workspaceNames.map((ws) => (
                  <SelectItem key={ws} value={ws}>
                    {ws}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {workspaceFilter !== "ทั้งหมด" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-gray-500"
                onClick={() => setWorkspaceFilter("ทั้งหมด")}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                ล้าง
              </Button>
            )}
          </div>
        )}
        <div className="mt-4 flex flex-col gap-3 border-t border-neutral-100 pt-4 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
          <p>
            แสดงผล <span className="font-semibold text-gray-900">{visibleProducts.length}</span> จาก <span className="font-semibold text-gray-900">{products.length}</span> รายการ
          </p>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearch("");
                setCategoryFilter("ทั้งหมด");
                setWorkspaceFilter("ทั้งหมด");
              }}
            >
              ล้างตัวกรอง
            </Button>
          )}
        </div>
      </Card>

      {visibleProducts.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">
          <p className="text-base font-medium text-gray-700">ยังไม่พบสินค้าที่ตรงกับเงื่อนไข</p>
          <p className="mt-2 text-sm text-gray-500">ลองค้นหาด้วยชื่อสินค้า ชื่อผู้ขาย หรือกดล้างตัวกรองเพื่อดูทั้งหมด</p>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearch("");
                setCategoryFilter("ทั้งหมด");
                setWorkspaceFilter("ทั้งหมด");
              }}
            >
              แสดงสินค้าทั้งหมด
            </Button>
          )}
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginatedProducts.map((offer) => (
              <Card key={offer.id} className="overflow-hidden border-neutral-200 p-0 shadow-sm">
                <button
                  type="button"
                  className="h-48 w-full block bg-neutral-100 cursor-pointer"
                  onClick={() => setSelectedProduct(offer)}
                >
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
                </button>

                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <button
                        type="button"
                        className="text-left hover:text-green-700 transition-colors"
                        onClick={() => setSelectedProduct(offer)}
                      >
                        <h4 className="text-lg font-semibold text-gray-900">{offer.name}</h4>
                      </button>
                      <p className="text-sm text-gray-600">{offer.category}</p>
                      {offer.workspace_name && (
                        <div className="mt-0.5 flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-400">{offer.workspace_name}</span>
                        </div>
                      )}
                    </div>
                    <Badge variant="outline">{offer.unit}</Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {offer.quantity <= offer.minStock && offer.minStock > 0 && (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">สต็อกใกล้หมด</Badge>
                    )}
                    {getExpireStatus(offer.expireDate) === "expired" && (
                      <Badge variant="destructive">หมดอายุ</Badge>
                    )}
                    {getExpireStatus(offer.expireDate) === "soon" && (
                      <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">ใกล้หมดอายุ</Badge>
                    )}
                  </div>

                  <div className="space-y-1 text-sm text-gray-600">
                    <p>ผู้ขาย: {offer.sellerName}</p>
                    <p>คงเหลือ {offer.quantity.toLocaleString("th-TH")} {offer.unit}</p>
                    {offer.expireDate && (
                      <p className={`flex items-center gap-1 ${getExpireStatus(offer.expireDate) === "expired" ? "text-red-600 font-medium" : getExpireStatus(offer.expireDate) === "soon" ? "text-orange-600 font-medium" : ""}`}>
                        <Clock className="h-3.5 w-3.5" />
                        หมดอายุ {dateFormatter.format(offer.expireDate)}
                      </p>
                    )}
                    <p>อัปเดตล่าสุด {dateFormatter.format(offer.lastUpdated)}</p>
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold text-green-800">{priceFormatter.format(offer.price)}</p>
                      <p className="text-xs text-gray-500">ต่อ {offer.unit}</p>
                    </div>
                    {offer.sellerId === user?.id && <Badge variant="secondary">สินค้าของฉัน</Badge>}
                  </div>

                  {canManageOffer(offer.sellerId) ? (
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
                  ) : user && isGlobalAdmin && offer.sellerId !== user.id && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full mt-1 border-green-300 text-green-700 hover:bg-green-50"
                      onClick={() => {
                        setRequestingProduct(offer);
                        setRequestMessage("");
                        setRequestType("delete");
                        setDecreaseBy("");
                      }}
                    >
                      <MessageSquarePlus className="mr-1 h-3.5 w-3.5" />
                      ส่งคำขอถึงเจ้าของ
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </section>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {getPageNumbers(currentPage, totalPages).map((page, idx) =>
                page === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">
                    …
                  </span>
                ) : (
                  <Button
                    key={page}
                    variant={page === currentPage ? "default" : "outline"}
                    size="sm"
                    className={page === currentPage ? "bg-green-600 hover:bg-green-700" : ""}
                    onClick={() => setCurrentPage(page as number)}
                  >
                    {page}
                  </Button>
                )
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
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
          onSuccess={loadAllProducts}
        />
      )}

      <Dialog open={!!selectedProduct} onOpenChange={(open) => { if (!open) setSelectedProduct(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              {selectedProduct.imageUrl && (
                <div className="h-56 w-full overflow-hidden rounded-lg bg-neutral-100">
                  <ImageWithFallback
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <p className="text-gray-500">หมวดหมู่</p>
                  <p className="font-medium text-gray-900">{selectedProduct.category}</p>
                </div>
                <div>
                  <p className="text-gray-500">ราคา</p>
                  <p className="text-base font-bold text-green-700">
                    {priceFormatter.format(selectedProduct.price)}{" "}
                    <span className="text-sm font-normal text-gray-500">/ {selectedProduct.unit}</span>
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">คงเหลือ</p>
                  <p className="font-medium text-gray-900">
                    {selectedProduct.quantity.toLocaleString("th-TH")} {selectedProduct.unit}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Workspace</p>
                  <p className="font-medium text-gray-900">{selectedProduct.workspace_name || "—"}</p>
                </div>
                <div>
                  <p className="text-gray-500">ผู้ขาย</p>
                  <p className="font-medium text-gray-900">{selectedProduct.sellerName}</p>
                </div>
                {selectedProduct.workspace_owner_email && (
                  <div>
                    <p className="text-gray-500">ช่องทางติดต่อ</p>
                    <a
                      href={`mailto:${selectedProduct.workspace_owner_email}`}
                      className="flex items-center gap-1 font-medium text-green-600 hover:underline"
                    >
                      <Mail className="h-3 w-3" />
                      {selectedProduct.workspace_owner_email}
                    </a>
                  </div>
                )}
                {selectedProduct.harvestDate && (
                  <div>
                    <p className="text-gray-500">วันที่เก็บเกี่ยว</p>
                    <p className="font-medium text-gray-900">
                      {dateFormatter.format(selectedProduct.harvestDate)}
                    </p>
                  </div>
                )}
                {selectedProduct.expireDate && (
                  <div>
                    <p className="text-gray-500">วันหมดอายุ</p>
                    <p
                      className={`font-medium ${
                        getExpireStatus(selectedProduct.expireDate) === "expired"
                          ? "text-red-600"
                          : getExpireStatus(selectedProduct.expireDate) === "soon"
                          ? "text-orange-600"
                          : "text-gray-900"
                      }`}
                    >
                      {dateFormatter.format(selectedProduct.expireDate)}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500">อัปเดตล่าสุด</p>
                  <p className="font-medium text-gray-900">
                    {dateFormatter.format(selectedProduct.lastUpdated)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedProduct.quantity <= selectedProduct.minStock && selectedProduct.minStock > 0 && (
                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">สต็อกใกล้หมด</Badge>
                )}
                {getExpireStatus(selectedProduct.expireDate) === "expired" && (
                  <Badge variant="destructive">หมดอายุ</Badge>
                )}
                {getExpireStatus(selectedProduct.expireDate) === "soon" && (
                  <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">ใกล้หมดอายุ</Badge>
                )}
              </div>
              {canManageOffer(selectedProduct.sellerId) ? (
                <div className="flex gap-2 border-t border-neutral-100 pt-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingProductId(selectedProduct.id);
                      setSelectedProduct(null);
                    }}
                  >
                    <Edit className="mr-1 h-3.5 w-3.5" />
                    แก้ไข
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => {
                      setDeletingProductId(selectedProduct.id);
                      setSelectedProduct(null);
                    }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    ลบ
                  </Button>
                </div>
              ) : (
                user && isGlobalAdmin && selectedProduct.sellerId !== user.id && (
                  <Button
                    variant="outline"
                    className="w-full border-green-300 text-green-700 hover:bg-green-50"
                    onClick={() => {
                      setRequestingProduct(selectedProduct);
                      setSelectedProduct(null);
                      setRequestMessage("");
                      setRequestType("delete");
                      setDecreaseBy("");
                    }}
                  >
                    <MessageSquarePlus className="mr-1 h-3.5 w-3.5" />
                    ส่งคำขอถึงเจ้าของ
                  </Button>
                )
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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

      <Dialog
        open={!!requestingProduct}
        onOpenChange={(open) => {
          if (!open) {
            setRequestingProduct(null);
            setRequestMessage("");
            setRequestType("delete");
            setDecreaseBy("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>คำขอผู้ดูแลระบบถึงเจ้าของ Workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              สินค้า: <span className="font-semibold text-gray-900">{requestingProduct?.name}</span>
            </p>
            <p className="text-sm text-gray-600">
              เจ้าของสินค้า: {requestingProduct?.sellerName}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="request-type">ประเภทคำขอ</Label>
              <select
                id="request-type"
                aria-label="ประเภทคำขอ"
                title="ประเภทคำขอ"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as "delete" | "decrease")}
              >
                <option value="delete">ขอลบรายการสินค้า</option>
                <option value="decrease">ขอลดจำนวนสินค้า</option>
              </select>
            </div>
            {requestType === "decrease" && (
              <div className="space-y-1.5">
                <Label htmlFor="decrease-by">จำนวนที่ต้องการลด</Label>
                <Input
                  id="decrease-by"
                  type="number"
                  min={1}
                  value={decreaseBy}
                  onChange={(e) => setDecreaseBy(e.target.value)}
                  placeholder="เช่น 10"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="request-message">เหตุผลและรายละเอียด</Label>
              <Textarea
                id="request-message"
                placeholder="ระบุเหตุผลที่ต้องการให้เจ้าของยืนยันคำขอนี้"
                rows={4}
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRequestingProduct(null); setRequestMessage(""); }}>ยกเลิก</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleSendRequest} disabled={isSendingRequest || !requestMessage.trim()}>
              {isSendingRequest ? "กำลังส่ง..." : "ส่งคำขอ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
