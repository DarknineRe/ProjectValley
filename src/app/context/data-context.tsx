import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "sonner";
import { API_BASE } from "../../api";
import { useWorkspace } from "./workspace-context";
import { useAuth } from "./auth-context";

export interface Product {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  price: number;
  imageUrl?: string;
  sellerId: string;
  sellerName: string;
  minStock: number;
  harvestDate?: Date; // วันที่เก็บเกี่ยว
  lastUpdated: Date;
}

export interface PlantingSchedule {
  id: string;
  cropName: string;
  category: string;
  plantingDate: Date;
  harvestDate: Date;
  area: number; // ไร่
  estimatedYield?: number; // ผลผลิตโดยประมาณ (กก.)
  status: "planned" | "planted" | "harvested";
  notes: string;
}

export interface PriceHistory {
  date: string;
  [key: string]: number | string; // crop name as key, price as value
}

export interface CropRecommendation {
  cropName: string;
  category: string;
  currentSeason: string;
  priceLevel: "low" | "medium" | "high";
  averagePrice: number;
  reason: string;
}

export interface ActivityLog {
  id: string;
  action: "add" | "update" | "delete";
  type: "product" | "schedule";
  itemName: string;
  user: string;
  timestamp: Date;
  // JSON string containing extra metadata used for rollback
  // e.g. { itemId, previous?, new? }
  details: string;
}


