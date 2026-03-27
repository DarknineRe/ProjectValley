import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from "../context/auth-context";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Leaf, Lock, Mail, User as UserIcon, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { register, verifyRegisterOtp, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const redirectTo = "/hub";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !email || !password || !confirmPassword) {
      toast.error("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("รหัสผ่านไม่ตรงกัน");
      return;
    }

    if (password.length < 6) {
      toast.error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setIsLoading(true);
    try {
      const result = await register(name, email, password);
      if (result.requiresOtp) {
        setOtpEmail(result.email || email);
        setOtpStep(true);
        toast.success("ส่ง OTP ไปที่อีเมลแล้ว");
        if (result.devOtp) {
          toast.info(`OTP สำหรับทดสอบ: ${result.devOtp}`);
        }
        return;
      }

      toast.success("สมัครสมาชิกสำเร็จ!");
      navigate(redirectTo);
    } catch (error: any) {
      const errorMessage = error?.message || "สมัครสมาชิกไม่สำเร็จ";
      toast.error(errorMessage);
      console.error("Registration error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      toast.error("กรุณากรอกรหัส OTP");
      return;
    }

    setIsLoading(true);
    try {
      await verifyRegisterOtp(otpEmail, otp.trim());
      toast.success("ยืนยัน OTP สำเร็จ");
      navigate(redirectTo);
    } catch (error: any) {
      toast.error(error.message || "OTP ไม่ถูกต้อง");
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (response) => {
      try {
        setIsLoading(true);
        await loginWithGoogle(response.access_token);
        toast.success("เข้าสู่ระบบด้วย Google สำเร็จ!");
        navigate(redirectTo);
      } catch (error) {
        toast.error("เข้าสู่ระบบไม่สำเร็จ");
      } finally {
        setIsLoading(false);
      }
    },
    onError: () => {
      toast.error("เข้าสู่ระบบด้วย Google ล้มเหลว");
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        {/* Back Button */}
        <Link 
          to="/login"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับไปหน้าเข้าสู่ระบบ
        </Link>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <Leaf className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            สมัครสมาชิก
          </h1>
          <p className="text-gray-600">
            สร้างบัญชีใหม่เพื่อเริ่มจัดการผลผลิตทางการเกษตร
          </p>
        </div>

        {otpStep ? (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            เราส่งรหัส OTP ไปที่อีเมล <span className="font-semibold">{otpEmail}</span> แล้ว
          </div>

          <div className="space-y-2">
            <Label htmlFor="otp">รหัส OTP</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="กรอกรหัส 6 หลัก"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOtpStep(false);
                setOtp("");
                setOtpEmail("");
              }}
              disabled={isLoading}
            >
              กลับ
            </Button>
            <Button
              type="submit"
              className="bg-green-600 hover:bg-green-700"
              disabled={isLoading}
            >
              {isLoading ? "กำลังยืนยัน..." : "ยืนยัน OTP"}
            </Button>
          </div>
        </form>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">ชื่อ-นามสกุล</Label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="name"
                type="text"
                placeholder="ชื่อของคุณ"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>

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
            <p className="text-xs text-gray-500">รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">ยืนยันรหัสผ่าน</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
            {isLoading ? "กำลังส่ง OTP..." : "สมัครสมาชิก"}
          </Button>
        </form>
        )}

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
          สมัครด้วย Google
        </Button>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            มีบัญชีอยู่แล้ว?{" "}
            <Link 
              to="/login"
              className="text-green-600 hover:text-green-700 font-medium"
            >
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>


      </Card>
    </div>
  );
}
