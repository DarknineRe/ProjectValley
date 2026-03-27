import { useState } from "react";
import { useData } from "../context/data-context";
import { useWorkspace } from "../context/workspace-context";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
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
import { Badge } from "../components/ui/badge";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Plus, Edit, Trash2, Clock, Package, Calendar, RotateCcw } from "lucide-react";
import type { ActivityLog as ActivityLogType } from "../context/data-context";

// get Thai description for action
function getActionThaiText(action: string): string {
  switch (action) {
    case "add":
      return "เพิ่ม";
    case "update":
      return "แก้ไข";
    case "delete":
      return "ลบ";
    default:
      return "";
  }
}

// get Thai type text
function getTypeThaiText(type: string): string {
  switch (type) {
    case "product":
      return "สินค้า";
    case "schedule":
      return "แผนการปลูก";
    default:
      return "";
  }
}

// combine action + type + item name into one description
function getDescription(action: string, type: string, itemName: string): string {
  const actionTh = getActionThaiText(action);
  const typeTh = getTypeThaiText(type);
  const safeItemName = itemName?.trim() || "รายการ";
  return `${actionTh}${typeTh} ${safeItemName}`;
}

export function ActivityLog() {
  const { activityLogs, rollbackActivity } = useData();
  const { getUserPermissions } = useWorkspace();
  const permissions = getUserPermissions();
  const [pendingRollback, setPendingRollback] = useState<ActivityLogType | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const handleRollbackConfirm = async () => {
    if (!pendingRollback) return;
    setIsRollingBack(true);
    try {
      await rollbackActivity(pendingRollback);
    } finally {
      setIsRollingBack(false);
      setPendingRollback(null);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "add":
        return <Plus className="h-4 w-4" />;
      case "update":
        return <Edit className="h-4 w-4" />;
      case "delete":
        return <Trash2 className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "add":
        return (
          <Badge className="bg-green-500 hover:bg-green-600 flex items-center gap-1">
            <Plus className="h-3 w-3" />
            เพิ่ม
          </Badge>
        );
      case "update":
        return (
          <Badge className="bg-blue-500 hover:bg-blue-600 flex items-center gap-1">
            <Edit className="h-3 w-3" />
            แก้ไข
          </Badge>
        );
      case "delete":
        return (
          <Badge className="bg-red-500 hover:bg-red-600 flex items-center gap-1">
            <Trash2 className="h-3 w-3" />
            ลบ
          </Badge>
        );
      default:
        return <Badge>อื่นๆ</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "product":
        return <Package className="h-4 w-4 text-green-600" />;
      case "schedule":
        return <Calendar className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "product":
        return <Badge variant="outline" className="border-green-500 text-green-700">สินค้า</Badge>;
      case "schedule":
        return <Badge variant="outline" className="border-blue-500 text-blue-700">แผนการปลูก</Badge>;
      default:
        return <Badge variant="outline">อื่นๆ</Badge>;
    }
  };

  // Sort logs by timestamp (newest first)
  const sortedLogs = [...activityLogs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">ประวัติการเปลี่ยนแปลง</h2>
        <p className="text-gray-600 mt-1">
          บันทึกการเพิ่ม แก้ไข และลบข้อมูล
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Clock className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">รายการทั้งหมด</p>
              <p className="text-2xl font-bold text-gray-900">
                {activityLogs.length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Plus className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">เพิ่มข้อมูล</p>
              <p className="text-2xl font-bold text-gray-900">
                {activityLogs.filter((log) => log.action === "add").length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Edit className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">แก้ไขข้อมูล</p>
              <p className="text-2xl font-bold text-gray-900">
                {activityLogs.filter((log) => log.action === "update").length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">ลบข้อมูล</p>
              <p className="text-2xl font-bold text-gray-900">
                {activityLogs.filter((log) => log.action === "delete").length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Activity Table */}
      <Card className="p-6">
        {sortedLogs.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 text-lg">ยังไม่มีประวัติการเปลี่ยนแปลง</p>
            <p className="text-gray-400 text-sm mt-1">
              เมื่อมีการเพิ่ม แก้ไข หรือลบข้อมูล ระบบจะบันทึกไว้ที่นี่
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่/เวลา</TableHead>
                  <TableHead>การกระทำ</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>คำอธิบาย</TableHead>
                  <TableHead>ผู้ใช้</TableHead>
                  <TableHead className="text-center">ย้อนกลับ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLogs.map((log) => {
                  const date = new Date(log.timestamp);
                  const isValidDate = !isNaN(date.getTime());
                  const dateStr = isValidDate ? format(date, "d MMM yyyy, HH:mm", { locale: th }) : "-";
                  const description = getDescription(log.action, log.type, log.itemName);

                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm font-medium">{dateStr}</TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(log.type)}
                          {getTypeBadge(log.type)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">{description}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{log.user}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          let enabled = false;
                          try {
                            const d = JSON.parse(log.details);
                            enabled = !!(d?.itemId || d?.item_id) && permissions.canEdit;
                          } catch {}
                          return (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className={enabled ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50" : "text-gray-300 cursor-not-allowed"}
                              onClick={() => enabled && setPendingRollback(log)}
                              disabled={!enabled}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              ย้อนกลับ
                            </Button>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <AlertDialog open={!!pendingRollback} onOpenChange={(open) => { if (!open) setPendingRollback(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ย้อนกลับการกระทำนี้?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRollback && (
                <>
                  ต้องการย้อนกลับ{" "}
                  <span className="font-semibold">
                    {pendingRollback.action === "add" ? "การเพิ่ม" : pendingRollback.action === "update" ? "การแก้ไข" : "การลบ"}
                    {" "}{pendingRollback.itemName}
                  </span>{" "}
                  ใช่หรือไม่? การกระทำนี้ไม่สามารถยกเลิกได้
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRollingBack}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollbackConfirm}
              disabled={isRollingBack}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isRollingBack ? "กำลังย้อนกลับ..." : "ย้อนกลับ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
