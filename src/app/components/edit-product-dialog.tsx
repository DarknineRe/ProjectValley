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

interface EditProductDialogProps {
  product: Product;
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

export function EditProductDialog({
  product,
  open,
  onOpenChange,
}: EditProductDialogProps) {
  const { updateProduct } = useData();
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
    });
  }, [product]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    updateProduct({
      ...product,
      name: formData.name,
      category: formData.category,
      quantity: Number(formData.quantity),
      unit: formData.unit,
      price: Number(formData.price),
      minStock: Number(formData.minStock || 0),
      imageUrl: formData.imageUrl.trim() || undefined,
      harvestDate: formData.harvestDate ? new Date(formData.harvestDate) : undefined,
    });

    onOpenChange(false);
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
                <SelectTrigger id="edit-category">
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
                <SelectTrigger id="edit-unit">
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
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-imageUrl">ลิงก์รูปสินค้า</Label>
              <Input
                id="edit-imageUrl"
                type="url"
                value={formData.imageUrl}
                onChange={(e) =>
                  setFormData({ ...formData, imageUrl: e.target.value })
                }
                placeholder="https://example.com/product.jpg"
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
            >
              ยกเลิก
            </Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700">
              บันทึก
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}