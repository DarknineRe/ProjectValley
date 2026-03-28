import { useState, useEffect } from "react";
import { useData } from "../context/data-context";
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
import type { Product } from "../context/data-context";
import { toast } from "sonner";
import { ImageUploader } from "./image-uploader";

interface EditProductDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
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

export function EditProductDialog({
  product,
  open,
  onOpenChange,
  onSuccess,
}: EditProductDialogProps) {
  const { updateProduct } = useData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: product.name,
    category: product.category,
    quantity: product.quantity.toString(),
    price: product.price.toString(),
    minStock: (product.minStock ?? 0).toString(),
    unit: product.unit,
    imageUrl: product.imageUrl || "",
    harvestDate: product.harvestDate
      ? new Date(product.harvestDate).toISOString().split("T")[0]
      : "",
    expireDate: product.expireDate
      ? new Date(product.expireDate).toISOString().split("T")[0]
      : "",
  });

  useEffect(() => {
    setFormData({
      name: product.name,
      category: product.category,
      quantity: product.quantity.toString(),
      price: product.price.toString(),
      minStock: (product.minStock ?? 0).toString(),
      unit: product.unit,
      imageUrl: product.imageUrl || "",
      harvestDate: product.harvestDate
        ? new Date(product.harvestDate).toISOString().split("T")[0]
        : "",
      expireDate: product.expireDate
        ? new Date(product.expireDate).toISOString().split("T")[0]
        : "",
    });
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = formData.name.trim();
    const quantity = Number(formData.quantity);
    const price = Number(formData.price);
    const minStock = Number(formData.minStock || 0);

    if (!name) {
      toast.error("กรุณาระบุชื่อสินค้า");
      return;
    }
    if (!formData.category) {
      toast.error("กรุณาเลือกหมวดหมู่");
      return;
    }
    if (!formData.unit) {
      toast.error("กรุณาเลือกหน่วยสินค้า");
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      toast.error("จำนวนสินค้าต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("ราคาต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
      return;
    }
    if (!Number.isFinite(minStock) || minStock < 0) {
      toast.error("ค่าแจ้งเตือนสต็อกต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
      return;
    }
    const imageVal = formData.imageUrl.trim();
    if (imageVal && !imageVal.startsWith("data:")) {
      try {
        const url = new URL(imageVal);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          throw new Error("invalid-protocol");
        }
      } catch {
        toast.error("ลิงก์รูปสินค้าไม่ถูกต้อง");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await updateProduct({
        ...product,
        name,
        category: formData.category,
        quantity,
        unit: formData.unit,
        price,
        minStock,
        imageUrl: formData.imageUrl.trim() || undefined,
        harvestDate: formData.harvestDate ? new Date(formData.harvestDate) : undefined,
        expireDate: formData.expireDate ? new Date(formData.expireDate) : undefined,
      });

      onSuccess?.();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>แก้ไขข้อมูลสินค้า</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">ชื่อสินค้า *</Label>
              <Input
                id="edit-name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="ระบุชื่อสินค้า"
                maxLength={120}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category">หมวดหมู่ *</Label>
              <Select
                required
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger id="edit-category" disabled={isSubmitting}>
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
              <Label htmlFor="edit-quantity">จำนวน *</Label>
              <Input
                id="edit-quantity"
                type="number"
                required
                min="0"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: e.target.value })
                }
                placeholder="0"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-price">ราคาขายต่อหน่วย (บาท) *</Label>
              <Input
                id="edit-price"
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) =>
                  setFormData({ ...formData, price: e.target.value })
                }
                placeholder="เช่น 45.00"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-minStock">แจ้งเตือนเมื่อเหลือต่ำกว่า/เท่ากับ</Label>
              <Input
                id="edit-minStock"
                type="number"
                min="0"
                value={formData.minStock}
                onChange={(e) =>
                  setFormData({ ...formData, minStock: e.target.value })
                }
                placeholder="เช่น 10"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-unit">หน่วย *</Label>
              <Select
                required
                value={formData.unit}
                onValueChange={(value) =>
                  setFormData({ ...formData, unit: value })
                }
              >
                <SelectTrigger id="edit-unit" disabled={isSubmitting}>
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
              <Label htmlFor="edit-harvestDate">วันที่เก็บเกี่ยว</Label>
              <Input
                id="edit-harvestDate"
                type="date"
                value={formData.harvestDate}
                onChange={(e) =>
                  setFormData({ ...formData, harvestDate: e.target.value })
                }
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-expireDate">วันหมดอายุ</Label>
              <Input
                id="edit-expireDate"
                type="date"
                value={formData.expireDate}
                onChange={(e) =>
                  setFormData({ ...formData, expireDate: e.target.value })
                }
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>รูปสินค้า</Label>
              <ImageUploader
                value={formData.imageUrl}
                onChange={(value) => setFormData({ ...formData, imageUrl: value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>เจ้าของสินค้า</Label>
              <Input value={product.sellerName} disabled />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              ยกเลิก
            </Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={isSubmitting}>
              {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}