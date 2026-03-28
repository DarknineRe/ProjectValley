import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Store, ArrowLeft, User, Bell } from "lucide-react";
import { API_BASE } from "../../api";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { useAuth } from "../context/auth-context";
import { useWorkspace } from "../context/workspace-context";
import { Marketplace } from "./marketplace";

export function MarketplaceStandalone() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!user?.id) return;
    const loadCount = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/item-requests?seller_id=${encodeURIComponent(user.id)}`);
        if (!res.ok) return;
        const data = await res.json();
        setPendingCount((Array.isArray(data) ? data : []).filter((r: any) => r.status === "pending").length);
      } catch {}
    };
    loadCount();
    const interval = setInterval(loadCount, 60_000);
    return () => clearInterval(interval);
  }, [user?.id]);

  if (!isAuthenticated) {
    return null;
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-green-50">
      <header className="sticky top-0 z-20 border-b bg-white">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-600 p-2">
              <Store className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">ตลาดกลางสินค้า</h1>
              <p className="text-sm text-gray-600">รวมสินค้าจากทุก Workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(currentWorkspace ? "/workspace/inventory" : "/hub")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              กลับหน้า Workspace
            </Button>
            {pendingCount > 0 && (
              <div className="relative flex items-center">
                <Bell className="h-5 w-5 text-gray-600" />
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                  {pendingCount}
                </span>
              </div>
            )}
            <Button variant="ghost" onClick={() => navigate("/profile")}> 
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.photoUrl} />
                <AvatarFallback className="bg-green-100 text-green-700">
                  {user?.name ? getInitials(user.name) : <User className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Marketplace />
      </main>
    </div>
  );
}
