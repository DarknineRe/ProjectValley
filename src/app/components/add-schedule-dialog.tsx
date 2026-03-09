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
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";

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