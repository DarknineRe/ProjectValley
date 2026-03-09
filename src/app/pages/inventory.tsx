import { useState } from "react";
import { useData } from "../context/data-context";
import { useWorkspace } from "../context/workspace-context";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Search, Edit, Trash2, AlertCircle, Plus, FolderOpen, Minus } from "lucide-react";
import type { Product } from "../context/data-context";
import { EditProductDialog } from "../components/edit-product-dialog";
import { AddProductDialog } from "../components/add-product-dialog";
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

export function Inventory() {
  const { products, updateProduct, deleteProduct, activityLogs, rollbackActivity } = useData();
  const { getUserPermissions } = useWorkspace();
  const permissions = getUserPermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const [workspaceMode, setWorkspaceMode] = useState<"category" | "product">("category");
  const [workspaceFilter, setWorkspaceFilter] = useState<string>("ทั้งหมด");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [bubbleActionProductId, setBubbleActionProductId] = useState<string | null>(null);
  const [bubbleEditor, setBubbleEditor] = useState<{
    productId: string;
    action: "add" | "reduce";
  } | null>(null);
  const [bubbleAmountInput, setBubbleAmountInput] = useState("");

  // Get unique categories
  const categories = ["ทั้งหมด", ...new Set(products.map((p) => p.category))];
  const productNames = ["ทั้งหมด", ...new Set(products.map((p) => p.name))];

  const workspaceOptions = workspaceMode === "category" ? categories : productNames;

  const buildWorkspaceItems = (options: string[], mode: "category" | "product") =>
    options.map((option) => {
      const scopedProducts =
        option === "ทั้งหมด"
          ? products
          : mode === "category"
          ? products.filter((product) => product.category === option)
          : products.filter((product) => product.name === option);

      return {
        name: option,
        count: scopedProducts.length,
        totalQuantity: scopedProducts.reduce(
          (sum, product) => sum + product.quantity,
          0
        ),
      };
    });

  const categoryWorkspaceItems = buildWorkspaceItems(categories, "category");
  const productWorkspaceItems = buildWorkspaceItems(productNames, "product");

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesWorkspace =
      workspaceFilter === "ทั้งหมด"
        ? true
        : workspaceMode === "category"
        ? product.category === workspaceFilter
        : product.name === workspaceFilter;
    return matchesSearch && matchesWorkspace;
  });

  const getStockStatus = (product: Product) => {
    if (product.quantity === 0) {
      return { label: "สินค้าหมด", variant: "destructive" as const };
    }
    return { label: "มีสินค้า", variant: "default" as const };
  };

  const selectedCategoryProducts =
    workspaceMode === "category" && workspaceFilter !== "ทั้งหมด"
      ? products.filter((product) => product.category === workspaceFilter)
      : [];
  const selectedCategoryNames = new Set(selectedCategoryProducts.map((p) => p.name));

  const productHistoryLogs = activityLogs
    .filter((log) => {
      if (log.type !== "product") return false;
      if (workspaceFilter === "ทั้งหมด") return true;
      if (workspaceMode === "product") {
        return log.itemName === workspaceFilter;
      }
      return selectedCategoryNames.has(log.itemName);
    })
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, 8);

  const getActionLabel = (action: string) => {
    if (action === "add") return "เพิ่ม";
    if (action === "update") return "แก้ไข";
    if (action === "delete") return "ลบ";
    return action;
  };

  const getQuantityChangeText = (log: (typeof productHistoryLogs)[number]) => {
    try {
      const details = JSON.parse(log.details || "{}");
      const prevQty = Number(details?.previous?.quantity);
      const newQty = Number(details?.new?.quantity);
      const unit = details?.new?.unit || details?.previous?.unit || "หน่วย";

      if (Number.isFinite(prevQty) && Number.isFinite(newQty)) {
        const diff = newQty - prevQty;
        if (diff > 0) return `(+${diff.toLocaleString()} ${unit})`;
        if (diff < 0) return `(-${Math.abs(diff).toLocaleString()} ${unit})`;
        return `(0 ${unit})`;
      }

      if (log.action === "add" && Number.isFinite(newQty)) {
        return `(+${newQty.toLocaleString()} ${unit})`;
      }

      if (log.action === "delete" && Number.isFinite(prevQty)) {
        return `(-${prevQty.toLocaleString()} ${unit})`;
      }
    } catch {
      // ignore parse errors and show fallback text
    }

    return "";
  };

  const canRollbackLog = (details: string) => {
    try {
      const parsed = JSON.parse(details);
      return !!(parsed?.itemId || parsed?.item_id);
    } catch {
      return false;
    }
  };

  const adjustQuantityFromBubble = async (
    product: Product,
    amount: number,
    action: "add" | "reduce"
  ) => {
    if (!permissions.canEdit) return;
    if (amount <= 0) return;

    const delta = action === "add" ? amount : -amount;
    const nextQuantity = Math.max(0, product.quantity + delta);
    if (nextQuantity === product.quantity) return;

    setBubbleActionProductId(product.id);
    try {
      await updateProduct({
        ...product,
        quantity: nextQuantity,
      });
      setBubbleEditor(null);
      setBubbleAmountInput("");
    } finally {
      setBubbleActionProductId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">จัดการสต็อกผลผลิต</h2>
          <p className="text-gray-600 mt-1">ตรวจสอบและจัดการข้อมูลผลผลิตทางการเกษตร</p>
        </div>
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-green-600 hover:bg-green-700"
          disabled={!permissions.canAdd}
        >
          <Plus className="h-4 w-4 mr-2" />
          เพิ่มสินค้าใหม่
        </Button>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <FolderOpen className="h-5 w-5 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">พื้นที่ทำงานสินค้า</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          เลือกตามหมวดหมู่หรือชื่อสินค้า แล้วกดบับเบิลเพื่อเปิดดูรายการ
        </p>
        <p className="text-xs text-gray-500 mb-3">
          กดปุ่ม + หรือ - แล้วใส่ค่าในช่อง value จากนั้นกดยืนยัน ข้อมูลจะถูกบันทึกในประวัติและย้อนกลับได้
        </p>

        <div className="mb-4">
          <Select
            value={workspaceMode}
            onValueChange={(value: "category" | "product") => {
              setWorkspaceMode(value);
              setWorkspaceFilter("ทั้งหมด");
            }}
          >
            <SelectTrigger className="w-full md:w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="category">ตามหมวดหมู่</SelectItem>
              <SelectItem value="product">ตามชื่อสินค้า</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">ตามหมวดหมู่</p>
            <div className="flex flex-wrap gap-3">
              {categoryWorkspaceItems.map((workspace) => {
                const isActive =
                  workspaceMode === "category" && workspaceFilter === workspace.name;

                return (
                  <button
                    key={`category-${workspace.name}`}
                    type="button"
                    onClick={() => {
                      setWorkspaceMode("category");
                      setWorkspaceFilter(workspace.name);
                    }}
                    className={`rounded-full border px-4 py-3 text-left transition-all min-w-[180px] ${
                      isActive
                        ? "border-green-600 bg-green-600 text-white shadow"
                        : "border-green-200 bg-green-50 text-gray-800 hover:border-green-400 hover:bg-green-100"
                    }`}
                  >
                    <p className="font-semibold leading-tight">{workspace.name}</p>
                    <p className="text-xs mt-1">
                      {workspace.count.toLocaleString()} รายการ • {workspace.totalQuantity.toLocaleString()} หน่วย
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">ตามชื่อสินค้า</p>
            <div className="flex flex-wrap gap-3">
              {productWorkspaceItems.map((workspace) => {
                const isActive =
                  workspaceMode === "product" && workspaceFilter === workspace.name;
                const matchedProducts = products.filter((p) => p.name === workspace.name);
                const product = matchedProducts.length === 1 ? matchedProducts[0] : null;
                const isAll = workspace.name === "ทั้งหมด";
                const unitLabel = product ? product.unit : "หน่วย";

                return (
                  <button
                    key={`product-${workspace.name}`}
                    type="button"
                    onClick={() => {
                      setWorkspaceMode("product");
                      setWorkspaceFilter(workspace.name);
                    }}
                    className={`rounded-full border px-4 py-3 text-left transition-all min-w-[180px] ${
                      isActive
                        ? "border-green-600 bg-green-600 text-white shadow"
                        : "border-green-200 bg-green-50 text-gray-800 hover:border-green-400 hover:bg-green-100"
                    }`}
                  >
                    <p className="font-semibold leading-tight">{workspace.name}</p>
                    <p className="text-xs mt-1">
                      {workspace.count.toLocaleString()} รายการ • {workspace.totalQuantity.toLocaleString()} {unitLabel}
                    </p>
                    {!isAll && permissions.canEdit && product && (
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={bubbleActionProductId === product.id || product.quantity <= 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setBubbleEditor({ productId: product.id, action: "reduce" });
                            setBubbleAmountInput("");
                          }}
                          className="h-7 px-2"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={bubbleActionProductId === product.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setBubbleEditor({ productId: product.id, action: "add" });
                            setBubbleAmountInput("");
                          }}
                          className="h-7 px-2"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={bubbleActionProductId === product.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingProductId(product.id);
                          }}
                          className="h-7 px-2"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    {!isAll && permissions.canEdit && product && bubbleEditor?.productId === product.id && (
                      <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Input
                          type="number"
                          min="1"
                          inputMode="numeric"
                          value={bubbleAmountInput}
                          onChange={(e) => setBubbleAmountInput(e.target.value)}
                          placeholder="value"
                          className="h-7 w-24 px-2 text-xs"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="h-7 px-2 text-xs"
                          disabled={bubbleActionProductId === product.id}
                          onClick={() => {
                            const amount = Number(bubbleAmountInput || 0);
                            adjustQuantityFromBubble(product, amount, bubbleEditor.action);
                          }}
                        >
                          ยืนยัน
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setBubbleEditor(null);
                            setBubbleAmountInput("");
                          }}
                        >
                          ยกเลิก
                        </Button>
                      </div>
                    )}
                    {!isAll && permissions.canEdit && !product && workspace.count > 1 && (
                      <p className="text-[11px] mt-2 opacity-80">มีหลายรายการชื่อเดียวกัน</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">ประวัติสินค้า (ย้อนกลับ)</h3>
          <p className="text-xs text-gray-500">อัปเดต/ลบ/เพิ่มล่าสุด</p>
        </div>

        {productHistoryLogs.length === 0 ? (
          <p className="text-sm text-gray-500">ยังไม่มีประวัติสินค้า</p>
        ) : (
          <div className="space-y-2">
            {productHistoryLogs.map((log) => {
              const enabled = permissions.canEdit && canRollbackLog(log.details);
              return (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {getActionLabel(log.action)}สินค้า {log.itemName} {getQuantityChangeText(log)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(log.timestamp).toLocaleString("th-TH")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!enabled}
                    onClick={() => enabled && rollbackActivity(log)}
                  >
                    ย้อนกลับ
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-6">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="ค้นหาสินค้า..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={workspaceFilter} onValueChange={setWorkspaceFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="เลือกรายการ" />
            </SelectTrigger>
            <SelectContent>
              {workspaceOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อสินค้า</TableHead>
                <TableHead>หมวดหมู่</TableHead>
                <TableHead className="text-right">จำนวน</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>วันที่เก็บเกี่ยว</TableHead>
                <TableHead className="text-center">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-8 w-8 text-gray-400" />
                      <p className="text-gray-500">ไม่พบสินค้า</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => {
                  const status = getStockStatus(product);

                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell className="text-right">
                        {product.quantity.toLocaleString()} {product.unit}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {product.harvestDate
                          ? new Date(product.harvestDate).toLocaleDateString("th-TH", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          {permissions.canEdit && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingProduct(product)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeletingProductId(product.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </>
                          )}
                          {!permissions.canEdit && (
                            <Badge variant="secondary" className="text-xs">
                              อ่านอย่างเดียว
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Edit Dialog */}
      {editingProduct && (
        <EditProductDialog
          product={editingProduct}
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
        />
      )}

      {/* Add Dialog */}
      <AddProductDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingProductId}
        onOpenChange={(open) => !open && setDeletingProductId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบสินค้า</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ที่จะลบสินค้านี้? การกระทำนี้ไม่สามารถยกเลิกได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingProductId) {
                  deleteProduct(deletingProductId);
                  setDeletingProductId(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              ลบสินค้า
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}