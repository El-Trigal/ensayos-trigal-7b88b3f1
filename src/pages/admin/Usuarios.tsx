import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import type { Rol } from "@/hooks/useAuth";

type Sede = { id: string; nombre: string };
type Usuario = {
  id: string;
  user_id: string;
  nombre_completo: string;
  email: string;
  rol: Rol;
  sede_id: string | null;
  sede_nombre: string | null;
};

const ROL_LABELS: Record<Rol, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  jefe: "Jefe",
  aprendiz: "Aprendiz",
};

const ROL_COLORS: Record<Rol, string> = {
  superadmin: "bg-purple-100 text-purple-700",
  admin: "bg-lapis/10 text-lapis",
  jefe: "bg-blue-100 text-blue-700",
  aprendiz: "bg-green-100 text-green-700",
};

export default function Usuarios() {
  const { isSuperAdmin } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Crear usuario
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rolNuevo, setRolNuevo] = useState<Rol>("aprendiz");
  const [sedeNueva, setSedeNueva] = useState("");
  const [saving, setSaving] = useState(false);

  // Editar usuario
  const [editId, setEditId] = useState<string | null>(null);
  const [editRol, setEditRol] = useState<Rol>("aprendiz");
  const [editSede, setEditSede] = useState<string>("");
  const [editSaving, setEditSaving] = useState(false);

  const load = async () => {
    setLoadingList(true);
    const [{ data: perfiles }, { data: sedesData }] = await Promise.all([
      supabase.from("profiles").select("id, user_id, nombre_completo, email, rol, sede_id, sedes(nombre)").order("nombre_completo"),
      supabase.from("sedes").select("id, nombre").eq("activa", true).order("nombre"),
    ]);
    setSedes((sedesData ?? []) as Sede[]);
    setUsuarios(
      ((perfiles ?? []) as any[]).map((p) => ({
        id: p.id,
        user_id: p.user_id,
        nombre_completo: p.nombre_completo,
        email: p.email,
        rol: p.rol as Rol,
        sede_id: p.sede_id ?? null,
        sede_nombre: p.sedes?.nombre ?? null,
      }))
    );
    setLoadingList(false);
  };

  useEffect(() => { load(); }, []);

  const crearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim() || password.length < 6) {
      toast.error("Completa todos los campos. Contraseña mínimo 6 caracteres.");
      return;
    }
    setSaving(true);
    try {
      // Crear usuario en Supabase Auth (solo funciona si la API key tiene permiso)
      // Como no tenemos service role en el frontend, usamos signUp y actualizamos el perfil
      const { error: authErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { nombre_completo: nombre.trim() } },
      });
      if (authErr) throw authErr;

      // Esperar a que el trigger cree el perfil
      await new Promise((r) => setTimeout(r, 1500));

      // Actualizar rol y sede
      const { error: updErr } = await supabase
        .from("profiles")
        .update({
          rol: rolNuevo,
          sede_id: sedeNueva || null,
          nombre_completo: nombre.trim(),
        })
        .eq("email", email.trim());
      if (updErr) throw updErr;

      toast.success(`Usuario ${email} creado`);
      setShowForm(false);
      setNombre(""); setEmail(""); setPassword(""); setRolNuevo("aprendiz"); setSedeNueva("");
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Error al crear usuario");
    } finally {
      setSaving(false);
    }
  };

  const guardarEdicion = async (userId: string) => {
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ rol: editRol, sede_id: editSede || null })
        .eq("user_id", userId);
      if (error) throw error;
      toast.success("Usuario actualizado");
      setEditId(null);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Error al actualizar");
    } finally {
      setEditSaving(false);
    }
  };

  const rolesDisponibles: Rol[] = isSuperAdmin
    ? ["superadmin", "admin", "jefe", "aprendiz"]
    : ["jefe", "aprendiz"];

  const inp = "w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lapis/40";

  return (
    <Layout title="Usuarios">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Gestión de usuarios</h2>
            <p className="text-xs text-muted-foreground">{usuarios.length} usuarios registrados</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-lapis text-white text-sm font-semibold px-4 py-2.5 rounded-xl active:scale-95 transition-all flex items-center gap-2"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo
          </button>
        </div>

        {/* Formulario crear usuario */}
        {showForm && (
          <form onSubmit={crearUsuario} className="bg-card rounded-2xl border border-border p-5 space-y-3 shadow-sm">
            <h3 className="font-semibold text-sm text-foreground">Nuevo usuario</h3>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Nombre completo</label>
              <input className={inp} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre completo" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Email</label>
              <input type="email" className={inp} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@empresa.com" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Contraseña temporal</label>
              <input type="password" className={inp} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Rol</label>
                <select className={inp} value={rolNuevo} onChange={(e) => setRolNuevo(e.target.value as Rol)}>
                  {rolesDisponibles.map((r) => (
                    <option key={r} value={r}>{ROL_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Sede</label>
                <select className={inp} value={sedeNueva} onChange={(e) => setSedeNueva(e.target.value)}>
                  <option value="">Sin sede</option>
                  {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="flex-1 bg-lapis text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 active:scale-95 transition-all">
                {saving ? "Creando…" : "Crear usuario"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 bg-secondary text-foreground rounded-xl py-2.5 text-sm font-semibold active:scale-95 transition-all">
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Lista de usuarios */}
        {loadingList ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-lapis border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {usuarios.map((u) => (
              <div key={u.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
                {editId === u.user_id ? (
                  <div className="space-y-3">
                    <p className="font-semibold text-sm">{u.nombre_completo}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Rol</label>
                        <select className={inp} value={editRol} onChange={(e) => setEditRol(e.target.value as Rol)}>
                          {rolesDisponibles.map((r) => (
                            <option key={r} value={r}>{ROL_LABELS[r]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Sede</label>
                        <select className={inp} value={editSede} onChange={(e) => setEditSede(e.target.value)}>
                          <option value="">Sin sede</option>
                          {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => guardarEdicion(u.user_id)} disabled={editSaving}
                        className="flex-1 bg-lapis text-white rounded-xl py-2 text-xs font-semibold disabled:opacity-50 active:scale-95 transition-all">
                        {editSaving ? "Guardando…" : "Guardar"}
                      </button>
                      <button onClick={() => setEditId(null)}
                        className="flex-1 bg-secondary text-foreground rounded-xl py-2 text-xs font-semibold active:scale-95 transition-all">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{u.nombre_completo}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${ROL_COLORS[u.rol]}`}>
                          {ROL_LABELS[u.rol]}
                        </span>
                        {u.sede_nombre && (
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {u.sede_nombre}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => { setEditId(u.user_id); setEditRol(u.rol); setEditSede(u.sede_id ?? ""); }}
                      className="shrink-0 text-muted-foreground hover:text-lapis p-2 rounded-xl hover:bg-secondary transition-colors"
                      title="Editar"
                    >
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
