import { useState } from "react";
import { useAuth } from "../context/auth-context";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { User, Mail, Camera, Save, LogOut, ArrowLeft, Leaf, Phone, KeyRound, Lock } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router";
import { Badge } from "../components/ui/badge";
import { API_BASE } from "../../api";

export function Profile() {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [photoUrl, setPhotoUrl] = useState(user?.photoUrl || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setAddress] = useState(user?.address || "");
  const [isLoading, setIsLoading] = useState(false);

  // Change-password state
  const [pwStep, setPwStep] = useState<"idle" | "otp" | "new">("idle");
  const [pwOtp, setPwOtp] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [isPwLoading, setIsPwLoading] = useState(false);

  const handleRequestPasswordOtp = async () => {
    if (!user?.email) return;
    setIsPwLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "เกิดข้อผิดพลาด"); return; }
      toast.success("ส่ง OTP ไปที่อีเมลแล้ว");
      if (data.devOtp) toast.info(`OTP ทดสอบ: ${data.devOtp}`);
      setPwStep("otp");
    } catch { toast.error("ไม่สามารถเชื่อมต่อได้"); }
    finally { setIsPwLoading(false); }
  };

  const handleChangePassword = async () => {
    if (!pwOtp.trim() || !pwNew || !pwConfirm) { toast.error("กรุณากรอกข้อมูลให้ครบ"); return; }
    if (pwNew !== pwConfirm) { toast.error("รหัสผ่านไม่ตรงกัน"); return; }
    if (pwNew.length < 6) { toast.error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    setIsPwLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user?.email, otp: pwOtp.trim(), newPassword: pwNew }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "เกิดข้อผิดพลาด"); return; }
      toast.success("เปลี่ยนรหัสผ่านสำเร็จ!");
      setPwStep("idle"); setPwOtp(""); setPwNew(""); setPwConfirm("");
    } catch { toast.error("ไม่สามารถเชื่อมต่อได้"); }
    finally { setIsPwLoading(false); }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("กรุณากรอกชื่อ");
      return;
    }

    setIsLoading(true);
    try {
      await updateProfile({ name, photoUrl, phone, address });
      toast.success("บันทึกข้อมูลสำเร็จ!");
      setIsEditing(false);
    } catch (error) {
      toast.error("บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="hover:bg-gray-100"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg">
                <Leaf className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  โปรไฟล์
                </h1>
                <p className="text-sm text-gray-600">จัดการข้อมูลส่วนตัวของคุณ</p>
              </div>
            </div>
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
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Profile Card */}
            <Card className="p-6 md:col-span-1">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <Avatar className="h-32 w-32">
                    <AvatarImage src={photoUrl} alt={name} />
                    <AvatarFallback className="text-2xl bg-green-100 text-green-700">
                      {user ? getInitials(user.name) : "U"}
                    </AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <div className="absolute bottom-0 right-0 bg-green-600 text-white p-2 rounded-full cursor-pointer hover:bg-green-700">
                      <Camera className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">{user?.name}</h2>
                <p className="text-sm text-gray-500 mb-3">{user?.email}</p>
                {user?.loginMethod && (
                  <Badge variant="secondary" className="mb-4">
                    {user.loginMethod === "google" ? "Google Account" : "Email Login"}
                  </Badge>
                )}
              </div>
            </Card>

            {/* Profile Information */}
            <Card className="p-6 md:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">ข้อมูลส่วนตัว</h3>
                {!isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    แก้ไข
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">ชื่อ</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="ชื่อของคุณ"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10"
                      disabled={!isEditing || isLoading}
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
                      value={user?.email || ""}
                      className="pl-10 bg-gray-50"
                      disabled
                    />
                  </div>
                  <p className="text-xs text-gray-500">ไม่สามารถเปลี่ยนอีเมลได้</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="photoUrl">URL รูปโปรไฟล์</Label>
                  <div className="relative">
                    <Camera className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="photoUrl"
                      type="url"
                      placeholder="https://example.com/photo.jpg"
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      className="pl-10"
                      disabled={!isEditing || isLoading}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    ใส่ URL รูปภาพของคุณ (ไม่บังคับ)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="08x-xxx-xxxx"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-10"
                      disabled={!isEditing || isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">ที่อยู่เริ่มต้น</Label>
                  <Input
                    id="address"
                    type="text"
                    placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={!isEditing || isLoading}
                  />
                </div>

                {isEditing && (
                  <div className="flex gap-2 pt-4">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={handleSave}
                      disabled={isLoading}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isLoading ? "กำลังบันทึก..." : "บันทึก"}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setIsEditing(false);
                        setName(user?.name || "");
                        setPhotoUrl(user?.photoUrl || "");
                        setPhone(user?.phone || "");
                        setAddress(user?.address || "");
                      }}
                      disabled={isLoading}
                    >
                      ยกเลิก
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            {/* Account Statistics */}
            <Card className="p-6 md:col-span-3">
              <h3 className="text-xl font-bold text-gray-900 mb-4">สถิติบัญชี</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">วันที่สร้างบัญชี</p>
                  <p className="text-lg font-bold text-gray-900">
                    {new Date().toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">สถานะบัญชี</p>
                  <p className="text-lg font-bold text-gray-900">ใช้งานอยู่</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">วิธีการเข้าสู่ระบบ</p>
                  <p className="text-lg font-bold text-gray-900">
                    {user?.loginMethod === "google" ? "Google" : "อีเมล"}
                  </p>
                </div>
              </div>
            </Card>

            {/* Change Password Section */}
            <Card className="p-6 md:col-span-3">
              <div className="flex items-center gap-2 mb-4">
                <KeyRound className="h-5 w-5 text-gray-700" />
                <h3 className="text-xl font-bold text-gray-900">เปลี่ยนรหัสผ่าน</h3>
              </div>

              {user?.loginMethod === "google" ? (
                <p className="text-sm text-gray-500">
                  บัญชีนี้เข้าสู่ระบบด้วย Google ไม่สามารถตั้งรหัสผ่านได้
                </p>
              ) : pwStep === "idle" ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    กดปุ่มเพื่อรับรหัส OTP ทางอีเมลและตั้งรหัสผ่านใหม่
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRequestPasswordOtp}
                    disabled={isPwLoading}
                  >
                    {isPwLoading ? "กำลังส่ง..." : "เปลี่ยนรหัสผ่าน"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 max-w-sm">
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                    กรอกรหัส OTP ที่ส่งไปที่ <span className="font-semibold">{user?.email}</span>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pw-otp">รหัส OTP</Label>
                    <Input
                      id="pw-otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6 หลัก"
                      value={pwOtp}
                      onChange={(e) => setPwOtp(e.target.value.replace(/\D/g, ""))}
                      disabled={isPwLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pw-new">รหัสผ่านใหม่</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="pw-new"
                        type="password"
                        placeholder="••••••••"
                        value={pwNew}
                        onChange={(e) => setPwNew(e.target.value)}
                        className="pl-10"
                        disabled={isPwLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pw-confirm">ยืนยันรหัสผ่านใหม่</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="pw-confirm"
                        type="password"
                        placeholder="••••••••"
                        value={pwConfirm}
                        onChange={(e) => setPwConfirm(e.target.value)}
                        className="pl-10"
                        disabled={isPwLoading}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setPwStep("idle"); setPwOtp(""); setPwNew(""); setPwConfirm(""); }}
                      disabled={isPwLoading}
                    >
                      ยกเลิก
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={handleChangePassword}
                      disabled={isPwLoading}
                    >
                      {isPwLoading ? "กำลังบันทึก..." : "ยืนยันเปลี่ยนรหัสผ่าน"}
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* Security Info */}
            <Card className="p-6 md:col-span-3 border-green-200 bg-green-50">
              <h3 className="text-base font-semibold text-gray-900 mb-1">ความปลอดภัยของบัญชี</h3>
              <p className="text-sm text-gray-600">
                ข้อมูลของคุณถูกเก็บในระบบเซิร์ฟเวอร์อย่างปลอดภัย รหัสผ่านถูกเข้ารหัส (bcrypt) ก่อนจัดเก็บ{" "}
                หากพบพฤติกรรมผิดปกติ{" "}
                <Link to="/forgot-password" className="text-green-700 font-medium underline">
                  เปลี่ยนรหัสผ่านทันที
                </Link>
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}