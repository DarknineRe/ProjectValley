import { useState } from "react";
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
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

function formatDateForInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseInputDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

interface AddScheduleDialogProps {
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

const statusOptions = [
  { value: "planned", label: "วางแผนแล้ว" },
  { value: "planted", label: "กำลังปลูก" },
  { value: "harvested", label: "เก็บเกี่ยวแล้ว" },
];

export function AddScheduleDialog({
  open,
  onOpenChange,
}: AddScheduleDialogProps) {
  const { addSchedule } = useData();
  const [formData, setFormData] = useState({
    cropName: "",
    category: "",
    plantingDate: new Date(),
    harvestDate: new Date(),
    area: "",
    estimatedYield: "",
    status: "planned" as "planned" | "planted" | "harvested",
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    addSchedule({
      cropName: formData.cropName,
      category: formData.category,
      plantingDate: formData.plantingDate,
      harvestDate: formData.harvestDate,
      area: Number(formData.area),
      estimatedYield: Number(formData.estimatedYield),
      status: formData.status,
      notes: formData.notes,
    });

    // Reset form
    setFormData({
      cropName: "",
      category: "",
      plantingDate: new Date(),
      harvestDate: new Date(),
      area: "",
      estimatedYield: "",
      status: "planned",
      notes: "",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>เพิ่มแผนการปลูกใหม่</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cropName">ชื่อพืช *</Label>
              <Input
                id="cropName"
                required
                value={formData.cropName}
                onChange={(e) =>
                  setFormData({ ...formData, cropName: e.target.value })
                }
                placeholder="ระบุชื่อพืชที่จะปลูก"
              />
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
              <Label htmlFor="plantingDate">วันที่ปลูก *</Label>
              <Input
                id="plantingDate"
                type="date"
                required
                value={formatDateForInput(formData.plantingDate)}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    plantingDate: parseInputDate(e.target.value),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="harvestDate">วันที่เก็บเกี่ยว *</Label>
              <Input
                id="harvestDate"
                type="date"
                required
                value={formatDateForInput(formData.harvestDate)}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    harvestDate: parseInputDate(e.target.value),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="area">พื้นที่ (ไร่) *</Label>
              <Input
                id="area"
                type="number"
                required
                min="0"
                step="0.1"
                value={formData.area}
                onChange={(e) =>
                  setFormData({ ...formData, area: e.target.value })
                }
                placeholder="0.0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedYield">ผลผลิตประมาณ (กิโลกรัม) *</Label>
              <Input
                id="estimatedYield"
                type="number"
                required
                min="0"
                step="0.1"
                value={formData.estimatedYield}
                onChange={(e) =>
                  setFormData({ ...formData, estimatedYield: e.target.value })
                }
                placeholder="0.0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">สถานะ *</Label>
              <Select
                required
                value={formData.status}
                onValueChange={(value: "planned" | "planted" | "harvested") =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="เลือกสถานะ" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">หมายเหตุ</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="เพิ่มข้อมูลเพิ่มเติม เช่น สภาพดิน ปุ๋ยที่ใช้ ฯลฯ"
              rows={3}
            />
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
              เพิ่มแผนการปลูก
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}