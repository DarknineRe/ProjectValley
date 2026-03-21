import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useData } from "../context/data-context";
import { useWorkspace } from "../context/workspace-context";
import { API_BASE } from "../../api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { toast } from "sonner";

interface AddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categories = [
  "ข้าว",
  "ผักสด",
  "ผลไม้",
  "พืชผล",
  "ถั่ว-งา",
  "เครื่องเทศ",
  "สมุนไพร",
  "อื่นๆ",
];

const units = ["กิโลกรัม", "ลูก", "หวี", "กำ", "ลัง", "ตัน", "ถัง"];

export function AddProductDialog({
  open,
  onOpenChange,
}: AddProductDialogProps) {
  const { addProduct, products } = useData();
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [marketTemplates, setMarketTemplates] = useState<
    Array<{ name: string; category: string; unit: string; source: "market" | "inventory" }>
  >([]);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    quantity: "",
    price: "",
    minStock: "",
    unit: "",
    harvestDate: "",
    imageUrl: "",
  });

  useEffect(() => {
    if (!open) return;

    const loadMarketTemplates = async () => {
      try {
        const workspaceId = currentWorkspace?.id || "default";
        const res = await fetch(
          `${API_BASE}/api/market-prices/latest?workspace_id=${encodeURIComponent(workspaceId)}&limit=200`
        );
        if (!res.ok) {
          setMarketTemplates([]);
          return;
        }

        const rows = await res.json();
        const mapped = (rows || [])
          .map((row: any) => ({
            name: String(row.product_name || row.productName || "").trim(),
            category: "ผักสด",
            unit: "กิโลกรัม",
            source: "market" as const,
          }))
          .filter((item: { name: string }) => item.name.length > 0);

        setMarketTemplates(mapped);
      } catch {
        setMarketTemplates([]);
      }
    };

    loadMarketTemplates();
  }, [open, currentWorkspace?.id]);

  const normalizedName = formData.name.trim().toLowerCase();
  const inventoryTemplates = products.reduce(
    (acc, product) => {
      const key = `${product.name.trim().toLowerCase()}|${product.category}|${product.unit}`;
      if (!acc.seen.has(key)) {
        acc.seen.add(key);
        acc.items.push({
          name: product.name,
          category: product.category,
          unit: product.unit,
          source: "inventory" as const,
        });
      }
      return acc;
    },
    {
      seen: new Set<string>(),
      items: [] as Array<{
        name: string;
        category: string;
        unit: string;
        source: "market" | "inventory";
      }>,
    }
  ).items;

  const productTemplates = useMemo(() => {
    const merged = [...inventoryTemplates, ...marketTemplates];
    const seen = new Set<string>();

    return merged.filter((item) => {
      const key = `${item.name.trim().toLowerCase()}|${item.category}|${item.unit}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [inventoryTemplates, marketTemplates]);

  const nameSuggestions =
    normalizedName.length === 0
      ? []
      : productTemplates
          .filter((item) => item.name.toLowerCase().includes(normalizedName))
          .slice(0, 6);

  const hasExactMatch = productTemplates.some(
    (item) => item.name.trim().toLowerCase() === normalizedName
  );

  const applyTemplate = (template: {
    name: string;
    category: string;
    unit: string;
    source: "market" | "inventory";
  }) => {
    setFormData((prev) => ({
      ...prev,
      name: template.name,
      category: template.category,
      unit: template.unit,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all required fields
    if (!formData.name.trim()) {
      toast.error("กรุณากรอกชื่อสินค้า");
      return;
    }

    if (!formData.category) {
      toast.error("กรุณาเลือกหมวดหมู่");
      return;
    }

    if (!formData.quantity || Number(formData.quantity) <= 0) {
      toast.error("กรุณากรอกจำนวนที่มากกว่า 0");
      return;
    }

    if (!formData.price || Number(formData.price) < 0) {
      toast.error("กรุณากรอกราคาที่ถูกต้อง");
      return;
    }

    if (Number(formData.minStock || 0) < 0) {
      toast.error("จำนวนขั้นต่ำต้องไม่ติดลบ");
      return;
    }

    if (!formData.unit) {
      toast.error("กรุณาเลือกหน่วย");
      return;
    }

    try {
      await addProduct({
        name: formData.name,
        category: formData.category,
        quantity: Number(formData.quantity),
        unit: formData.unit,
        price: Number(formData.price),
        minStock: Number(formData.minStock || 0),
        harvestDate: formData.harvestDate || undefined,
        imageUrl: formData.imageUrl.trim() || undefined,
      });

      // Reset form
      setFormData({
        name: "",
        category: "",
        quantity: "",
        price: "",
        minStock: "",
        unit: "",
        harvestDate: "",
        imageUrl: "",
      });
      onOpenChange(false);
      navigate("/workspace/marketplace");
    } catch (error) {
      console.error("Error adding product:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>เพิ่มสินค้าใหม่</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 relative">
              <Label htmlFor="name">ชื่อสินค้า *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="ระบุชื่อสินค้า"
              />
              {nameSuggestions.length > 0 && !hasExactMatch && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-lg border border-emerald-200 bg-white shadow-lg p-2 space-y-1 max-h-52 overflow-y-auto">
                  {nameSuggestions.map((item) => (
                    <button
                      key={`${item.name}-${item.category}-${item.unit}-${item.source}`}
                      type="button"
                      className="w-full text-left text-sm rounded-md px-2 py-2 hover:bg-emerald-50"
                      onClick={() => applyTemplate(item)}
                    >
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-600">
                        {item.category} • {item.unit} • {item.source === "market" ? "ราคาอ้างอิงกระทรวงพาณิชย์" : "ข้อมูลในสต็อก"}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">หมวดหมู่ *</Label>
              <Select
                required
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="เลือกหมวดหมู่" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">จำนวน *</Label>
              <Input
                id="quantity"
                type="number"
                required
                min="0"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: e.target.value })
                }
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">ราคาขายต่อหน่วย (บาท) *</Label>
              <Input
                id="price"
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) =>
                  setFormData({ ...formData, price: e.target.value })
                }
                placeholder="เช่น 45.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minStock">แจ้งเตือนเมื่อเหลือต่ำกว่า/เท่ากับ</Label>
              <Input
                id="minStock"
                type="number"
                min="0"
                value={formData.minStock}
                onChange={(e) =>
                  setFormData({ ...formData, minStock: e.target.value })
                }
                placeholder="เช่น 10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">หน่วย *</Label>
              <Select
                required
                value={formData.unit}
                onValueChange={(value) =>
                  setFormData({ ...formData, unit: value })
                }
              >
                <SelectTrigger id="unit">
                  <SelectValue placeholder="เลือกหน่วย" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="harvestDate">วันที่เก็บเกี่ยว</Label>
              <Input
                id="harvestDate"
                type="date"
                value={formData.harvestDate}
                onChange={(e) =>
                  setFormData({ ...formData, harvestDate: e.target.value })
                }
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="imageUrl">ลิงก์รูปสินค้า</Label>
              <Input
                id="imageUrl"
                type="url"
                value={formData.imageUrl}
                onChange={(e) =>
                  setFormData({ ...formData, imageUrl: e.target.value })
                }
                placeholder="https://example.com/product.jpg"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              ยกเลิก
            </Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700">
              เพิ่มสินค้า
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}