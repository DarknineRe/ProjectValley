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
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import type { PlantingSchedule } from "../context/data-context";

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

interface EditScheduleDialogProps {
  schedule: PlantingSchedule;
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

export function EditScheduleDialog({
  schedule,
  open,
  onOpenChange,
}: EditScheduleDialogProps) {
  const { updateSchedule } = useData();
  const [formData, setFormData] = useState({
    cropName: schedule.cropName,
    category: schedule.category,
    plantingDate: new Date(schedule.plantingDate),
    harvestDate: new Date(schedule.harvestDate),
    area: schedule.area.toString(),
    estimatedYield: schedule.estimatedYield?.toString() || "",
    status: schedule.status,
    notes: schedule.notes,
  });

  useEffect(() => {
    setFormData({
      cropName: schedule.cropName,
      category: schedule.category,
      plantingDate: new Date(schedule.plantingDate),
      harvestDate: new Date(schedule.harvestDate),
      area: schedule.area.toString(),
      estimatedYield: schedule.estimatedYield?.toString() || "",
      status: schedule.status,
      notes: schedule.notes,
    });
  }, [schedule]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    updateSchedule({
      ...schedule,
      cropName: formData.cropName,
      category: formData.category,
      plantingDate: formData.plantingDate,
      harvestDate: formData.harvestDate,
      area: Number(formData.area),
      estimatedYield: formData.estimatedYield ? Number(formData.estimatedYield) : undefined,
      status: formData.status,
      notes: formData.notes,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>แก้ไขแผนการปลูก</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-cropName">ชื่อพืช *</Label>
              <Input
                id="edit-cropName"
                required
                value={formData.cropName}
                onChange={(e) =>
                  setFormData({ ...formData, cropName: e.target.value })
                }
                placeholder="ระบุชื่อพืชที่จะปลูก"
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
              <Label htmlFor="edit-plantingDate">วันที่ปลูก *</Label>
              <Input
                id="edit-plantingDate"
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
              <Label htmlFor="edit-harvestDate">วันที่เก็บเกี่ยว *</Label>
              <Input
                id="edit-harvestDate"
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
              <Label htmlFor="edit-area">พื้นที่ (ไร่) *</Label>
              <Input
                id="edit-area"
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
              <Label htmlFor="edit-status">สถานะ *</Label>
              <Select
                required
                value={formData.status}
                onValueChange={(value: "planned" | "planted" | "harvested") =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger id="edit-status">
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

            <div className="space-y-2">
              <Label htmlFor="edit-estimatedYield">ผลผลิตโดยประมาณ (กก.)</Label>
              <Input
                id="edit-estimatedYield"
                type="number"
                min="0"
                step="0.1"
                value={formData.estimatedYield}
                onChange={(e) =>
                  setFormData({ ...formData, estimatedYield: e.target.value })
                }
                placeholder="0.0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">หมายเหตุ</Label>
            <Textarea
              id="edit-notes"
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
              บันทึก
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}