interface DataContextType {
  products: Product[];
  addProduct: (product: Omit<Product, "id" | "lastUpdated">) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  schedules: PlantingSchedule[];
  addSchedule: (schedule: Omit<PlantingSchedule, "id">) => Promise<void>;
  updateSchedule: (schedule: PlantingSchedule) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  priceHistory: PriceHistory[];
  userRole: "owner" | "employee";
  setUserRole: (role: "owner" | "employee") => void;
  activityLogs: ActivityLog[];
  rollbackActivity: (log: ActivityLog) => Promise<void>;
  isLoading: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { currentWorkspace, isGlobalAdmin, getUserRole, getUserPermissions } = useWorkspace();
  const [products, setProducts] = useState<Product[]>([]);
  const [schedules, setSchedules] = useState<PlantingSchedule[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [userRole, setUserRole] = useState<"owner" | "employee">("owner");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const role = getUserRole();
    if (role) {
      setUserRole(role);
    }
  }, [currentWorkspace?.id, getUserRole]);

  const ensureCanAdd = () => {
    const permissions = getUserPermissions();
    if (!permissions.canView) {
      const error = new Error("คุณไม่มีสิทธิ์เข้าถึงข้อมูลใน Workspace นี้");
      toast.error(error.message);
      throw error;
    }
    if (!permissions.canAdd) {
      const error = new Error("คุณไม่มีสิทธิ์เพิ่มข้อมูล");
      toast.error(error.message);
      throw error;
    }
  };

  const ensureCanEdit = () => {
    const permissions = getUserPermissions();
    if (!permissions.canView) {
      const error = new Error("คุณไม่มีสิทธิ์เข้าถึงข้อมูลใน Workspace นี้");
      toast.error(error.message);
      throw error;
    }
    if (!permissions.canEdit) {
      const error = new Error("คุณไม่มีสิทธิ์แก้ไขหรือลบข้อมูล");
      toast.error(error.message);
      throw error;
    }
  };

  // utility to normalize backend rows to client models
  const normalizeProduct = (row: any) => ({
    id: row.id,
    name: row.name ?? row.product_name ?? row.productName ?? '',
    category: row.category,
    quantity: row.quantity,
    unit: row.unit,
    price: Number(row.price ?? 0),
    imageUrl: row.image_url ?? row.imageUrl ?? undefined,
    sellerId: row.seller_id ?? row.sellerId ?? row.sellerid ?? "legacy",
    sellerName: row.seller_name ?? row.sellerName ?? row.sellername ?? "ไม่ระบุผู้ขาย",
    minStock: row.minstock ?? row.minStock ?? 0,
    harvestDate: row.harvestdate ? new Date(row.harvestdate) : row.harvestDate ? new Date(row.harvestDate) : undefined,
    lastUpdated: row.lastupdated ? new Date(row.lastupdated) : row.lastUpdated ? new Date(row.lastUpdated) : new Date()
  });

  const canModifyProduct = (product: Product) => {
    if (isGlobalAdmin) {
      return true;
    }

    if (getUserRole() === "owner") {
      return true;
    }

    return Boolean(user?.id) && product.sellerId === user.id;
  };

  const normalizeSchedule = (row: any) => ({
    id: row.id,
    cropName: row.cropname ?? row.cropName,
    category: row.category,
    plantingDate: new Date(row.plantingdate || row.plantingDate),
    harvestDate: new Date(row.harvestdate || row.harvestDate),
    area: row.area,
    estimatedYield: row.estimatedyield ?? row.estimatedYield,
    status: row.status,
    notes: row.notes
  });

  const normalizeActivityLog = (row: any) => ({
    ...row,
    itemName: row.itemName ?? row.itemname ?? '',
    timestamp: new Date(row.timestamp)
  });

  // helper to load all data; used on mount and after rollbacks
  const loadData = async () => {
    if (!currentWorkspace?.id) {
      setProducts([]);
      setSchedules([]);
      setPriceHistory([]);
      setActivityLogs([]);
      setIsLoading(false);
      return;
    }

    const permissions = getUserPermissions();
    if (!permissions.canView) {
      setProducts([]);
      setSchedules([]);
      setPriceHistory([]);
      setActivityLogs([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const workspaceQuery = `workspace_id=${encodeURIComponent(currentWorkspace.id)}`;
      const [productsRes, schedulesRes, priceHistoryRes, activityLogsRes] = await Promise.all([
        fetch(`${API_BASE}/api/products?${workspaceQuery}`),
        fetch(`${API_BASE}/api/schedules?${workspaceQuery}`),
        fetch(`${API_BASE}/api/price-history?${workspaceQuery}`),
        fetch(`${API_BASE}/api/activity-logs?${workspaceQuery}`)
      ]);

      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(data.map((p: any) => normalizeProduct(p)));
      }

      if (schedulesRes.ok) {
        const data = await schedulesRes.json();
        setSchedules(data.map((s: any) => normalizeSchedule(s)));
      }

      if (priceHistoryRes.ok) {
        setPriceHistory(await priceHistoryRes.json());
      }

      if (activityLogsRes.ok) {
        const data = await activityLogsRes.json();
        setActivityLogs(data.map((log: any) => normalizeActivityLog(log)));
      }
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch initial data on mount
  useEffect(() => {
    loadData();
  }, [currentWorkspace]);

  const addActivityLog = async (log: Omit<ActivityLog, "id">) => {
    try {
      if (!currentWorkspace?.id) return;
      // ensure timestamp is ISO string
      const timestamp = log.timestamp instanceof Date ? log.timestamp.toISOString() : new Date().toISOString();
      const res = await fetch(`${API_BASE}/api/activity-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...log, timestamp, workspaceId: currentWorkspace.id })
      });
      if (res.ok) {
        const newLog = await res.json();
        setActivityLogs(prev => [normalizeActivityLog(newLog), ...prev].slice(0, 50));
      }
    } catch (e) {
      console.error("Failed to add activity log", e);
    }
  };

  const rollbackActivity = async (log: ActivityLog) => {
    try {
      if (!currentWorkspace?.id) return;
      ensureCanEdit();
      const workspaceQuery = `workspace_id=${encodeURIComponent(currentWorkspace.id)}`;
      const res = await fetch(`${API_BASE}/api/activity-logs/${log.id}/rollback?${workspaceQuery}`, {
        method: 'POST'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Rollback failed');
      }
      toast.success('ย้อนกลับการกระทำสำเร็จ');
      // reload everything to keep state in sync
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'ย้อนกลับไม่สำเร็จ');
      console.error('Rollback error:', err);
    }
  };

  const addProduct = async (product: Omit<Product, "id" | "lastUpdated">) => {
    try {
      if (!currentWorkspace?.id) {
        throw new Error("กรุณาเลือกพื้นที่ทำงานก่อน");
      }
      if (!user?.id || !user.name) {
        throw new Error("ไม่พบข้อมูลผู้ใช้งาน");
      }
      ensureCanAdd();

      const existingProduct = products.find(
        (p) =>
          p.sellerId === user.id &&
          p.name.trim().toLowerCase() === product.name.trim().toLowerCase() &&
          p.category.trim().toLowerCase() === product.category.trim().toLowerCase() &&
          p.unit.trim().toLowerCase() === product.unit.trim().toLowerCase()
      );

      if (existingProduct) {
        const mergedProduct: Product = {
          ...existingProduct,
          quantity: existingProduct.quantity + product.quantity,
          price: product.price,
          imageUrl: product.imageUrl || existingProduct.imageUrl,
          sellerId: user.id,
          sellerName: user.name,
          minStock: product.minStock,
          harvestDate: product.harvestDate || existingProduct.harvestDate,
          lastUpdated: new Date(),
        };

        const payload = {
          ...mergedProduct,
          workspaceId: currentWorkspace.id,
          lastUpdated: new Date().toISOString(),
        };
        const workspaceQuery = `workspace_id=${encodeURIComponent(currentWorkspace.id)}`;
        const updateRes = await fetch(`${API_BASE}/api/products/${existingProduct.id}?${workspaceQuery}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!updateRes.ok) {
          throw new Error("Failed to merge existing product");
        }

        const data = await updateRes.json();
        const normalized = normalizeProduct(data);
        setProducts((prev) => prev.map((p) => (p.id === existingProduct.id ? normalized : p)));

        toast.success("รวมสินค้าเดิมสำเร็จ", {
          description: `รวม ${product.name} เข้ารายการเดิมแล้ว`,
        });

        await addActivityLog({
          action: "update",
          type: "product",
          itemName: existingProduct.name,
          user: user.name,
          timestamp: new Date(),
          details: JSON.stringify({
            itemId: existingProduct.id,
            previous: existingProduct,
            new: normalized,
            merged: true,
          }),
        });

        return;
      }

      const payload = {
        workspaceId: currentWorkspace.id,
        name: product.name,
        category: product.category,
        quantity: product.quantity,
        unit: product.unit,
        price: product.price,
        imageUrl: product.imageUrl || "",
        sellerId: user.id,
        sellerName: user.name,
        minStock: product.minStock,
        harvestDate: product.harvestDate || '',
        lastUpdated: new Date().toISOString()
      };
      
      const res = await fetch(`${API_BASE}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add product");
      }

      const newProduct = await res.json();
      const normalized = normalizeProduct(newProduct);
      setProducts(prev => [...prev, normalized]);

      const productName = normalized.name || product.name || "สินค้าใหม่";

      toast.success("เพิ่มสินค้าสำเร็จ", { description: `เพิ่ม ${productName} เข้าสู่ระบบแล้ว` });

      // record structured details for potential rollback
      await addActivityLog({
        action: "add",
        type: "product",
        itemName: productName,
        user: user.name,
        timestamp: new Date(),
        details: JSON.stringify({
          itemId: normalized.id,
          new: normalized
        }),
      });
    } catch (error: any) {
      const errorMessage = error?.message || "เกิดข้อผิดพลาดในการเพิ่มสินค้า";
      toast.error(errorMessage);
      console.error("Add product error:", error);
      throw error;
    }
  };

  const updateProduct = async (updatedProduct: Product) => {
    try {
      if (!currentWorkspace?.id) {
        throw new Error("กรุณาเลือกพื้นที่ทำงานก่อน");
      }
      ensureCanEdit();
      const oldProduct = products.find(p => p.id === updatedProduct.id);
      if (!oldProduct) {
        throw new Error("ไม่พบสินค้า");
      }
      if (!canModifyProduct(oldProduct)) {
        throw new Error("คุณแก้ไขได้เฉพาะสินค้าของตัวเอง");
      }
      const payload = { ...updatedProduct, workspaceId: currentWorkspace.id, lastUpdated: new Date().toISOString() };
      const workspaceQuery = `workspace_id=${encodeURIComponent(currentWorkspace.id)}`;
      const res = await fetch(`${API_BASE}/api/products/${updatedProduct.id}?${workspaceQuery}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to update product");

      const data = await res.json();
      const normalized = normalizeProduct(data);
      setProducts(prev => prev.map(p => p.id === updatedProduct.id ? normalized : p));

      toast.success("อัพเดทสินค้าสำเร็จ", { description: `อัพเดท ${updatedProduct.name} แล้ว` });

      await addActivityLog({
        action: "update",
        type: "product",
        itemName: updatedProduct.name,
        user: user?.name || "system",
        timestamp: new Date(),
        details: JSON.stringify({
          itemId: updatedProduct.id,
          previous: oldProduct,
          new: normalized
        }),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการอัพเดทสินค้า");
      console.error(error);
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      if (!currentWorkspace?.id) {
        throw new Error("กรุณาเลือกพื้นที่ทำงานก่อน");
      }
      ensureCanEdit();
      const product = products.find(p => p.id === id);
      if (!product) {
        throw new Error("ไม่พบสินค้า");
      }
      if (!canModifyProduct(product)) {
        throw new Error("คุณลบได้เฉพาะสินค้าของตัวเอง");
      }
      const workspaceQuery = `workspace_id=${encodeURIComponent(currentWorkspace.id)}`;
      const res = await fetch(`${API_BASE}/api/products/${id}?${workspaceQuery}`, { method: 'DELETE' });

      if (!res.ok) throw new Error("Failed to delete product");

      setProducts(prev => prev.filter(p => p.id !== id));

      toast.success("ลบสินค้าสำเร็จ", { description: `ลบ ${product?.name} ออกจากระบบแล้ว` });

      if (product) {
        await addActivityLog({
          action: "delete",
          type: "product",
          itemName: product.name,
          user: user?.name || "system",
          timestamp: new Date(),
          details: JSON.stringify({
            itemId: product.id,
            previous: product
          }),
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการลบสินค้า");
      console.error(error);
    }
  };

  const addSchedule = async (schedule: Omit<PlantingSchedule, "id">) => {
    try {
      if (!currentWorkspace?.id) {
        throw new Error("กรุณาเลือกพื้นที่ทำงานก่อน");
      }
      ensureCanAdd();
      const res = await fetch(`${API_BASE}/api/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...schedule, workspaceId: currentWorkspace.id }),
      });

      if (!res.ok) throw new Error("Failed to add schedule");

      const newSchedule = await res.json();
      const normalized = normalizeSchedule(newSchedule);
      setSchedules(prev => [...prev, normalized]);

      toast.success("เพิ่มตารางการปลูกสำเร็จ", { description: `เพิ่ม ${schedule.cropName} เข้าสู่ระบบแล้ว` });

      await addActivityLog({
        action: "add",
        type: "schedule",
        itemName: schedule.cropName,
        user: user?.name || "system",
        timestamp: new Date(),
        details: JSON.stringify({
          itemId: normalized.id,
          new: normalized
        }),
      });
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเพิ่มตารางปลูก");
      console.error(error);
    }
  };

  const updateSchedule = async (updatedSchedule: PlantingSchedule) => {
    try {
      if (!currentWorkspace?.id) {
        throw new Error("กรุณาเลือกพื้นที่ทำงานก่อน");
      }
      ensureCanEdit();
      const oldSchedule = schedules.find(s => s.id === updatedSchedule.id);
      const workspaceQuery = `workspace_id=${encodeURIComponent(currentWorkspace.id)}`;
      const res = await fetch(`${API_BASE}/api/schedules/${updatedSchedule.id}?${workspaceQuery}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updatedSchedule, workspaceId: currentWorkspace.id }),
      });

      if (!res.ok) throw new Error("Failed to update schedule");

      const data = await res.json();
      const normalized = normalizeSchedule(data);
      setSchedules(prev => prev.map(s => s.id === updatedSchedule.id ? normalized : s));

      toast.success("อัพเดทตารางการปลูกสำเร็จ", { description: `อัพเดท ${updatedSchedule.cropName} แล้ว` });

      await addActivityLog({
        action: "update",
        type: "schedule",
        itemName: updatedSchedule.cropName,
        user: user?.name || "system",
        timestamp: new Date(),
        details: JSON.stringify({
          itemId: updatedSchedule.id,
          previous: oldSchedule,
          new: normalized
        }),
      });
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการอัพเดทตารางปลูก");
      console.error(error);
    }
  };

  const deleteSchedule = async (id: string) => {
    try {
      if (!currentWorkspace?.id) {
        throw new Error("กรุณาเลือกพื้นที่ทำงานก่อน");
      }
      ensureCanEdit();
      const schedule = schedules.find(s => s.id === id);
      const workspaceQuery = `workspace_id=${encodeURIComponent(currentWorkspace.id)}`;
      const res = await fetch(`${API_BASE}/api/schedules/${id}?${workspaceQuery}`, { method: 'DELETE' });

      if (!res.ok) throw new Error("Failed to delete schedule");

      setSchedules(prev => prev.filter(s => s.id !== id));

      toast.success("ลบตารางการปลูกสำเร็จ", { description: `ลบ ${schedule?.cropName} ออกจากระบบแล้ว` });

      if (schedule) {
        await addActivityLog({
          action: "delete",
          type: "schedule",
          itemName: schedule.cropName,
          user: user?.name || "system",
          timestamp: new Date(),
          details: JSON.stringify({
            itemId: schedule.id,
            previous: schedule
          }),
        });
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการลบตารางปลูก");
      console.error(error);
    }
  };

  return (
    <DataContext.Provider
      value={{
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        schedules,
        addSchedule,
        updateSchedule,
        deleteSchedule,
        priceHistory,
        userRole,
        setUserRole,
        activityLogs,
        rollbackActivity,
        isLoading
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}