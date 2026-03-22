import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useWorkspace } from "../context/workspace-context";
import type { WorkspaceMember, WorkspacePermissions } from "../context/workspace-context";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Users, UserPlus, Copy, CheckCircle, Code, Crown, User, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";

export function Members() {
  const navigate = useNavigate();
  const {
    currentWorkspace,
    inviteToWorkspace,
    getUserRole,
    getUserPermissions,
    updateMemberPermissions,
    deleteWorkspace,
  } = useWorkspace();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [selectedMemberForViewsId, setSelectedMemberForViewsId] = useState<string | null>(null);
  const [viewPermissionDraft, setViewPermissionDraft] = useState<
    Partial<WorkspacePermissions> | null
  >(null);
  const userRole = getUserRole();
  const userPermissions = getUserPermissions();
  const isOwner = userRole === "owner";
  const canManagePermissions = isOwner || userPermissions.canManagePermissions;
  const ownerMember = currentWorkspace
    ? currentWorkspace.members.find((m) => m.id === currentWorkspace.ownerId) ||
      currentWorkspace.members.find((m) => m.role === "owner") ||
      null
    : null;
  const visibleMembers = currentWorkspace
    ? currentWorkspace.members.filter((m) => m.id !== ownerMember?.id && m.role !== "owner")
    : [];
  const merchants = visibleMembers.filter((member) => member.canAdd);
  const guests = visibleMembers.filter((member) => !member.canAdd);

  const getMemberLabel = (member: WorkspaceMember) => {
    return member.canAdd ? "ผู้ค้า" : "ผู้เยี่ยมชม";
  };

  const handleCopyCode = () => {
    if (currentWorkspace) {
      navigator.clipboard.writeText(currentWorkspace.code);
      setCopied(true);
      toast.success("คัดลอกรหัสสำเร็จ!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleInvite = () => {
    if (!inviteEmail.trim()) {
      toast.error("กรุณาใส่อีเมล");
      return;
    }
    if (currentWorkspace) {
      inviteToWorkspace(currentWorkspace.id, inviteEmail);
      toast.success(`ส่งคำเชิญไปยัง ${inviteEmail} แล้ว`);
      setIsInviteDialogOpen(false);
      setInviteEmail("");
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!currentWorkspace) return;
    setIsDeleting(true);
    try {
      const success = await deleteWorkspace(currentWorkspace.id);
      if (!success) {
        toast.error("ไม่สามารถลบ Workspace ได้");
        return;
      }
      toast.success("ลบ Workspace สำเร็จ");
      setIsDeleteConfirmOpen(false);
      navigate("/hub");
    } catch (error) {
      toast.error("ไม่สามารถลบ Workspace ได้");
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePermissionChange = async (
    memberId: string,
    next: WorkspacePermissions
  ) => {
    if (!currentWorkspace) return;

    setUpdatingMemberId(memberId);
    try {
      const success = await updateMemberPermissions(
        currentWorkspace.id,
        memberId,
        next
      );
      if (!success) {
        toast.error("ไม่สามารถอัปเดตสิทธิ์ได้");
        return;
      }
      toast.success("อัปเดตสิทธิ์สำเร็จ");
    } catch (error) {
      toast.error("ไม่สามารถอัปเดตสิทธิ์ได้");
    } finally {
      setUpdatingMemberId(null);
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="text-center py-12">
        <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">กรุณาเลือก Workspace ก่อน</p>
      </div>
    );
  }

  const owner = ownerMember;
  const selectedMemberForViews = selectedMemberForViewsId
    ? currentWorkspace.members.find((m) => m.id === selectedMemberForViewsId) || null
    : null;
  const viewPermissionItems: Array<{
    key:
      | "viewDashboard"
      | "viewInventory"
      | "viewSummary"
      | "viewCalendar"
      | "viewAnalysis"
      | "viewPriceComparison"
      | "viewRecommendations"
      | "viewMembers"
      | "viewActivity";
    label: string;
  }> = [
    { key: "viewDashboard", label: "ภาพรวม" },
    { key: "viewInventory", label: "จัดการสต็อก" },
    { key: "viewSummary", label: "สรุปสต็อก" },
    { key: "viewCalendar", label: "ปฏิทินการปลูก" },
    { key: "viewAnalysis", label: "วิเคราะห์ราคา" },
    { key: "viewPriceComparison", label: "เปรียบเทียบราคา" },
    { key: "viewRecommendations", label: "คำแนะนำ" },
    { key: "viewMembers", label: "สมาชิก" },
    { key: "viewActivity", label: "ประวัติการเปลี่ยนแปลง" },
  ];

  useEffect(() => {
    if (!selectedMemberForViews) {
      setViewPermissionDraft(null);
      return;
    }

    setViewPermissionDraft({
      viewDashboard: selectedMemberForViews.viewDashboard,
      viewInventory: selectedMemberForViews.viewInventory,
      viewSummary: selectedMemberForViews.viewSummary,
      viewCalendar: selectedMemberForViews.viewCalendar,
      viewAnalysis: selectedMemberForViews.viewAnalysis,
      viewPriceComparison: selectedMemberForViews.viewPriceComparison,
      viewRecommendations: selectedMemberForViews.viewRecommendations,
      viewMembers: selectedMemberForViews.viewMembers,
      viewActivity: selectedMemberForViews.viewActivity,
    });
  }, [selectedMemberForViews]);

  const applyViewPermissionDraft = async () => {
    if (!selectedMemberForViews || !viewPermissionDraft) return;
    const latestMember = currentWorkspace.members.find(
      (m) => m.id === selectedMemberForViews.id
    );
    if (!latestMember) return;

    const next = buildNextPermissions(latestMember, viewPermissionDraft);
    await handlePermissionChange(latestMember.id, next);
    setSelectedMemberForViewsId(null);
  };

  const buildNextPermissions = (
    member: WorkspaceMember,
    patch: Partial<WorkspacePermissions>
  ): WorkspacePermissions => {
    return {
      canView: member.canView,
      canAdd: member.canAdd,
      canEdit: member.canEdit,
      canManagePermissions: member.canManagePermissions,
      viewDashboard: member.viewDashboard,
      viewInventory: member.viewInventory,
      viewSummary: member.viewSummary,
      viewCalendar: member.viewCalendar,
      viewAnalysis: member.viewAnalysis,
      viewPriceComparison: member.viewPriceComparison,
      viewRecommendations: member.viewRecommendations,
      viewMembers: member.viewMembers,
      viewActivity: member.viewActivity,
      ...patch,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">สมาชิกในทีม</h2>
          <p className="text-gray-600 mt-1">
            จัดการสมาชิกและคำเชิญใน Workspace: {currentWorkspace.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsInviteDialogOpen(true)}
            className="bg-green-600 hover:bg-green-700"
            disabled={!canManagePermissions}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            เชิญสมาชิก
          </Button>
          {isOwner && (
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700"
              onClick={() => setIsDeleteConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              ลบ Workspace
            </Button>
          )}
        </div>
      </div>

      {/* Workspace Info Card */}
      <Card className="p-6 bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              รหัส Workspace
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              แชร์รหัสนี้กับคนที่คุณต้องการเชิญเข้าร่วม
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-lg border-2 border-green-300">
                <Code className="h-5 w-5 text-green-600" />
                <span className="font-mono text-2xl font-bold text-gray-900">
                  {currentWorkspace.code}
                </span>
              </div>
              <Button
                variant="outline"
                onClick={handleCopyCode}
                className="flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    คัดลอกแล้ว
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    คัดลอก
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-full">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">สมาชิกทั้งหมด</p>
              <p className="text-2xl font-bold text-gray-900">
                {visibleMembers.length + (owner ? 1 : 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-full">
              <Crown className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">เจ้าของ</p>
              <p className="text-2xl font-bold text-gray-900">1</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-full">
              <User className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">ผู้ค้า</p>
              <p className="text-2xl font-bold text-gray-900">
                {merchants.length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-full">
              <User className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">ผู้เยี่ยมชม</p>
              <p className="text-2xl font-bold text-gray-900">
                {guests.length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Members Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          รายชื่อสมาชิก
        </h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ</TableHead>
                <TableHead>อีเมล</TableHead>
                <TableHead>บทบาท</TableHead>
                <TableHead className="text-center">ดูข้อมูล</TableHead>
                <TableHead className="text-center">เพิ่มข้อมูล</TableHead>
                <TableHead className="text-center">แก้ไข/ลบ</TableHead>
                <TableHead className="text-center">จัดการสิทธิ์</TableHead>
                <TableHead className="text-center">สิทธิ์การดูหน้า</TableHead>
                <TableHead>เข้าร่วมเมื่อ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {owner && (
                <TableRow className="bg-green-50">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-green-600" />
                      <span className="font-medium">{owner.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{owner.email}</TableCell>
                  <TableCell>
                    <Badge className="bg-green-600 hover:bg-green-700">
                      เจ้าของ
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">เต็มสิทธิ์</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">เต็มสิทธิ์</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">เต็มสิทธิ์</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">เต็มสิทธิ์</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">ทุกหน้า</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {format(new Date(owner.joinedAt), "d MMM yyyy", {
                      locale: th,
                    })}
                  </TableCell>
                </TableRow>
              )}
              {visibleMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{member.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{getMemberLabel(member)}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={member.canView}
                      disabled={!canManagePermissions || updatingMemberId === member.id}
                      onCheckedChange={(checked) =>
                        handlePermissionChange(
                          member.id,
                          buildNextPermissions(member, {
                            canView: !!checked,
                            canAdd: !!checked ? member.canAdd : false,
                            canEdit: !!checked ? member.canEdit : false,
                            canManagePermissions: !!checked ? member.canManagePermissions : false,
                            viewDashboard: !!checked ? member.viewDashboard : false,
                            viewInventory: !!checked ? member.viewInventory : false,
                            viewSummary: !!checked ? member.viewSummary : false,
                            viewCalendar: !!checked ? member.viewCalendar : false,
                            viewAnalysis: !!checked ? member.viewAnalysis : false,
                            viewPriceComparison: !!checked ? member.viewPriceComparison : false,
                            viewRecommendations: !!checked ? member.viewRecommendations : false,
                            viewMembers: !!checked ? member.viewMembers : false,
                            viewActivity: !!checked ? member.viewActivity : false,
                          })
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={member.canAdd}
                      disabled={!canManagePermissions || updatingMemberId === member.id || !member.canView}
                      onCheckedChange={(checked) =>
                        handlePermissionChange(
                          member.id,
                          buildNextPermissions(member, { canAdd: !!checked })
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={member.canEdit}
                      disabled={!canManagePermissions || updatingMemberId === member.id || !member.canView}
                      onCheckedChange={(checked) =>
                        handlePermissionChange(
                          member.id,
                          buildNextPermissions(member, { canEdit: !!checked })
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={member.canManagePermissions}
                      disabled={!canManagePermissions || updatingMemberId === member.id || !member.canView}
                      onCheckedChange={(checked) =>
                        handlePermissionChange(
                          member.id,
                          buildNextPermissions(member, {
                            canManagePermissions: !!checked,
                          })
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canManagePermissions || updatingMemberId === member.id || !member.canView}
                      onClick={() => setSelectedMemberForViewsId(member.id)}
                    >
                      ตั้งค่า
                    </Button>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {format(new Date(member.joinedAt), "d MMM yyyy", {
                      locale: th,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เชิญสมาชิกเข้าร่วม</DialogTitle>
            <DialogDescription>
              ส่งคำเชิญไปยังอีเมลของสมาชิกที่ต้องการเพิ่ม
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">อีเมล</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="member@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              />
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900 mb-2">
                💡 หรือแชร์รหัส Workspace
              </p>
              <p className="text-xs text-blue-700">
                คุณสามารถแชร์รหัส{" "}
                <span className="font-mono font-bold">
                  {currentWorkspace.code}
                </span>{" "}
                เพื่อให้สมาชิกเข้าร่วมได้เอง
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setIsInviteDialogOpen(false);
                  setInviteEmail("");
                }}
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleInvite}
                className="bg-green-600 hover:bg-green-700"
              >
                ส่งคำเชิญ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedMemberForViews}
        onOpenChange={(open) => !open && setSelectedMemberForViewsId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>กำหนดสิทธิ์การดูหน้า</DialogTitle>
            <DialogDescription>
              เลือกหน้าที่สมาชิกคนนี้สามารถเข้าดูได้ตามบทบาทที่กำหนด
            </DialogDescription>
          </DialogHeader>

          {selectedMemberForViews && (
            <div className="space-y-4">
              {viewPermissionItems.map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{item.label}</span>
                  <Switch
                    checked={Boolean(viewPermissionDraft?.[item.key])}
                    disabled={updatingMemberId === selectedMemberForViews.id}
                    onCheckedChange={(checked) => {
                      setViewPermissionDraft((prev) => ({
                        ...(prev || {}),
                        [item.key]: !!checked,
                      }));
                    }}
                  />
                </div>
              ))}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedMemberForViewsId(null)}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  className="bg-green-600 hover:bg-green-700"
                  disabled={updatingMemberId === selectedMemberForViews.id}
                  onClick={applyViewPermissionDraft}
                >
                  บันทึกสิทธิ์
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบ Workspace</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการลบ Workspace {currentWorkspace.name} ใช่หรือไม่? ข้อมูลทั้งหมดใน Workspace นี้จะถูกลบสำหรับสมาชิกทุกคน
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWorkspace}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "กำลังลบ..." : "ลบ Workspace"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
