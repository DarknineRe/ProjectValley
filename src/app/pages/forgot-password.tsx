import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Leaf, Mail, Lock, ArrowLeft, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { API_BASE } from "../../api";

type Step = "email" | "otp";

export function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("กรุณากรอกอีเมล");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "เกิดข้อผิดพลาด");
        return;
      }
      toast.success("ส่งรหัส OTP ไปที่อีเมลแล้ว (หากมีบัญชีอยู่)");
      if (data.devOtp) {
        toast.info(`OTP สำหรับทดสอบ: ${data.devOtp}`);
      }
      setStep("otp");
    } catch {
      toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || !newPassword || !confirmPassword) {
      toast.error("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("รหัสผ่านไม่ตรงกัน");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "เกิดข้อผิดพลาด");
        return;
      }
      toast.success("เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบใหม่");
      navigate("/login");
    } catch {
      toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับไปหน้าเข้าสู่ระบบ
        </Link>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            {step === "email" ? (
              <Leaf className="h-8 w-8 text-green-600" />
            ) : (
              <KeyRound className="h-8 w-8 text-green-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {step === "email" ? "ลืมรหัสผ่าน" : "ตั้งรหัสผ่านใหม่"}
          </h1>
          <p className="text-gray-600 text-sm">
            {step === "email"
              ? "กรอกอีเมลของคุณเพื่อรับรหัส OTP"
              : `กรอกรหัส OTP ที่ส่งไปที่ ${email} และตั้งรหัสผ่านใหม่`}
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
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
                  autoFocus
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={isLoading}
            >
              {isLoading ? "กำลังส่ง..." : "ส่งรหัส OTP"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              ส่งรหัส OTP ไปที่ <span className="font-semibold">{email}</span> แล้ว (หมดอายุใน 5 นาที)
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
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">รหัสผ่านใหม่</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
              <p className="text-xs text-gray-500">อย่างน้อย 6 ตัวอักษร</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">ยืนยันรหัสผ่านใหม่</Label>
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

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setStep("email"); setOtp(""); setNewPassword(""); setConfirmPassword(""); }}
                disabled={isLoading}
              >
                กลับ
              </Button>
              <Button
                type="submit"
                className="bg-green-600 hover:bg-green-700"
                disabled={isLoading}
              >
                {isLoading ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
