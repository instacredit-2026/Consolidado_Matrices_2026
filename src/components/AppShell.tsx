"use client";

import { useEffect, useRef, useState } from "react";
import icono from "@/assets/icono.svg";
import { useSesion } from "@/lib/sesion";

const MOVIL = "(max-width: 991.98px)";
const SIN_MOVIMIENTO = "(prefers-reduced-motion: reduce)";

/** Movimiento mínimo (px) antes de decidir que el gesto es un arrastre horizontal. */
const HISTERESIS = 10;

/** Resistencia progresiva al arrastrar más allá del borde (rubber-banding). */
function elastico(exceso: number, dimension: number, constante = 0.55) {
  return (exceso * dimension * constante) / (dimension + constante * Math.abs(exceso));
}

/** Distancia que recorrería el gesto por inercia (misma fórmula que el scroll de iOS). */
function proyectar(velocidad: number, desaceleracion = 0.998) {
  return ((velocidad / 1000) * desaceleracion) / (1 - desaceleracion);
}

type Arrastre = {
  id: number;
  x0: number;
  y0: number;
  base: number; // posición en pantalla al agarrar (permite interrumpir una animación)
  x: number;
  activo: boolean;
  historial: { x: number; t: number }[];
};

/** Estructura fija de la pantalla: header verde, menú lateral, contenido y footer. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [colapsado, setColapsado] = useState(false); // escritorio
  const [abierto, setAbierto] = useState(false); // móvil (off-canvas)
  const [esMovil, setEsMovil] = useState(false);

  const { usuario, esAdmin, salir } = useSesion();
  const [saliendo, setSaliendo] = useState(false);
  const cerrarSesion = async () => {
    setSaliendo(true);
    try {
      await salir(); // SesionProvider vuelve al login y la evaluación se desmonta
    } finally {
      setSaliendo(false);
    }
  };

  const sidebarRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const arrastre = useRef<Arrastre | null>(null);
  const recienArrastrado = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia(MOVIL);
    const sync = () => {
      setEsMovil(mq.matches);
      setAbierto(false);
    };
    sync();
    mq.addEventListener("change", sync);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("keydown", onKey);
    // Safari iOS solo aplica :active si existe algún listener de touchstart.
    const noop = () => {};
    document.addEventListener("touchstart", noop, { passive: true });
    return () => {
      mq.removeEventListener("change", sync);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("touchstart", noop);
    };
  }, []);

  const alternarMenu = () => (esMovil ? setAbierto((v) => !v) : setColapsado((v) => !v));
  const expandido = esMovil ? abierto : !colapsado;

  // ---- Arrastrar el menú para cerrarlo (móvil) ---------------------------
  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!esMovil || !abierto || (e.pointerType === "mouse" && e.button !== 0)) return;
    const t = getComputedStyle(e.currentTarget).transform;
    const base = t && t !== "none" ? new DOMMatrixReadOnly(t).m41 : 0;
    arrastre.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      base,
      x: base,
      activo: false,
      historial: [{ x: e.clientX, t: e.timeStamp }],
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const a = arrastre.current;
    const el = sidebarRef.current;
    if (!a || a.id !== e.pointerId || !el) return;

    if (!a.activo) {
      const dx = e.clientX - a.x0;
      const dy = e.clientY - a.y0;
      if (Math.hypot(dx, dy) < HISTERESIS) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        arrastre.current = null; // es scroll vertical del menú
        return;
      }
      a.activo = true;
      a.x0 = e.clientX; // sigue 1:1 desde aquí, sin salto por la histéresis
      el.setPointerCapture(e.pointerId);
      el.style.transition = "none";
      if (overlayRef.current) overlayRef.current.style.transition = "none";
    }

    a.historial.push({ x: e.clientX, t: e.timeStamp });
    a.historial = a.historial.filter((p) => e.timeStamp - p.t < 100);

    const ancho = el.offsetWidth;
    const bruto = a.base + (e.clientX - a.x0);
    a.x = bruto > 0 ? elastico(bruto, ancho) : Math.max(bruto, -ancho);
    el.style.transform = `translateX(${a.x}px)`;
    if (overlayRef.current) overlayRef.current.style.opacity = String(Math.min(1, Math.max(0, 1 + a.x / ancho)));
  };

  const terminarArrastre = (e: React.PointerEvent<HTMLElement>) => {
    const a = arrastre.current;
    const el = sidebarRef.current;
    arrastre.current = null;
    if (!a || a.id !== e.pointerId || !a.activo || !el) return;
    recienArrastrado.current = true;

    const h = a.historial;
    const dt = h.length > 1 ? h[h.length - 1].t - h[0].t : 0;
    const velocidad = dt > 0 ? ((h[h.length - 1].x - h[0].x) / dt) * 1000 : 0; // px/s

    const ancho = el.offsetWidth;
    const cerrar = e.type !== "pointercancel" && a.x + proyectar(velocidad) < -ancho / 2;
    const destino = cerrar ? -ancho : 0;

    // Traspaso de velocidad: la curva arranca con pendiente ~2.25, así que elegimos
    // la duración para que la animación continúe a la velocidad del dedo.
    const distancia = Math.abs(destino - a.x);
    const reducido = window.matchMedia(SIN_MOVIMIENTO).matches;
    const ms = reducido
      ? 0
      : Math.abs(velocidad) < 1
        ? 350
        : Math.min(450, Math.max(180, (2.25 * distancia * 1000) / Math.abs(velocidad)));

    el.style.transition = `transform ${ms}ms var(--ic-ease-spring)`;
    el.style.transform = "";
    if (overlayRef.current) {
      overlayRef.current.style.transition = `opacity ${ms}ms var(--ic-ease-spring)`;
      overlayRef.current.style.opacity = "";
    }
    const limpiar = () => {
      el.style.transition = "";
      if (overlayRef.current) overlayRef.current.style.transition = "";
    };
    el.addEventListener("transitionend", limpiar, { once: true });
    window.setTimeout(limpiar, ms + 50);

    if (cerrar) setAbierto(false);
  };

  // Evita que soltar el dedo tras un arrastre active un enlace del menú.
  const onClickCapture = (e: React.MouseEvent) => {
    if (recienArrastrado.current) {
      e.preventDefault();
      e.stopPropagation();
    }
    recienArrastrado.current = false;
  };

  const clases = ["ic-app", colapsado && "ic-app--collapsed", abierto && "ic-app--nav-open"].filter(Boolean).join(" ");

  return (
    <div className={clases}>
      <header className="ic-header">
        <a href="#evaluacion" className="ic-header__brand" aria-label="Inicio">
          <img src={icono.src} alt="" width={36} height={36} />
          <span>Instacredit</span>
        </a>
        <button
          className="ic-icon-btn"
          type="button"
          onClick={alternarMenu}
          aria-label="Mostrar u ocultar menú"
          aria-expanded={expandido}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" />
          </svg>
        </button>
        <div className="ic-header__spacer" />
        <span className="ic-header__app">Matriz Automatizada</span>
        {usuario && (
          <div className="ic-header__user">
            <span className="ic-header__email" title={usuario.email}>{usuario.nombre || usuario.email}</span>
            {esAdmin && <span className="ic-badge ic-header__badge">Admin</span>}
            <button
              type="button"
              className="ic-icon-btn"
              onClick={cerrarSesion}
              disabled={saliendo}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M10.09 15.59 11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
              </svg>
            </button>
          </div>
        )}
      </header>

      <aside
        ref={sidebarRef}
        className="ic-sidebar"
        aria-label="Navegación principal"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={terminarArrastre}
        onPointerCancel={terminarArrastre}
        onClickCapture={onClickCapture}
      >
        <nav>
          <ul className="ic-nav">
            <li>
              <a
                href="#evaluacion"
                className="ic-nav__item ic-nav__item--active"
                aria-current="page"
                onClick={() => setAbierto(false)}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                </svg>
                Evaluación de Solicitud
              </a>
            </li>
          </ul>
        </nav>
      </aside>
      <div ref={overlayRef} className="ic-overlay" onClick={() => setAbierto(false)} />

      <main className="ic-main">
        <div className="ic-deco" aria-hidden="true">
          <span className="ic-deco__blob ic-deco__blob--1" />
          <span className="ic-deco__blob ic-deco__blob--2" />
        </div>

        <div className="ic-container">{children}</div>

        <footer className="ic-footer">
          <span>Matriz Automatizada</span>
          <span>{new Date().getFullYear()} Instacredit</span>
          <span />
        </footer>
      </main>
    </div>
  );
}
