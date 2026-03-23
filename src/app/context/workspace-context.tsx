import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useAuth } from "./auth-context";
import { API_BASE } from "../../api";

export interface Workspace {
  id: string;
  name: string;
  code: string;
  ownerId: string;
  createdAt: Date;
  members: WorkspaceMember[];
}

export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "employee";
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canManagePermissions: boolean;
  viewDashboard: boolean;
  viewInventory: boolean;
  viewSummary: boolean;
  viewCalendar: boolean;
  viewAnalysis: boolean;
  viewPriceComparison: boolean;
  viewRecommendations: boolean;
  viewMembers: boolean;
  viewActivity: boolean;
  joinedAt: Date;
}

export interface WorkspacePermissions {
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canManagePermissions: boolean;
  viewDashboard: boolean;
  viewInventory: boolean;
  viewSummary: boolean;
  viewCalendar: boolean;
  viewAnalysis: boolean;
  viewPriceComparison: boolean;
  viewRecommendations: boolean;
  viewMembers: boolean;
  viewActivity: boolean;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  isLoading: boolean;
  isGlobalAdmin: boolean;
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  createWorkspace: (name: string) => Promise<void>;
  updateWorkspaceName: (workspaceId: string, name: string) => Promise<boolean>;
  joinWorkspace: (code: string) => Promise<boolean>;
  deleteWorkspace: (workspaceId: string) => Promise<boolean>;
  inviteToWorkspace: (
    workspaceId: string,
    payload: { creatorUserId: string; name: string; email: string; password: string }
  ) => Promise<boolean>;
  getUserRole: () => "owner" | "employee" | null;
  getUserPermissions: () => WorkspacePermissions;
  updateMemberPermissions: (
    workspaceId: string,
    memberId: string,
    permissions: WorkspacePermissions
  ) => Promise<boolean>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const SYSTEM_ADMIN_EMAILS = new Set([
  "farmer@example.com",
  "srisommai@example.com",
  "admin@example.com",
]);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isGlobalAdmin =
    user?.role === "admin" ||
    SYSTEM_ADMIN_EMAILS.has(String(user?.email || "").toLowerCase());
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null);

  const getCurrentWorkspaceKey = (userId: string) => `currentWorkspace:${userId}`;

  const normalizeWorkspace = (ws: any): Workspace => ({
    id: ws.id,
    name: ws.name,
    code: ws.code,
    ownerId: ws.ownerId ?? ws.owner_id,
    createdAt: new Date(ws.createdAt ?? ws.created_at),
    members: (ws.members || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      canView: m.role === "owner" ? true : Boolean(m.canView ?? m.can_view ?? true),
      canAdd: m.role === "owner" ? true : Boolean(m.canAdd ?? m.can_add ?? false),
      canEdit: m.role === "owner" ? true : Boolean(m.canEdit ?? m.can_edit ?? false),
      canManagePermissions:
        m.role === "owner"
          ? true
          : Boolean(
              m.canManagePermissions ?? m.can_manage_permissions ?? false
            ),
      viewDashboard:
        m.role === "owner"
          ? true
          : Boolean(m.viewDashboard ?? m.view_dashboard ?? true),
      viewInventory:
        m.role === "owner"
          ? true
          : Boolean(m.viewInventory ?? m.view_inventory ?? true),
      viewSummary:
        m.role === "owner"
          ? true
          : Boolean(m.viewSummary ?? m.view_summary ?? true),
      viewCalendar:
        m.role === "owner"
          ? true
          : Boolean(m.viewCalendar ?? m.view_calendar ?? true),
      viewAnalysis:
        m.role === "owner"
          ? true
          : Boolean(m.viewAnalysis ?? m.view_analysis ?? true),
      viewPriceComparison:
        m.role === "owner"
          ? true
          : Boolean(
              m.viewPriceComparison ?? m.view_price_comparison ?? true
            ),
      viewRecommendations:
        m.role === "owner"
          ? true
          : Boolean(
              m.viewRecommendations ?? m.view_recommendations ?? true
            ),
      viewMembers:
        m.role === "owner"
          ? true
          : Boolean(m.viewMembers ?? m.view_members ?? true),
      viewActivity:
        m.role === "owner"
          ? true
          : Boolean(m.viewActivity ?? m.view_activity ?? true),
      joinedAt: new Date(m.joinedAt ?? m.joined_at),
    })),
  });

  const fetchWorkspaces = async (userId: string) => {
    const res = await fetch(`${API_BASE}/api/workspaces?user_id=${encodeURIComponent(userId)}`);
    if (!res.ok) {
      throw new Error("Failed to fetch workspaces");
    }
    const data = await res.json();
    return data.map((ws: any) => normalizeWorkspace(ws));
  };

  useEffect(() => {
    if (!user?.id) {
      setWorkspaces([]);
      setCurrentWorkspaceState(null);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        const fetchedWorkspaces = await fetchWorkspaces(user.id);
        if (isCancelled) return;

        setWorkspaces(fetchedWorkspaces);

        const storedWorkspaceId = localStorage.getItem(getCurrentWorkspaceKey(user.id));
        const isAdmin = isGlobalAdmin;
        const matched = storedWorkspaceId
          ? fetchedWorkspaces.find((ws) => ws.id === storedWorkspaceId)
          : null;

        if (!isAdmin && fetchedWorkspaces.length > 0) {
          // Non-admin users are pinned to their assigned workspace.
          setCurrentWorkspaceState(fetchedWorkspaces[0]);
        } else if (matched) {
          setCurrentWorkspaceState(matched);
        } else {
          setCurrentWorkspaceState(fetchedWorkspaces[0] || null);
        }
      } catch (e) {
        console.error("Failed to load workspaces", e);
        if (!isCancelled) {
          setWorkspaces([]);
          setCurrentWorkspaceState(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      isCancelled = true;
    };
  }, [user?.id, isGlobalAdmin]);

  const setCurrentWorkspace = (workspace: Workspace | null) => {
    if (!user?.id) {
      setCurrentWorkspaceState(null);
      return;
    }

    const isAdmin = isGlobalAdmin;
    if (isAdmin) {
      setCurrentWorkspaceState(workspace);
      return;
    }

    if (!workspace) {
      setCurrentWorkspaceState(null);
      return;
    }

    // Non-admin users can only keep the first assigned workspace.
    const allowedWorkspace = workspaces[0] || null;
    if (allowedWorkspace && workspace.id === allowedWorkspace.id) {
      setCurrentWorkspaceState(workspace);
      return;
    }

    setCurrentWorkspaceState(allowedWorkspace);
  };

  useEffect(() => {
    if (!user?.id) return;
    if (currentWorkspace?.id) {
      localStorage.setItem(getCurrentWorkspaceKey(user.id), currentWorkspace.id);
    } else {
      localStorage.removeItem(getCurrentWorkspaceKey(user.id));
    }
  }, [currentWorkspace, user?.id]);

  const createWorkspace = async (name: string) => {
    if (!user) return;

    const res = await fetch(`${API_BASE}/api/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ownerId: user.id }),
    });

    if (!res.ok) {
      throw new Error("Failed to create workspace");
    }

    const created = normalizeWorkspace(await res.json());
    const nextWorkspaces = [created, ...workspaces];
    setWorkspaces(nextWorkspaces);
    setCurrentWorkspaceState(created);
  };

  const updateWorkspaceName = async (workspaceId: string, name: string): Promise<boolean> => {
    if (!user?.id) return false;

    const res = await fetch(
      `${API_BASE}/api/workspaces/${encodeURIComponent(workspaceId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, name }),
      }
    );

    if (!res.ok) {
      return false;
    }

    const refreshed = await fetchWorkspaces(user.id);
    setWorkspaces(refreshed);
    if (currentWorkspace?.id) {
      const updatedCurrent =
        refreshed.find((ws) => ws.id === currentWorkspace.id) ||
        refreshed[0] ||
        null;
      setCurrentWorkspaceState(updatedCurrent);
    }

    return true;
  };

  const joinWorkspace = async (code: string): Promise<boolean> => {
    if (!user) return false;

    const res = await fetch(`${API_BASE}/api/workspaces/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.toUpperCase(), userId: user.id }),
    });

    if (!res.ok) {
      return false;
    }

    const joinedWorkspace = normalizeWorkspace(await res.json());
    const refreshed = await fetchWorkspaces(user.id);
    setWorkspaces(refreshed);
    setCurrentWorkspaceState(
      refreshed.find((ws) => ws.id === joinedWorkspace.id) || joinedWorkspace
    );
    return true;
  };

  const deleteWorkspace = async (workspaceId: string): Promise<boolean> => {
    if (!user?.id) return false;

    const res = await fetch(
      `${API_BASE}/api/workspaces/${encodeURIComponent(workspaceId)}?user_id=${encodeURIComponent(user.id)}`,
      { method: "DELETE" }
    );

    if (!res.ok) {
      return false;
    }

    const nextWorkspaces = workspaces.filter((ws) => ws.id !== workspaceId);
    setWorkspaces(nextWorkspaces);
    if (currentWorkspace?.id === workspaceId) {
      setCurrentWorkspaceState(nextWorkspaces[0] || null);
    }

    return true;
  };

  const inviteToWorkspace = async (
    workspaceId: string,
    payload: { creatorUserId: string; name: string; email: string; password: string }
  ): Promise<boolean> => {
    const res = await fetch(
      `${API_BASE}/api/workspaces/${encodeURIComponent(workspaceId)}/guest-accounts`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      return false;
    }

    if (user?.id) {
      const refreshed = await fetchWorkspaces(user.id);
      setWorkspaces(refreshed);
      if (currentWorkspace?.id) {
        const updatedCurrent =
          refreshed.find((ws) => ws.id === currentWorkspace.id) ||
          refreshed[0] ||
          null;
        setCurrentWorkspaceState(updatedCurrent);
      }
    }

    return true;
  };

  const getUserRole = (): "owner" | "employee" | null => {
    if (!user || !currentWorkspace) return null;
    const member = currentWorkspace.members.find((m) => m.id === user.id);
    return member?.role || null;
  };

  const getUserPermissions = (): WorkspacePermissions => {
    if (!user || !currentWorkspace) {
      return {
        canView: false,
        canAdd: false,
        canEdit: false,
        canManagePermissions: false,
        viewDashboard: false,
        viewInventory: false,
        viewSummary: false,
        viewCalendar: false,
        viewAnalysis: false,
        viewPriceComparison: false,
        viewRecommendations: false,
        viewMembers: false,
        viewActivity: false,
      };
    }

    if (isGlobalAdmin) {
      return {
        canView: true,
        canAdd: true,
        canEdit: true,
        canManagePermissions: true,
        viewDashboard: true,
        viewInventory: true,
        viewSummary: true,
        viewCalendar: true,
        viewAnalysis: true,
        viewPriceComparison: true,
        viewRecommendations: true,
        viewMembers: true,
        viewActivity: true,
      };
    }

    const member = currentWorkspace.members.find((m) => m.id === user.id);
    if (!member) {
      return {
        canView: false,
        canAdd: false,
        canEdit: false,
        canManagePermissions: false,
        viewDashboard: false,
        viewInventory: false,
        viewSummary: false,
        viewCalendar: false,
        viewAnalysis: false,
        viewPriceComparison: false,
        viewRecommendations: false,
        viewMembers: false,
        viewActivity: false,
      };
    }

    if (member.role === "owner") {
      return {
        canView: true,
        canAdd: true,
        canEdit: true,
        canManagePermissions: true,
        viewDashboard: true,
        viewInventory: true,
        viewSummary: true,
        viewCalendar: true,
        viewAnalysis: true,
        viewPriceComparison: true,
        viewRecommendations: true,
        viewMembers: true,
        viewActivity: true,
      };
    }

    return {
      canView: member.canView,
      canAdd: member.canAdd,
      canEdit: member.canEdit,
      canManagePermissions: member.canManagePermissions,
      viewDashboard: member.viewDashboard,
      viewInventory: member.viewInventory,
      viewSummary: member.viewSummary,
      viewCalendar: member.viewCalendar,
      viewAnalysis: member.viewAnalysis,
      viewPriceComparison: member.viewPriceComparison,
      viewRecommendations: member.viewRecommendations,
      viewMembers: member.viewMembers,
      viewActivity: member.viewActivity,
    };
  };

  const updateMemberPermissions = async (
    workspaceId: string,
    memberId: string,
    permissions: WorkspacePermissions
  ): Promise<boolean> => {
    if (!user?.id) return false;

    const res = await fetch(
      `${API_BASE}/api/workspaces/${encodeURIComponent(
        workspaceId
      )}/members/${encodeURIComponent(memberId)}/permissions`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterUserId: user.id,
          ...permissions,
        }),
      }
    );

    if (!res.ok) {
      return false;
    }

    const nextWorkspaces = workspaces.map((ws) => {
      if (ws.id !== workspaceId) return ws;
      return {
        ...ws,
        members: ws.members.map((member) => {
          if (member.id !== memberId) return member;
          if (member.role === "owner") return member;
          return {
            ...member,
            canView: permissions.canView,
            canAdd: permissions.canAdd,
            canEdit: permissions.canEdit,
            canManagePermissions: permissions.canManagePermissions,
            viewDashboard: permissions.viewDashboard,
            viewInventory: permissions.viewInventory,
            viewSummary: permissions.viewSummary,
            viewCalendar: permissions.viewCalendar,
            viewAnalysis: permissions.viewAnalysis,
            viewPriceComparison: permissions.viewPriceComparison,
            viewRecommendations: permissions.viewRecommendations,
            viewMembers: permissions.viewMembers,
            viewActivity: permissions.viewActivity,
          };
        }),
      };
    });

    setWorkspaces(nextWorkspaces);
    if (currentWorkspace?.id === workspaceId) {
      const updatedCurrent = nextWorkspaces.find((ws) => ws.id === workspaceId) || null;
      setCurrentWorkspaceState(updatedCurrent);
    }

    return true;
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        isLoading,
        isGlobalAdmin,
        currentWorkspace,
        setCurrentWorkspace,
        createWorkspace,
        updateWorkspaceName,
        joinWorkspace,
        deleteWorkspace,
        inviteToWorkspace,
        getUserRole,
        getUserPermissions,
        updateMemberPermissions,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}
