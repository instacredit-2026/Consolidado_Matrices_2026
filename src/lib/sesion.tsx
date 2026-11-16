"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type Rol = "admin" | "usuario";

export type UsuarioApp = {
  id: string;
  email: string;
  nombre: string | null;
  rol: Rol;
};

type EstadoSesion = {
  cargando: boolean;
  sesion: Session | null;
  usuario: UsuarioApp | null;
  esAdmin: boolean;
  salir: () => Promise<void>;
};

const Contexto = createContext<EstadoSesion | null>(null);

/** Fila de public.usuario del usuario autenticado (RLS solo deja ver la propia). */
async function cargarUsuario(s: Session): Promise<UsuarioApp> {
  const { data } = await supabase()
    .from("usuario")
    .select("id, email, nombre, rol")
    .eq("id", s.user.id)
    .maybeSingle();
  return data ?? { id: s.user.id, email: s.user.email ?? "", nombre: null, rol: "usuario" };
}

export function SesionProvider({ children }: { children: React.ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [sesion, setSesion] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<UsuarioApp | null>(null);

  useEffect(() => {
    let vigente = true;
    const sb = supabase();

    const aplicar = async (s: Session | null) => {
      const u = s ? await cargarUsuario(s) : null;
      if (!vigente) return;
      setSesion(s);
      setUsuario(u);
      setCargando(false);
    };

    sb.auth.getSession().then(({ data }) => aplicar(data.session));

    // No se hacen llamadas a Supabase dentro del callback (puede bloquear el cliente):
    // se difieren con setTimeout, como recomienda la documentación.
    const { data } = sb.auth.onAuthStateChange((evento, s) => {
      if (evento === "INITIAL_SESSION") return;
      if (evento === "TOKEN_REFRESHED") {
        setSesion(s);
        return;
      }
      setTimeout(() => aplicar(s), 0);
    });

    return () => {
      vigente = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const salir = async () => {
    await supabase().auth.signOut();
  };

  return (
    <Contexto.Provider value={{ cargando, sesion, usuario, esAdmin: usuario?.rol === "admin", salir }}>
      {children}
    </Contexto.Provider>
  );
}

export function useSesion(): EstadoSesion {
  const c = useContext(Contexto);
  if (!c) throw new Error("useSesion() debe usarse dentro de <SesionProvider>");
  return c;
}
