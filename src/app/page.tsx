"use client";

import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import Formulario, { type DatosFormulario, type EstadoProductos } from "@/components/Formulario";
import Login from "@/components/Login";
import { SesionProvider, useSesion } from "@/lib/sesion";
import Resultado from "@/components/Resultado";
import SelectorTipoCotizacion from "@/components/SelectorTipoCotizacion";
import { CRITERIOS, type CodigoTipoCotizacion, type Producto, type TipoCotizacion } from "@/config/matriz";
import { cargarProductos, cargarTiposCotizacion } from "@/lib/catalogo";
import { calcular, SELECCION_VACIA, validar, type Resultado as R, type Solicitud } from "@/lib/calculos";

const INICIAL: DatosFormulario = {
  cliente: "",
  identificacion: "",
  telefono: "",
  correo: "",
  seleccion: SELECCION_VACIA,
  plazo: "",
  producto: "",
  promotor: "",
  ingresoBruto: "",
  ingresoNeto: "",
  saldoActual: "",
  montoCliente: "",
  importesApc: [],
};

/** Por debajo de este ancho el resultado queda debajo del formulario. */
const APILADO = "(max-width: 1199.98px)";

const aSolicitud = (d: DatosFormulario, productos: Producto[]): Solicitud => ({
  cliente: d.cliente.trim(),
  identificacion: d.identificacion.trim(),
  telefono: d.telefono.trim(),
  correo: d.correo.trim(),
  seleccion: d.seleccion,
  plazo: d.plazo ? Number(d.plazo) : null,
  producto: productos.find((p) => p.id === d.producto) ?? null,
  promotorIndependiente: d.promotor || null,
  ingresoBruto: Number(d.ingresoBruto),
  ingresoNeto: Number(d.ingresoNeto),
  saldoActual: Number(d.saldoActual || 0),
  montoCliente: Number(d.montoCliente),
  importesApc: d.importesApc.map((f) => ({ detalle: f.detalle || null, monto: Number(f.monto) })),
});

const mensajeError = (e: unknown) =>
  e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e);

const desplazamiento = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

/** Sin sesión muestra el login; con sesión, la aplicación. Al cerrar sesión se desmonta y su estado se pierde. */
export default function Home() {
  return (
    <SesionProvider>
      <ProtegerRuta />
    </SesionProvider>
  );
}

function ProtegerRuta() {
  const { cargando, sesion } = useSesion();
  if (cargando) {
    return (
      <div className="ic-login ic-login--cargando" role="status" aria-live="polite">
        <span className="ic-spinner" aria-hidden="true" />
        <span className="ic-sr-only">Cargando…</span>
      </div>
    );
  }
  return sesion ? <Evaluacion /> : <Login />;
}

