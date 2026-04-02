import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import api from "@/lib/api";
import { socket } from "@/lib/socket";

export interface User {
  id: string;
  email: string;
}

export interface Profile {
  id: string;
  user_id: string;
  username: string;
  email: string | null;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  status: string | null;
  city: string | null;
  country: string | null;
  language: string | null;
  interests: string | null;
  gender: string | null;
  favorite_movies: string | null;
  favorite_games: string | null;
  birth_date: string | null;
  telegram_id: string | null;
  is_verified: boolean;
  created_at: string;
  profile_visibility?: "PUBLIC" | "FRIENDS_ONLY" | "PRIVATE";
  allow_friend_requests?: boolean;

  // Music
  pinned_track_id?: string | null;
  pinned_track?: {
    id: string;
    title: string;
    artist: string | null;
    file_url: string;
    cover_url: string | null;
    visibility?: "PUBLIC" | "PRIVATE";
  } | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await api.get(`/profiles/${userId}`);
      if (data) setProfile(data as Profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        fetchProfile(parsedUser.id);
        socket.connect();
        socket.emit("join", parsedUser.id);
      } catch (e) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
    setIsLoading(false);
  }, [fetchProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    setProfile(data.user.profile);
    socket.connect();
    socket.emit("join", data.user.id);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const { data: result } = await api.post("/auth/register", data);
    localStorage.setItem("token", result.token);
    localStorage.setItem("user", JSON.stringify(result.user));
    setUser(result.user);
    setProfile(result.user.profile);
    socket.connect();
    socket.emit("join", result.user.id);
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setProfile(null);
    socket.disconnect();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

