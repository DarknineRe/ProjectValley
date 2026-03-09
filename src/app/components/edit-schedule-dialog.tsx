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
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import type { PlantingSchedule } from "../context/data-context";

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
              <Label>วันที่ปลูก *</Label>
              <Popover modal={true}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.plantingDate, "PPP", { locale: th })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[120]" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.plantingDate}
                    onSelect={(date) =>
                      date && setFormData({ ...formData, plantingDate: date })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>วันที่เก็บเกี่ยว *</Label>
              <Popover modal={true}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.harvestDate, "PPP", { locale: th })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[120]" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.harvestDate}
                    onSelect={(date) =>
                      date && setFormData({ ...formData, harvestDate: date })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
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