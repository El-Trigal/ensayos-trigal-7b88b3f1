import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type Rol = "superadmin" | "admin" | "jefe" | "aprendiz";

export type Profile = {
  user_id: string;
  nombre_completo: string;
  email: string;
  rol: Rol;
  sede_id: string | null;
  sede_nombre: string | null;
};

type Ctx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isJefe: boolean;
  canManageUsers: boolean;
};

const AuthCtx = createContext<Ctx>({
  session: null, user: null, profile: null, loading: true,
  signOut: async () => {},
  isSuperAdmin: false, isAdmin: false, isJefe: false, canManageUsers: false,
});

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("user_id, nombre_completo, email, rol, sede_id, sedes(nombre)")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const d = data as any;
  return {
    user_id: d.user_id,
    nombre_completo: d.nombre_completo,
    email: d.email,
    rol: d.rol as Rol,
    sede_id: d.sede_id ?? null,
    sede_nombre: d.sedes?.nombre ?? null,
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        const p = await fetchProfile(data.session.user.id);
        setProfile(p);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(async () => {
          const p = await fetchProfile(s.user!.id);
          setProfile(p);
        }, 0);
      } else {
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  const rol = profile?.rol ?? "aprendiz";
  const isSuperAdmin = rol === "superadmin";
  const isAdmin = rol === "admin" || isSuperAdmin;
  const isJefe = rol === "jefe";
  const canManageUsers = isAdmin;

  return (
    <AuthCtx.Provider value={{
      session, user: session?.user ?? null, profile, loading,
      signOut, isSuperAdmin, isAdmin, isJefe, canManageUsers,
    }}>
      {children}
    </AuthCtx.Provider>
  );
};

export const useAuth = () => useContext(AuthCtx);
