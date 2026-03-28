import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { Package, Calendar, BarChart3, Menu, ClipboardList, BarChart2, Users, Building2, LogOut, Store, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { useState, useEffect } from "react";
import { useWorkspace } from "../context/workspace-context";
import { useAuth } from "../context/auth-context";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { API_BASE } from "../../api";
type RoleMode = "admin" | "merchant" | "buyer";

const navItems = [
  { path: "/marketplace", label: "ตลาดกลาง", icon: Store, permissionKey: "canView" as const, audience: ["admin", "merchant", "buyer"] as RoleMode[] },
  { path: "/workspace/inventory", label: "จัดการสต็อก", icon: Package, permissionKey: "viewInventory" as const, audience: ["admin", "merchant"] as RoleMode[] },
  { path: "/workspace/summary", label: "สรุปสต็อก", icon: BarChart2, permissionKey: "viewSummary" as const, audience: ["admin", "merchant"] as RoleMode[] },
  { path: "/workspace/price-search", label: "เช็กราคา", icon: BarChart3, permissionKey: "viewPriceComparison" as const, audience: ["admin", "merchant", "buyer"] as RoleMode[] },
  { path: "/workspace/calendar", label: "ปฏิทินการปลูก", icon: Calendar, permissionKey: "viewCalendar" as const, audience: ["admin", "merchant"] as RoleMode[] },
  { path: "/workspace/members", label: "สมาชิก", icon: Users, permissionKey: "viewMembers" as const, audience: ["admin"] as RoleMode[] },
  { path: "/workspace/activity", label: "ประวัติการเปลี่ยนแปลง", icon: ClipboardList, permissionKey: "viewActivity" as const, audience: ["admin", "merchant"] as RoleMode[] },
];

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const { currentWorkspace, isLoading, isGlobalAdmin, getUserRole, getUserPermissions } = useWorkspace();
  const { user, logout, isAuthenticated } = useAuth();
  const userRole = getUserRole();
  const permissions = getUserPermissions();
  const roleLabel =
    isGlobalAdmin
      ? "Admin"
      : userRole === "owner"
      ? "เจ้าของ"
      : permissions.canAdd
      ? "ผู้ค้า"
      : "ผู้เยี่ยมชม";

  const roleMode: RoleMode =
    isGlobalAdmin ? "admin" : permissions.canAdd ? "merchant" : "buyer";

  const accessibleNavItems = navItems.filter(
    (item) =>
      permissions.canView &&
      permissions[item.permissionKey] &&
      item.audience.includes(roleMode)
  );

  const roleSubtitle =
    roleMode === "buyer"
      ? "เลือกสินค้า ดูสต็อกของคุณและของผู้ขายคนอื่น แล้วกดซื้อได้ทันที"
      : roleMode === "merchant"
      ? "จัดการสต็อกของร้านคุณและตั้งราคาเพื่อขาย"
      : "ดูภาพรวม จัดการผู้ค้า และกำหนดสิทธิ์ผู้ใช้งาน";

  // Redirect if not authenticated or no workspace
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    } else if (!isLoading && !currentWorkspace) {
      navigate("/hub");
    } else if (accessibleNavItems.length > 0) {
      const isOutsideWorkspace = !location.pathname.startsWith("/workspace/");
      if (isOutsideWorkspace && location.pathname !== "/marketplace") {
        navigate(accessibleNavItems[0].path);
        return;
      }

      if (!isOutsideWorkspace) {
        const canAccessCurrent = accessibleNavItems.some(
          (item) => item.path === location.pathname
        );
        if (!canAccessCurrent) {
          const fallbackWorkspaceRoute =
            accessibleNavItems.find((item) => item.path.startsWith("/workspace/")) ||
            accessibleNavItems[0];
          navigate(fallbackWorkspaceRoute.path);
        }
      }
    }
  }, [isAuthenticated, isLoading, currentWorkspace, accessibleNavItems, location.pathname, navigate]);

  useEffect(() => {
    if (!user?.id) {
      setPendingRequestCount(0);
      return;
    }
    const loadCount = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/item-requests?seller_id=${encodeURIComponent(user.id)}`);
        if (!res.ok) return;
        const data = await res.json();
        setPendingRequestCount((Array.isArray(data) ? data : []).filter((r: any) => r.status === "pending").length);
      } catch {}
    };
    loadCount();
    const interval = setInterval(loadCount, 60_000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="flex items-center gap-3 rounded-xl border bg-white px-5 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-green-600" />
          <span className="text-sm font-medium text-green-800">กำลังโหลดข้อมูล Workspace...</span>
        </div>
      </div>
    );
  }

  if (!currentWorkspace) {
    return null;
  }

  const NavLinks = () => (
    <>
      {accessibleNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        const showBadge = item.path === "/marketplace" && pendingRequestCount > 0;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive
                ? "bg-green-600 text-white"
                : "text-gray-700 hover:bg-green-50"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="font-medium">{item.label}</span>
            {showBadge && (
              <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                {pendingRequestCount}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-green-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger className="lg:hidden">
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <div className="p-6 border-b bg-green-600">
                    <h2 className="text-lg font-bold text-white">เมนู</h2>
                  </div>
                  <nav className="flex flex-col gap-2 p-4">
                    <NavLinks />
                  </nav>
                </SheetContent>
              </Sheet>
              
              <div className="bg-green-600 p-2 rounded-lg">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
                  ระบบจัดการผลผลิตทางการเกษตร
                </h1>
                <p className="text-xs lg:text-sm text-gray-600">
                  {roleSubtitle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                <Building2 className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">
                  {currentWorkspace?.name}
                </span>
                <Badge
                  variant={userRole === "owner" ? "default" : "secondary"}
                  className={
                    userRole === "owner" ? "bg-green-600" : "bg-green-100 text-green-800"
                  }
                >
                  {roleLabel}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="h-4 w-4 mr-2" />
                ออกจากระบบ
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/profile")}
                className="flex items-center gap-2 hover:bg-green-50"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.photoUrl} />
                  <AvatarFallback className="bg-green-100 text-green-700">
                    {user ? getInitials(user.name) : "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline">{user?.name}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar - Desktop */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="bg-white rounded-lg border p-4 sticky top-24">
              <nav className="flex flex-col gap-2">
                <NavLinks />
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}