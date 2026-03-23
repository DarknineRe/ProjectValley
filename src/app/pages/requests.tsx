import { useState, useEffect } from "react";
import { useAuth } from "../context/auth-context";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { MessageSquarePlus, Inbox, SendHorizonal, Check, X, Loader2 } from "lucide-react";
import { Skeleton } from "../components/ui/skeleton";
import { toast } from "sonner";
import { API_BASE } from "../../api";

interface ChangeRequest {
  id: string;
  product_id: string;
  product_name: string;
  requester_id: string;
  requester_name: string;
  requester_email: string;
  seller_id: string;
  seller_name: string;
  seller_email: string | null;
  request_type: "delete" | "decrease";
  decrease_by: number | null;
  message: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  updated_at: string;
}

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
});

function statusBadge(status: string) {
  if (status === "pending")
    return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">รอดำเนินการ</Badge>;
  if (status === "accepted")
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">ยอมรับแล้ว</Badge>;
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">ปฏิเสธ</Badge>;
}

export function Requests() {
  const { user } = useAuth();

  const [inboxRequests, setInboxRequests] = useState<ChangeRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<ChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [inboxRes, sentRes] = await Promise.all([
        fetch(`${API_BASE}/api/item-requests?seller_id=${encodeURIComponent(user.id)}`),
        fetch(`${API_BASE}/api/item-requests?requester_id=${encodeURIComponent(user.id)}`),
      ]);
      if (inboxRes.ok) setInboxRequests(await inboxRes.json());
      if (sentRes.ok) setSentRequests(await sentRes.json());
    } catch {
      toast.error("ไม่สามารถโหลดข้อมูลคำขอได้");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user]);

  const updateStatus = async (id: string, status: "accepted" | "rejected") => {
    setUpdatingId(id);
    try {
      const res = await fetch(`${API_BASE}/api/item-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setInboxRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: updated.status } : r))
        );
        toast.success(status === "accepted" ? "ยอมรับคำขอแล้ว" : "ปฏิเสธคำขอแล้ว");
      } else {
        toast.error("ไม่สามารถอัปเดตสถานะได้");
      }
    } catch {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setUpdatingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <section className="rounded-2xl border bg-white px-6 py-8 md:px-10">
          <Skeleton className="mb-2 h-3 w-20" />
          <Skeleton className="mt-2 h-9 w-72" />
          <Skeleton className="mt-2 h-4 w-80" />
        </section>
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            <span className="text-sm text-slate-500">กำลังโหลดคำขอ...</span>
          </div>
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-16 w-full rounded-md" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-white px-6 py-8 md:px-10">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-green-600">Requests</p>
          <h2 className="text-3xl font-semibold text-green-900 md:text-4xl">คำขอยืนยันการจัดการสินค้า</h2>
          <p className="mt-2 text-green-700">
            เจ้าของ Workspace ตรวจสอบและยืนยันคำขอจากผู้ดูแลระบบ
          </p>
        </div>
      </section>

      <Tabs defaultValue="inbox">
        <TabsList className="mb-4">
          <TabsTrigger value="inbox">
            <Inbox className="mr-2 h-4 w-4" />
            กล่องรับ ({inboxRequests.length})
          </TabsTrigger>
          <TabsTrigger value="sent">
            <SendHorizonal className="mr-2 h-4 w-4" />
            ที่ส่งออก ({sentRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox">
          {inboxRequests.length === 0 ? (
            <Card className="p-10 text-center text-gray-500">
              <MessageSquarePlus className="mx-auto mb-3 h-8 w-8 text-gray-300" />
              <p>ยังไม่มีคำขอแก้ไขข้อมูลสินค้าของคุณ</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {inboxRequests.map((req) => (
                <Card key={req.id} className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{req.product_name}</p>
                        {statusBadge(req.status)}
                      </div>
                      <p className="text-sm text-gray-600">
                        จาก: {req.requester_name} ({req.requester_email})
                      </p>
                      <p className="text-sm text-green-700">
                        ประเภทคำขอ: {req.request_type === "delete" ? "ลบรายการสินค้า" : `ลดจำนวนสินค้า ${Number(req.decrease_by || 0).toLocaleString("th-TH")}`}
                      </p>
                      <p className="text-sm text-gray-500">
                        {dateFormatter.format(new Date(req.created_at))}
                      </p>
                      <p className="mt-2 rounded-md bg-slate-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">
                        {req.message}
                      </p>
                    </div>
                    {req.status === "pending" && (
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          disabled={updatingId === req.id}
                          onClick={() => updateStatus(req.id, "accepted")}
                        >
                          <Check className="mr-1 h-3.5 w-3.5" />
                          ยอมรับ
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          disabled={updatingId === req.id}
                          onClick={() => updateStatus(req.id, "rejected")}
                        >
                          <X className="mr-1 h-3.5 w-3.5" />
                          ปฏิเสธ
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sent">
          {sentRequests.length === 0 ? (
            <Card className="p-10 text-center text-gray-500">
              <SendHorizonal className="mx-auto mb-3 h-8 w-8 text-gray-300" />
              <p>คุณยังไม่ได้ส่งคำขอแก้ไขข้อมูลสินค้าใดเลย</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {sentRequests.map((req) => (
                <Card key={req.id} className="p-5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{req.product_name}</p>
                      {statusBadge(req.status)}
                    </div>
                    <p className="text-sm text-gray-600">
                      ถึง: {req.seller_name}
                    </p>
                    <p className="text-sm text-green-700">
                      ประเภทคำขอ: {req.request_type === "delete" ? "ลบรายการสินค้า" : `ลดจำนวนสินค้า ${Number(req.decrease_by || 0).toLocaleString("th-TH")}`}
                    </p>
                    <p className="text-sm text-gray-500">
                      {dateFormatter.format(new Date(req.created_at))}
                    </p>
                    <p className="mt-2 rounded-md bg-slate-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">
                      {req.message}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
