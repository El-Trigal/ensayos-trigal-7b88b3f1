import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

type Tab = { label: string; path: string; icon: ReactNode; adminOnly?: boolean; jefeOnly?: boolean };

const HomeIcon = () => (
  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);
const ListIcon = () => (
  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);
const UsersIcon = () => (
  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const TABS: Tab[] = [
  { label: "Inicio", path: "/", icon: <HomeIcon /> },
  { label: "Ensayos", path: "/ensayos", icon: <ListIcon />, jefeOnly: true },
  { label: "Usuarios", path: "/admin/usuarios", icon: <UsersIcon />, adminOnly: true },
];

export default function Layout({ children, title }: { children: ReactNode; title?: string }) {
  const nav = useNavigate();
  const loc = useLocation();
  const { profile, signOut, canManageUsers, isJefe } = useAuth();

  const visibleTabs = TABS.filter((t) => {
    if (t.adminOnly) return canManageUsers;
    if (t.jefeOnly) return canManageUsers || isJefe;
    return true;
  });
  const hasTabs = visibleTabs.length > 1;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-lapis text-white shadow-md">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[10px] font-medium tracking-widest uppercase text-white/60 leading-none">
                Flores el Trigal
              </p>
              <p className="text-sm font-semibold leading-tight">
                {title ?? "Ensayos"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {profile && (
              <div className="text-right hidden sm:block">
                <p className="text-xs font-medium leading-tight">{profile.nombre_completo}</p>
                <p className="text-[10px] text-white/60 leading-tight capitalize">{profile.rol}</p>
              </div>
            )}
            <button
              onClick={signOut}
              className="text-white/70 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
              title="Cerrar sesión"
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Sede banner */}
      {profile?.sede_nombre && (
        <div className="bg-lapis/8 border-b border-border px-4 py-1.5 text-center">
          <p className="text-xs text-muted-foreground font-medium">
            Sede: <span className="text-foreground font-semibold">{profile.sede_nombre}</span>
          </p>
        </div>
      )}
      {!profile?.sede_id && profile?.rol !== "superadmin" && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-center">
          <p className="text-xs text-yellow-800 font-medium">
            Tu cuenta aún no tiene sede asignada. Contacta a un administrador.
          </p>
        </div>
      )}

      {/* Content */}
      <main className={`flex-1 max-w-2xl w-full mx-auto px-4 py-4 ${hasTabs ? "pb-24" : "pb-6"}`}>
        {children}
      </main>

      {/* Bottom nav — solo si hay más de una tab visible */}
      {hasTabs && (
        <nav className="fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border pb-safe">
          <div className="max-w-2xl mx-auto flex">
            {visibleTabs.map((tab) => {
              const active = loc.pathname === tab.path;
              return (
                <button
                  key={tab.path}
                  onClick={() => nav(tab.path)}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-3 transition-colors ${
                    active ? "text-lapis" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className={active ? "opacity-100" : "opacity-60"}>{tab.icon}</span>
                  <span className="text-[10px] font-semibold tracking-wide">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
