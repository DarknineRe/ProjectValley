import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { API_BASE } from "../../api";

interface User {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  loginMethod?: "email" | "google";
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: (googleToken: string) => Promise<void>;
  updateProfile: (data: { name: string; photoUrl?: string }) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check if user is logged in from localStorage
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = async (email: string, password: string) => {
    console.log('login called, API_BASE=', API_BASE);
    try {
      const url = `${API_BASE}/api/auth/login`;
      console.log('fetching login URL:', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const text = await response.text();
      // try to parse; if parse fails, log the full body for debugging
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error('login response not JSON:', text);
        throw new Error('Unexpected non-JSON response from server');
      }
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // at this point `data` already contains the parsed body
      const mockUser: User = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        loginMethod: "email"
      };
      
      setUser(mockUser);
      localStorage.setItem("currentUser", JSON.stringify(mockUser));
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      if (!response.ok) {
        let errorMessage = 'Registration failed';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const mockUser: User = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        loginMethod: "email"
      };
      
      setUser(mockUser);
      localStorage.setItem("currentUser", JSON.stringify(mockUser));
    } catch (error: any) {
      const errorMessage = error?.message || 'Registration failed';
      console.error("Register error:", error);
      throw new Error(errorMessage);
    }
  };

  const loginWithGoogle = async (googleToken: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: googleToken })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Google login failed');
      }

      const data = await response.json();
      const googleUser: User = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        loginMethod: "google"
      };
      
      setUser(googleUser);
      localStorage.setItem("currentUser", JSON.stringify(googleUser));
    } catch (error: any) {
      throw new Error(error.message || 'Google login failed');
    }
  };

  const updateProfile = async (data: { name: string; photoUrl?: string }) => {
    if (user) {
      const updatedUser: User = {
        ...user,
        name: data.name,
        photoUrl: data.photoUrl,
      };
      setUser(updatedUser);
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("currentUser");
    localStorage.removeItem("currentWorkspace");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        loginWithGoogle,
        updateProfile,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}