import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const signupSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre muy corto").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});
const loginSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(1, "Ingresa tu contraseña").max(72),
});

export default function Auth() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav("/", { replace: true });
    });
  }, [nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const v = signupSchema.safeParse({ nombre, email, password });
        if (!v.success) { toast.error(v.error.issues[0].message); return; }
        const { error } = await supabase.auth.signUp({
          email: v.data.email,
          password: v.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { nombre_completo: v.data.nombre },
          },
        });
        if (error) throw error;
        toast.success("Cuenta creada. Iniciando sesión…");
        nav("/", { replace: true });
      } else {
        const v = loginSchema.safeParse({ email, password });
        if (!v.success) { toast.error(v.error.issues[0].message); return; }
        const { error } = await supabase.auth.signInWithPassword(v.data);
        if (error) throw error;
        nav("/", { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Error de autenticación");
    } finally {
      setLoading(false);
    }
  };

  const inp = "w-full border-2 border-lapis bg-background px-4 py-3 font-mono text-sm text-lapis focus:outline-none focus:bg-accent-orange/5";

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-12">
      <nav className="max-w-7xl mx-auto border-b-2 border-lapis pb-6 mb-12">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Flores el trigal</span>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter uppercase text-lapis">Aplicativo de ensayos</h1>
      </nav>
      <main className="max-w-md mx-auto">
        <div className="border-2 border-lapis bg-white">
          <div className="flex border-b-2 border-lapis">
            <button onClick={() => setMode("login")}
              className={`flex-1 font-mono text-xs uppercase tracking-widest px-6 py-4 transition-colors ${mode === "login" ? "bg-lapis text-background" : "text-lapis hover:bg-accent-orange/10"}`}>
              Iniciar sesión
            </button>
            <button onClick={() => setMode("signup")}
              className={`flex-1 font-mono text-xs uppercase tracking-widest px-6 py-4 transition-colors ${mode === "signup" ? "bg-lapis text-background" : "text-lapis hover:bg-accent-orange/10"}`}>
              Registrarse
            </button>
          </div>
          <form onSubmit={submit} className="p-8 space-y-4">
            {mode === "signup" && (
              <label className="block">
                <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground block mb-1">Nombre completo</span>
                <input className={inp} value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={100} />
              </label>
            )}
            <label className="block">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground block mb-1">Email</span>
              <input type="email" className={inp} value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
            </label>
            <label className="block">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground block mb-1">Contraseña</span>
              <input type="password" className={inp} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={72} />
            </label>
            <button type="submit" disabled={loading}
              className="w-full bg-lapis text-background font-mono text-xs uppercase tracking-widest px-6 py-3 hover:bg-accent-orange disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              {loading ? "…" : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}