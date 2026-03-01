import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "sonner";
import { API_BASE } from "../../api";

export interface Product {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
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
  const [products, setProducts] = useState<Product[]>([]);
  const [schedules, setSchedules] = useState<PlantingSchedule[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [userRole, setUserRole] = useState<"owner" | "employee">("owner");
  const [isLoading, setIsLoading] = useState(true);

  // utility to normalize backend rows to client models
  const normalizeProduct = (row: any) => ({
    id: row.id,
    name: row.name ?? row.product_name ?? row.productName ?? '',
    category: row.category,
    quantity: row.quantity,
    unit: row.unit,
    minStock: row.minstock ?? row.minStock ?? 0,
    harvestDate: row.harvestdate ? new Date(row.harvestdate) : row.harvestDate ? new Date(row.harvestDate) : undefined,
    lastUpdated: row.lastupdated ? new Date(row.lastupdated) : row.lastUpdated ? new Date(row.lastUpdated) : new Date()
  });

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

  // helper to load all data; used on mount and after rollbacks
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [productsRes, schedulesRes, priceHistoryRes, activityLogsRes] = await Promise.all([
        fetch(`${API_BASE}/api/products`),
        fetch(`${API_BASE}/api/schedules`),
        fetch(`${API_BASE}/api/price-history`),
        fetch(`${API_BASE}/api/activity-logs`)
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
        setActivityLogs(data.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        })));
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
  }, []);

  const addActivityLog = async (log: Omit<ActivityLog, "id">) => {
    try {
      // ensure timestamp is ISO string
      const timestamp = log.timestamp instanceof Date ? log.timestamp.toISOString() : new Date().toISOString();
      const res = await fetch(`${API_BASE}/api/activity-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...log, timestamp })
      });
      if (res.ok) {
        const newLog = await res.json();
        setActivityLogs(prev => [{ ...newLog, timestamp: new Date(newLog.timestamp) }, ...prev].slice(0, 50));
      }
    } catch (e) {
      console.error("Failed to add activity log", e);
    }
  };

  const rollbackActivity = async (log: ActivityLog) => {
    try {
      const res = await fetch(`${API_BASE}/api/activity-logs/${log.id}/rollback`, {
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
      const payload = {
        name: product.name,
        category: product.category,
        quantity: product.quantity,
        unit: product.unit,
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
        user: "admin",
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
      const oldProduct = products.find(p => p.id === updatedProduct.id);
      const payload = { ...updatedProduct, lastUpdated: new Date().toISOString() };
      const res = await fetch(`${API_BASE}/api/products/${updatedProduct.id}`, {
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
        user: "admin",
        timestamp: new Date(),
        details: JSON.stringify({
          itemId: updatedProduct.id,
          previous: oldProduct,
          new: normalized
        }),
      });
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการอัพเดทสินค้า");
      console.error(error);
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const product = products.find(p => p.id === id);
      const res = await fetch(`${API_BASE}/api/products/${id}`, { method: 'DELETE' });

      if (!res.ok) throw new Error("Failed to delete product");

      setProducts(prev => prev.filter(p => p.id !== id));

      toast.success("ลบสินค้าสำเร็จ", { description: `ลบ ${product?.name} ออกจากระบบแล้ว` });

      if (product) {
        await addActivityLog({
          action: "delete",
          type: "product",
          itemName: product.name,
          user: "admin",
          timestamp: new Date(),
          details: JSON.stringify({
            itemId: product.id,
            previous: product
          }),
        });
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการลบสินค้า");
      console.error(error);
    }
  };

  const addSchedule = async (schedule: Omit<PlantingSchedule, "id">) => {
    try {
      const res = await fetch(`${API_BASE}/api/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule),
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
        user: "admin",
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
      const oldSchedule = schedules.find(s => s.id === updatedSchedule.id);
      const res = await fetch(`${API_BASE}/api/schedules/${updatedSchedule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSchedule),
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
        user: "admin",
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
      const schedule = schedules.find(s => s.id === id);
      const res = await fetch(`${API_BASE}/api/schedules/${id}`, { method: 'DELETE' });

      if (!res.ok) throw new Error("Failed to delete schedule");

      setSchedules(prev => prev.filter(s => s.id !== id));

      toast.success("ลบตารางการปลูกสำเร็จ", { description: `ลบ ${schedule?.cropName} ออกจากระบบแล้ว` });

      if (schedule) {
        await addActivityLog({
          action: "delete",
          type: "schedule",
          itemName: schedule.cropName,
          user: "admin",
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