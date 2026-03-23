import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Store, ArrowLeft, User } from "lucide-react";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { useAuth } from "../context/auth-context";
import { Marketplace } from "./marketplace";

export function MarketplaceStandalone() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

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
            <Button variant="outline" onClick={() => navigate("/hub")}> 
              <ArrowLeft className="mr-2 h-4 w-4" />
              กลับหน้า Workspace
            </Button>
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
