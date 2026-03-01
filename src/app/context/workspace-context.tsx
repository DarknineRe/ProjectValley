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
  joinedAt: Date;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  createWorkspace: (name: string) => Promise<void>;
  joinWorkspace: (code: string) => Promise<boolean>;
  deleteWorkspace: (workspaceId: string) => Promise<boolean>;
  inviteToWorkspace: (workspaceId: string, email: string) => void;
  getUserRole: () => "owner" | "employee" | null;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);

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
      setCurrentWorkspace(null);
      return;
    }

    let isCancelled = false;

    const load = async () => {
      try {
        const fetchedWorkspaces = await fetchWorkspaces(user.id);
        if (isCancelled) return;

        setWorkspaces(fetchedWorkspaces);

        const storedWorkspaceId = localStorage.getItem(getCurrentWorkspaceKey(user.id));
        const matched = storedWorkspaceId
          ? fetchedWorkspaces.find((ws) => ws.id === storedWorkspaceId)
          : null;

        if (matched) {
          setCurrentWorkspace(matched);
        } else {
          setCurrentWorkspace(fetchedWorkspaces[0] || null);
        }
      } catch (e) {
        console.error("Failed to load workspaces", e);
        if (!isCancelled) {
          setWorkspaces([]);
          setCurrentWorkspace(null);
        }
      }
    };

    load();

    return () => {
      isCancelled = true;
    };
  }, [user?.id]);

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
    setCurrentWorkspace(created);
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
    setCurrentWorkspace(
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
      setCurrentWorkspace(nextWorkspaces[0] || null);
    }

    return true;
  };

  const inviteToWorkspace = (workspaceId: string, email: string) => {
    // Mock invite - in real app, this would send an email
    console.log(`Invited ${email} to workspace ${workspaceId}`);
  };

  const getUserRole = (): "owner" | "employee" | null => {
    if (!user || !currentWorkspace) return null;
    const member = currentWorkspace.members.find((m) => m.id === user.id);
    return member?.role || null;
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        setCurrentWorkspace,
        createWorkspace,
        joinWorkspace,
        deleteWorkspace,
        inviteToWorkspace,
        getUserRole,
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