function Evaluacion() {
  const [datos, setDatos] = useState<DatosFormulario>(INICIAL);
  const [intentado, setIntentado] = useState(false);
  const [resultado, setResultado] = useState<R | null>(null);
  const asideRef = useRef<HTMLDivElement>(null);

  // Tipo de cotización: se elige en una pantalla previa a la evaluación.
  const [tipo, setTipo] = useState<CodigoTipoCotizacion | null>(null);
  const [eligiendo, setEligiendo] = useState(false); // volvió a la pantalla previa para cambiarlo
  const tituloRef = useRef<HTMLHeadingElement>(null);

  // Tipos de cotización (tabla tipo_cotizacion), cargados una vez al entrar.
  const [tipos, setTipos] = useState<TipoCotizacion[] | null>(null);
  const [errorTipos, setErrorTipos] = useState("");
  const [recargaTipos, setRecargaTipos] = useState(0);
  useEffect(() => {
    let vigente = true;
    setErrorTipos("");
    cargarTiposCotizacion()
      .then((t) => vigente && setTipos(t))
      .catch((e) => vigente && setErrorTipos(mensajeError(e)));
    return () => {
      vigente = false;
    };
  }, [recargaTipos]);
  const tipoActual = tipos?.find((t) => t.codigo === tipo);

  // Productos (tabla producto_credito) filtrados por el tipo elegido; se recargan al cambiar de tipo.
  const [productos, setProductos] = useState<EstadoProductos>({ estado: "cargando" });
  const [recargaProductos, setRecargaProductos] = useState(0);
  useEffect(() => {
    if (!tipo) return;
    let vigente = true;
    setProductos({ estado: "cargando" });
    cargarProductos(tipo)
      .then((p) => vigente && setProductos({ estado: "listo", productos: p }))
      .catch((e) => vigente && setProductos({ estado: "error", mensaje: mensajeError(e) }));
    return () => {
      vigente = false;
    };
  }, [tipo, recargaProductos]);
  const listaProductos = productos.estado === "listo" ? productos.productos : [];

  // Tras el primer intento, la validación se recalcula en cada cambio (en línea).
  const errores = intentado ? validar(aSolicitud(datos, listaProductos)) : [];

  // + plazo, producto, promotor, ingreso bruto, ingreso neto y monto cliente (el saldo actual es opcional)
  const totalCampos = CRITERIOS.length + 6;
  const completados =
    CRITERIOS.filter((c) => datos.seleccion[c.clave]).length +
    [datos.plazo, datos.producto, datos.promotor].filter(Boolean).length +
    [datos.ingresoBruto, datos.ingresoNeto, datos.montoCliente].filter((v) => Number(v) > 0).length;

  const cambiar = (d: DatosFormulario) => {
    setDatos(d);
    setResultado(null); // evita descargar un informe con datos desactualizados
  };

  const onCalcular = () => {
    const solicitud = aSolicitud(datos, listaProductos);
    const errs = validar(solicitud);
    setIntentado(true);
    if (errs.length) {
      setResultado(null);
      requestAnimationFrame(() => {
        const primero = document.querySelector<HTMLElement>('[aria-invalid="true"]');
        primero?.focus({ preventScroll: true });
        primero?.scrollIntoView({ behavior: desplazamiento(), block: "center" });
      });
      return;
    }
    setResultado(calcular(solicitud));
    requestAnimationFrame(() => {
      if (window.matchMedia(APILADO).matches) asideRef.current?.scrollIntoView({ behavior: desplazamiento(), block: "start" });
    });
  };

  const limpiar = () => {
    setDatos(INICIAL);
    setIntentado(false);
    setResultado(null);
  };

  /** Al cambiar de pantalla: vuelve arriba y lleva el foco al título nuevo. */
  const alCambiarPantalla = () =>
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0 });
      tituloRef.current?.focus({ preventScroll: true });
    });

  const elegirTipo = (codigo: CodigoTipoCotizacion) => {
    if (codigo !== tipo) limpiar(); // otro tipo es otra cotización: empieza en blanco
    setTipo(codigo);
    setEligiendo(false);
    alCambiarPantalla();
  };

  const cambiarTipo = () => {
    setEligiendo(true);
    alCambiarPantalla();
  };

  const volverAEvaluacion = () => {
    setEligiendo(false);
    alCambiarPantalla();
  };

  const progreso = Math.round((completados / totalCampos) * 100);

  if (!tipoActual || eligiendo) {
    return (
      <AppShell>
        <section className="ic-section ic-appear" id="tipo-cotizacion">
          <div className="ic-section__head">
            <h1 ref={tituloRef} tabIndex={-1} className="ic-section-title">Tipo de Cotización</h1>
          </div>
          <p className="ic-lead">Elige el tipo de cotización que vas a realizar.</p>
          <SelectorTipoCotizacion
            tipos={tipos}
            error={errorTipos}
            onReintentar={() => setRecargaTipos((n) => n + 1)}
            actual={tipo}
            onElegir={elegirTipo}
            onCancelar={volverAEvaluacion}
          />
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="ic-section ic-appear" id="evaluacion">
        <div className="ic-section__head">
          <h1 ref={tituloRef} tabIndex={-1} className="ic-section-title">Evaluación de Solicitud</h1>
        </div>
        <p className="ic-lead">Completa los criterios, calcula el resultado y descarga el informe en PDF.</p>

        <div className="ic-context">
          <span>Tipo de cotización</span>
          <span className="ic-badge ic-badge--info">{tipoActual.codigo}</span>
          {tipoActual.descripcion !== tipoActual.codigo && (
            <span className="ic-context__value">{tipoActual.descripcion}</span>
          )}
          <button type="button" className="ic-btn ic-btn--ghost ic-btn--sm" onClick={cambiarTipo}>
            Cambiar
          </button>
        </div>

        <div className="ic-split">
          <div className="ic-card ic-card--elevated">
            <Formulario
              datos={datos}
              productos={productos}
              onReintentarProductos={() => setRecargaProductos((n) => n + 1)}
              onChange={cambiar} onCalcular={onCalcular} onLimpiar={limpiar} errores={errores} />
          </div>
          <div ref={asideRef} className="ic-card ic-card--elevated ic-split__aside">
            <h2 className="ic-subtitle">Resultado</h2>
            {resultado ? (
              <Resultado key={resultado.fecha.getTime()} r={resultado} />
            ) : (
              <div className="ic-empty">
                <span className="ic-empty__icon">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
                  </svg>
                </span>
                <p className="ic-empty__title">
                  {completados === totalCampos ? "Todo listo" : "Sin resultado todavía"}
                </p>
                <p>
                  {completados === totalCampos ? (
                    <>Pulsa <strong>Calcular</strong> para ver la evaluación.</>
                  ) : (
                    <>Completa el formulario y pulsa <strong>Calcular</strong>.</>
                  )}
                </p>
                <div
                  className="ic-empty__progress"
                  role="progressbar"
                  aria-label="Campos completados"
                  aria-valuemin={0}
                  aria-valuemax={totalCampos}
                  aria-valuenow={completados}
                >
                  <div className="ic-meter__track ic-meter__track--thin">
                    <div className="ic-meter__bar ic-meter__bar--success" style={{ width: `${progreso}%` }} />
                  </div>
                  <span className="ic-note">{completados} de {totalCampos} campos obligatorios</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
