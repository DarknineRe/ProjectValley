import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/auth-context";
import { useWorkspace } from "../context/workspace-context";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
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
import { Leaf, Plus, LogOut, Users, Code, ChevronRight, Building2, Trash2 } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Workspace } from "../context/workspace-context";

export function Hub() {
  const { user, logout } = useAuth();
  const {
    workspaces,
    createWorkspace,
    joinWorkspace,
    deleteWorkspace,
    setCurrentWorkspace,
  } =
    useWorkspace();
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    
    // Check if user is admin (owner of at least one workspace)
    const isAdmin = workspaces.some((ws) => ws.ownerId === user.id);
    
    // If not admin, redirect to workspace marketplace
    if (workspaces.length > 0 && !isAdmin) {
      navigate("/workspace/marketplace");
    }
  }, [user, navigate, workspaces]);

  if (!user) {
    return null;
  }

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      toast.error("กรุณาใส่ชื่อ Workspace");
      return;
    }
    try {
      await createWorkspace(newWorkspaceName.trim());
      setIsCreateDialogOpen(false);
      setNewWorkspaceName("");
      toast.success("สร้าง Workspace สำเร็จ!");
      navigate("/workspace/marketplace");
    } catch (error) {
      toast.error("ไม่สามารถสร้าง Workspace ได้");
    }
  };

  const handleJoinWorkspace = async () => {
    if (!joinCode.trim()) {
      toast.error("กรุณาใส่รหัส Workspace");
      return;
    }
    const success = await joinWorkspace(joinCode);
    if (success) {
      setIsJoinDialogOpen(false);
      setJoinCode("");
      toast.success("เข้าร่วม Workspace สำเร็จ!");
      navigate("/workspace/marketplace");
    } else {
      toast.error("ไม่พบ Workspace ที่ใช้รหัสนี้");
    }
  };

  const handleSelectWorkspace = (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    navigate("/workspace/marketplace");
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
    if (isOwner) {
      return "Admin";
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
              หรือสร้าง Workspace ใหม่เพื่อเริ่มต้นจัดการสต็อก
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <Card
              className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-green-200 hover:border-green-400"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <Plus className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900">
                    สร้าง Workspace ใหม่
                  </h3>
                  <p className="text-sm text-gray-600">
                    เริ่มต้นจัดการสต็อกของคุณเอง
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </Card>

            <Card
              className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-blue-200 hover:border-blue-400"
              onClick={() => setIsJoinDialogOpen(true)}
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Code className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900">
                    เข้าร่วม Workspace
                  </h3>
                  <p className="text-sm text-gray-600">
                    ใช้รหัสเพื่อเข้าร่วม Workspace
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </Card>
          </div>

          {/* Workspace List */}
          {workspaces.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Workspace ของคุณ
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {workspaces.map((workspace) => {
                  const isOwner = workspace.ownerId === user?.id;
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

          {workspaces.length === 0 && (
            <Card className="p-12 text-center">
              <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                ยังไม่มี Workspace
              </h3>
              <p className="text-gray-600 mb-6">
                สร้าง Workspace ใหม่หรือเข้าร่วม Workspace ที่มีอยู่
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Create Workspace Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>สร้าง Workspace ใหม่</DialogTitle>
            <DialogDescription>
              ตั้งชื่อให้กับ Workspace ของคุณ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">ชื่อ Workspace</Label>
              <Input
                id="workspace-name"
                placeholder="เช่น สวนผักครอบครัว"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateWorkspace()}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  setNewWorkspaceName("");
                }}
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleCreateWorkspace}
                className="bg-green-600 hover:bg-green-700"
              >
                สร้าง Workspace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Workspace Dialog */}
      <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เข้าร่วม Workspace</DialogTitle>
            <DialogDescription>
              ใส่รหัส 6 หลักเพื่อเข้าร่วม Workspace
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="join-code">รหัส Workspace</Label>
              <Input
                id="join-code"
                placeholder="ABC123"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleJoinWorkspace()}
                maxLength={6}
                className="font-mono text-lg text-center"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setIsJoinDialogOpen(false);
                  setJoinCode("");
                }}
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleJoinWorkspace}
                className="bg-blue-600 hover:bg-blue-700"
              >
                เข้าร่วม
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}