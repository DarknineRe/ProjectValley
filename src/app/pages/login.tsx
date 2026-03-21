import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from "../context/auth-context";
import { useWorkspace } from "../context/workspace-context";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Leaf, Lock, Mail } from "lucide-react";
import { toast } from "sonner";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const { workspaces, currentWorkspace } = useWorkspace();
  const navigate = useNavigate();

  // Effect to route user after workspaces are loaded
  useEffect(() => {
    if (isLoading || !workspaces.length) return;

    // Determine user role based on workspaces
    const hasOwnerRole = workspaces.some((ws) => ws.ownerId === localStorage.getItem("currentUserId"));
    const hasEmployeeRole = workspaces.length > 0;

    // Route based on role
    if (hasOwnerRole) {
      // Admin (owner) -> Hub
      navigate("/hub");
    } else if (hasEmployeeRole && currentWorkspace) {
      // Seller (employee) -> Marketplace (workspace view)
      navigate("/marketplace");
    } else {
      // Fallback to hub
      navigate("/hub");
    }
  }, [workspaces, currentWorkspace, navigate, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      // Store user ID for role detection
      const userData = JSON.parse(localStorage.getItem("currentUser") || "{}");
      localStorage.setItem("currentUserId", userData.id);
      toast.success("เข้าสู่ระบบสำเร็จ!");
      // Routing will be handled by useEffect above
    } catch (error: any) {
      setIsLoading(false);
      toast.error(error.message || "เข้าสู่ระบบไม่สำเร็จ");
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (response) => {
      try {
        setIsLoading(true);
        await loginWithGoogle(response.access_token);
        // Store user ID for role detection
        const userData = JSON.parse(localStorage.getItem("currentUser") || "{}");
        localStorage.setItem("currentUserId", userData.id);
        toast.success("เข้าสู่ระบบด้วย Google สำเร็จ!");
        // Routing will be handled by useEffect above
      } catch (error: any) {
        setIsLoading(false);
        toast.error(error.message || "เข้าสู่ระบบด้วย Google ไม่สำเร็จ");
      }
    },
    onError: () => {
      toast.error("เข้าสู่ระบบด้วย Google ล้มเหลว");
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <Leaf className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ระบบผู้ขาย
          </h1>
          <p className="text-gray-600 text-sm mb-4">
            เข้าสู่ระบบสำหรับผู้ขาย (ผู้ค้า)
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-700">
            💡 หากคุณเป็นผู้ซื้อ กรุณาเยี่ยมชม <Link to="/buyer" className="font-bold hover:underline">ตลาดกลาง</Link> แทน
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="email">อีเมล</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">รหัสผ่าน</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700"
            disabled={isLoading}
          >
            {isLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </Button>
        </form>

        <div className="mt-6 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">หรือ</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full mt-4 flex items-center justify-center gap-2"
          onClick={() => googleLogin()}
          disabled={isLoading}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          เข้าสู่ระบบด้วย Google
        </Button>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            ยังไม่มีบัญชี?{" "}
            <Link 
              to="/register" 
              className="text-green-600 hover:text-green-700 font-medium"
            >
              สมัครสมาชิก
            </Link>
          </p>
        </div>


      </Card>
    </div>
  );
}