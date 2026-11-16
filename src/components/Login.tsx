"use client";

import { useState } from "react";
import type { AuthError } from "@supabase/supabase-js";
import icono from "@/assets/icono.svg";
import { supabase } from "@/lib/supabase";

/** Traduce los errores de Supabase Auth a mensajes para el usuario. */
function mensajeError(e: AuthError): string {
  if (e.code === "invalid_credentials") return "Correo o contraseña incorrectos.";
  if (e.code === "email_not_confirmed") return "El correo todavía no está confirmado.";
  if (e.code === "user_banned") return "Este usuario está bloqueado. Contacta al administrador.";
  if (e.status === 429 || e.code === "over_request_rate_limit") return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
  if (e.name === "AuthRetryableFetchError" || !e.status) return "No se pudo conectar. Revisa tu conexión a internet.";
  return "No se pudo iniciar sesión. Inténtalo de nuevo.";
}

/** Pantalla de inicio de sesión (correo y contraseña). Las cuentas las crea el administrador. */
export default function Login() {
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !clave) {
      setError("Escribe tu correo y tu contraseña.");
      return;
    }
    setEnviando(true);
    setError(null);
    const { error: err } = await supabase().auth.signInWithPassword({ email: email.trim(), password: clave });
    setEnviando(false);
    if (err) {
      setError(mensajeError(err));
      setClave("");
    }
    // Si entra, SesionProvider recibe SIGNED_IN y muestra la aplicación.
  };

  return (
    <main className="ic-login">
      <div className="ic-deco" aria-hidden="true">
        <span className="ic-deco__blob ic-deco__blob--1" />
        <span className="ic-deco__blob ic-deco__blob--2" />
      </div>

      <form className="ic-card ic-card--elevated ic-login__card ic-appear" onSubmit={entrar} noValidate>
        <div className="ic-login__brand">
          <img src={icono.src} alt="" width={48} height={48} />
          <div>
            <p className="ic-login__marca">Instacredit</p>
            <p className="ic-login__app">Matriz Automatizada</p>
          </div>
        </div>

        <h1 className="ic-section-title ic-login__title">Iniciar sesión</h1>
        <p className="ic-lead ic-login__lead">Usa la cuenta que te dio el administrador.</p>

        <div className={`ic-field ic-field--full${error ? " ic-field--error" : ""}`}>
          <input
            id="login-email"
            className="ic-input"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder=" "
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            required
          />
          <label className="ic-field__label" htmlFor="login-email">Correo electrónico</label>
        </div>

        <div className={`ic-field ic-field--full ic-login__clave${error ? " ic-field--error" : ""}`}>
          <input
            id="login-clave"
            className="ic-input"
            type={verClave ? "text" : "password"}
            autoComplete="current-password"
            placeholder=" "
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            aria-invalid={error ? true : undefined}
            required
          />
          <label className="ic-field__label" htmlFor="login-clave">Contraseña</label>
          <button
            type="button"
            className="ic-icon-btn ic-login__ver"
            onClick={() => setVerClave((v) => !v)}
            aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={verClave}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              {verClave ? (
                <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
              ) : (
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
              )}
            </svg>
          </button>
        </div>

        {error && (
          <div role="alert" className="ic-alert ic-alert--danger ic-appear">
            {error}
          </div>
        )}

        <button type="submit" className="ic-btn ic-btn--primary ic-login__submit" disabled={enviando} aria-busy={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
