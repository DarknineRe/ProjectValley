import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/auth-context";
import { useWorkspace } from "../context/workspace-context";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Leaf, LogOut, Users, Code, ChevronRight, Building2, Trash2, Store, Pencil } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Workspace } from "../context/workspace-context";

export function Hub() {
  const { user, logout } = useAuth();
  const {
    workspaces,
    isGlobalAdmin,
    deleteWorkspace,
    updateWorkspaceName,
    setCurrentWorkspace,
  } =
    useWorkspace();
  const navigate = useNavigate();
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);
  const [workspaceToRename, setWorkspaceToRename] = useState<Workspace | null>(null);
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState("");
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const [isRenamingWorkspace, setIsRenamingWorkspace] = useState(false);
  const isAdmin = isGlobalAdmin;
  const visibleWorkspaces = isAdmin ? workspaces : workspaces.slice(0, 1);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
  }, [user, navigate, workspaces]);

  if (!user) {
    return null;
  }

  const handleSelectWorkspace = (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    navigate(isAdmin ? "/workspace/marketplace" : "/workspace/inventory");
  };

  const handleDeleteWorkspace = async () => {
    if (!workspaceToDelete) return;
    setIsDeletingWorkspace(true);
    try {
      const success = await deleteWorkspace(workspaceToDelete.id);
      if (success) {
        toast.success("ลบ Workspace สำเร็จ");
        setWorkspaceToDelete(null);
      } else {
        toast.error("ไม่สามารถลบ Workspace ได้");
      }
    } catch (error) {
      toast.error("ไม่สามารถลบ Workspace ได้");
    } finally {
      setIsDeletingWorkspace(false);
    }
  };

  const openRenameDialog = (workspace: Workspace) => {
    setWorkspaceToRename(workspace);
    setWorkspaceNameDraft(workspace.name);
  };

  const handleRenameWorkspace = async () => {
    if (!workspaceToRename) return;

    const trimmedName = workspaceNameDraft.trim();
    if (trimmedName.length < 2) {
      toast.error("ชื่อ Workspace ต้องมีอย่างน้อย 2 ตัวอักษร");
      return;
    }

    setIsRenamingWorkspace(true);
    try {
      const success = await updateWorkspaceName(workspaceToRename.id, trimmedName);
      if (success) {
        toast.success("เปลี่ยนชื่อ Workspace สำเร็จ");
        setWorkspaceToRename(null);
        setWorkspaceNameDraft("");
      } else {
        toast.error("ไม่สามารถเปลี่ยนชื่อ Workspace ได้");
      }
    } catch {
      toast.error("ไม่สามารถเปลี่ยนชื่อ Workspace ได้");
    } finally {
      setIsRenamingWorkspace(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
    toast.success("ออกจากระบบสำเร็จ");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getWorkspaceRoleLabel = (isOwner: boolean, memberCount: number) => {
    if (isAdmin && !isOwner) {
      return "Admin ระบบ";
    }
    if (isOwner) {
      return "เจ้าของ";
    }
    return memberCount > 1 ? "สมาชิกตลาดกลาง" : "ผู้ใช้งาน";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg">
                <Leaf className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  ระบบจัดการสต็อกเกษตร
                </h1>
                <p className="text-sm text-gray-600">สวัสดี, {user?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate("/profile")}
                className="hover:bg-gray-100"
                title="โปรไฟล์"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.photoUrl} />
                  <AvatarFallback className="bg-green-100 text-green-700">
                    {getInitials(user?.name || "U")}
                  </AvatarFallback>
                </Avatar>
              </Button>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                ออกจากระบบ
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Title */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              เลือก Workspace ของคุณ
            </h2>
            <p className="text-gray-600">
              {isAdmin
                ? "ผู้ดูแลสามารถเข้าได้ทุก Workspace"
                : "บัญชีนี้สามารถเข้าใช้งานได้เฉพาะ Workspace ของตนเอง"}
            </p>
          </div>

          {isAdmin && (
            <Card
              className="p-6 mb-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-emerald-200 hover:border-emerald-400"
              onClick={() => navigate("/workspace/marketplace")}
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 rounded-full">
                  <Store className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900">ตลาดกลาง (Marketplace)</h3>
                  <p className="text-sm text-gray-600">เฉพาะผู้ดูแลระบบ สามารถดูข้อมูลรวมทุก Workspace</p>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </Card>
          )}

          {/* Workspace List */}
          {visibleWorkspaces.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Workspace ของคุณ
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {visibleWorkspaces.map((workspace) => {
                  const isOwner = workspace.ownerId === user?.id;
                  const canRenameWorkspace = isOwner;
                  return (
                    <Card
                      key={workspace.id}
                      className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => handleSelectWorkspace(workspace)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="p-3 bg-gray-100 rounded-full">
                            <Building2 className="h-6 w-6 text-gray-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-lg text-gray-900">
                                {workspace.name}
                              </h4>
                              <Badge
                                variant={isOwner ? "default" : "secondary"}
                                className={isOwner ? "bg-green-600" : ""}
                              >
                                {getWorkspaceRoleLabel(isOwner, workspace.members.length)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                {workspace.members.length} สมาชิก
                              </div>
                              <div className="flex items-center gap-1">
                                <Code className="h-4 w-4" />
                                รหัส: <span className="font-mono font-bold">{workspace.code}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {canRenameWorkspace && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                openRenameDialog(workspace);
                              }}
                              title="เปลี่ยนชื่อ Workspace"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {isOwner && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="text-red-600 hover:text-red-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                setWorkspaceToDelete(workspace);
                              }}
                              title="ลบ Workspace"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          <ChevronRight className="h-6 w-6 text-gray-400" />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {visibleWorkspaces.length === 0 && (
            <Card className="p-12 text-center">
              <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                ยังไม่มี Workspace
              </h3>
              <p className="text-gray-600 mb-6">
                ยังไม่มี Workspace ที่ผูกกับบัญชีนี้
              </p>
            </Card>
          )}
        </div>
      </div>

      <AlertDialog
        open={!!workspaceToDelete}
        onOpenChange={(open) => {
          if (!open) setWorkspaceToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบ Workspace</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการลบ Workspace {workspaceToDelete?.name} ใช่หรือไม่? ข้อมูลทั้งหมดใน Workspace นี้จะถูกลบสำหรับสมาชิกทุกคน
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingWorkspace}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWorkspace}
              disabled={isDeletingWorkspace}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeletingWorkspace ? "กำลังลบ..." : "ลบ Workspace"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!workspaceToRename}
        onOpenChange={(open) => {
          if (!open) {
            setWorkspaceToRename(null);
            setWorkspaceNameDraft("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เปลี่ยนชื่อ Workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              ตั้งชื่อใหม่ให้ Workspace เพื่อให้สมาชิกหาเจอและแยกแยะได้ง่ายขึ้น
            </p>
            <Input
              value={workspaceNameDraft}
              onChange={(event) => setWorkspaceNameDraft(event.target.value)}
              placeholder="ระบุชื่อ Workspace ใหม่"
              maxLength={100}
              disabled={isRenamingWorkspace}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setWorkspaceToRename(null);
                setWorkspaceNameDraft("");
              }}
              disabled={isRenamingWorkspace}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              className="bg-green-600 hover:bg-green-700"
              onClick={handleRenameWorkspace}
              disabled={isRenamingWorkspace}
            >
              {isRenamingWorkspace ? "กำลังบันทึก..." : "บันทึกชื่อใหม่"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}