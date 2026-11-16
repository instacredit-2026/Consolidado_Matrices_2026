"use client";

import { useEffect, useRef } from "react";
import {
  CRITERIOS,
  DETALLE_APC,
  MONEDA,
  PROMOTOR_INDEPENDIENTE,
  type ClaveCriterio,
  type DetalleApc,
  type Producto,
  type PromotorIndependiente,
} from "@/config/matriz";
import { correoValido, formatoMoneda, importeFinalApc } from "@/lib/calculos";

/** Fila de Importes APC tal como se edita en el formulario. `id` solo sirve de key de React. */
export type FilaApc = { id: number; detalle: DetalleApc | ""; monto: string };

let siguienteIdApc = 1;
const nuevaFilaApc = (): FilaApc => ({ id: siguienteIdApc++, detalle: "", monto: "" });

export type DatosFormulario = {
  cliente: string;
  identificacion: string;
  telefono: string;
  correo: string;
  seleccion: Record<ClaveCriterio, string>;
  /** Plazo en meses, como texto (columna plazo de producto_credito). */
  plazo: string;
  /** id del producto elegido (producto_credito.id). */
  producto: string;
  promotor: PromotorIndependiente | "";
  ingresoBruto: string;
  ingresoNeto: string;
  /** Saldo que el cliente ya tiene en el sistema (opcional, 0 si no tiene). */
  saldoActual: string;
  /** Monto total del préstamo nuevo. */
  montoCliente: string;
  /** Deudas del cliente en la APC; se pueden agregar y eliminar filas. */
  importesApc: FilaApc[];
};

/** Productos del tipo de cotización elegido, cargados desde Supabase. */
export type EstadoProductos =
  | { estado: "cargando" }
  | { estado: "error"; mensaje: string }
  | { estado: "listo"; productos: Producto[] };

type Props = {
  datos: DatosFormulario;
  productos: EstadoProductos;
  onReintentarProductos: () => void;
  onChange: (datos: DatosFormulario) => void;
  onCalcular: () => void;
  onLimpiar: () => void;
  errores: string[];
};

type CampoProps = {
  id: string;
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  numerico?: boolean;
  /** Tipo de input para texto (teléfono, correo). Se ignora si `numerico`. */
  tipo?: "tel" | "email";
  /** Valor del atributo autocomplete del navegador. */
  autocompletar?: string;
  invalido?: boolean;
  placeholder?: string;
  /** Texto fijo dentro del campo, a la izquierda (p. ej. el símbolo de moneda). */
  prefijo?: string;
  /** Texto de ayuda bajo el campo. */
  ayuda?: string;
};

const positivo = (v: string) => Number(v) > 0;

/** Símbolo corto de la moneda configurada ("$" para USD). */
const SIMBOLO_MONEDA =
  new Intl.NumberFormat(MONEDA.locale, { style: "currency", currency: MONEDA.codigo, currencyDisplay: "narrowSymbol" })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value ?? MONEDA.codigo;

/** Ayuda bajo el campo, enlazada con aria-describedby. */
function Ayuda({ id, texto }: { id: string; texto?: string }) {
  return texto ? <span id={`${id}-ayuda`} className="ic-field__hint">{texto}</span> : null;
}

/** Input con borde y etiqueta encima. */
function Campo({ id, etiqueta, valor, onChange, numerico, tipo, autocompletar, invalido, placeholder, prefijo, ayuda }: CampoProps) {
  return (
    <div className={`ic-field ic-field--full ic-field--stack${invalido ? " ic-field--error" : ""}`}>
      <label className="ic-field__label" htmlFor={id}>{etiqueta}</label>
      <div className="ic-field__control">
        {prefijo && <span className="ic-field__prefix" aria-hidden="true">{prefijo}</span>}
        <input
          id={id}
          className="ic-input"
          placeholder={placeholder ?? (numerico ? "0.00" : undefined)}
          value={valor}
          aria-invalid={invalido || undefined}
          aria-describedby={ayuda ? `${id}-ayuda` : undefined}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autocompletar}
          {...(numerico ? { type: "number", inputMode: "decimal" as const, min: 0, step: "0.01" } : tipo ? { type: tipo } : {})}
        />
      </div>
      <Ayuda id={id} texto={ayuda} />
    </div>
  );
}

type SelectorProps = {
  id: string;
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  opciones: { valor: string; texto: string }[];
  invalido?: boolean;
  /** Texto de la opción vacía cuando no se puede elegir (cargando, error, sin opciones); deshabilita el menú. */
  estado?: string | null;
  ocupado?: boolean;
  ayuda?: string;
};

/** Menú desplegable con borde, etiqueta encima y chevrons arriba/abajo. */
function Selector({ id, etiqueta, valor, onChange, opciones, invalido, estado, ocupado, ayuda }: SelectorProps) {
  return (
    <div className={`ic-field ic-field--full ic-field--stack${invalido ? " ic-field--error" : ""}`}>
      <label className="ic-field__label" htmlFor={id}>{etiqueta}</label>
      <div className="ic-field__control ic-field__control--select">
        <select
          id={id}
          className="ic-select"
          required
          disabled={Boolean(estado)}
          aria-invalid={invalido || undefined}
          aria-busy={ocupado || undefined}
          aria-describedby={ayuda ? `${id}-ayuda` : undefined}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{estado || "Seleccionar…"}</option>
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor}>{o.texto}</option>
          ))}
        </select>
      </div>
      <Ayuda id={id} texto={ayuda} />
    </div>
  );
}

/** Encabezado de paso: el número se rellena cuando el grupo está completo. */
function Paso({ n, titulo, completo, extra }: { n: number; titulo: string; completo: boolean; extra?: React.ReactNode }) {
  return (
    <h2 className="ic-subtitle ic-subtitle--step">
      <span className={`ic-step${completo ? " ic-step--done" : ""}`} aria-hidden="true">
        {completo ? (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        ) : (
          n
        )}
      </span>
      {titulo}
      {extra}
    </h2>
  );
}

export default function Formulario({ datos, productos, onReintentarProductos, onChange, onCalcular, onLimpiar, errores }: Props) {
  const set = <K extends keyof DatosFormulario>(k: K, v: DatosFormulario[K]) => onChange({ ...datos, [k]: v });

  // Tras agregar o eliminar una fila APC, el foco va a la fila nueva o al botón "Agregar".
  const focoApc = useRef<string | null>(null);
  useEffect(() => {
    if (!focoApc.current) return;
    document.getElementById(focoApc.current)?.focus();
    focoApc.current = null;
  }, [datos.importesApc.length]);

  // Tras el primer intento de cálculo, los campos pendientes se marcan en línea.
  const marcar = errores.length > 0;
  const totalCriterios = CRITERIOS.length + 3; // + plazo, producto y promotor
  const elegidos =
    CRITERIOS.filter((c) => datos.seleccion[c.clave]).length +
    Number(Boolean(datos.plazo)) +
    Number(Boolean(datos.producto)) +
    Number(Boolean(datos.promotor));
  const criteriosCompletos = elegidos === totalCriterios;
  const correoInvalido = Boolean(datos.correo.trim()) && !correoValido(datos.correo);
  const clienteCompleto =
    [datos.cliente, datos.identificacion, datos.telefono, datos.correo].every((v) => v.trim()) && !correoInvalido;

  const netoMayorQueBruto = positivo(datos.ingresoBruto) && Number(datos.ingresoNeto) > Number(datos.ingresoBruto);
  const saldo = Number(datos.saldoActual || 0);
  const montoNoCubreSaldo = positivo(datos.montoCliente) && saldo > Number(datos.montoCliente);
  const aEntregar = Number(datos.montoCliente) - saldo;
  const montosCompletos =
    positivo(datos.ingresoBruto) &&
    positivo(datos.ingresoNeto) &&
    positivo(datos.montoCliente) &&
    !netoMayorQueBruto &&
    !montoNoCubreSaldo;

  // Plazos: valores distintos de la columna plazo de los productos del tipo elegido.
  const lista = productos.estado === "listo" ? productos.productos : [];
  const plazos = [...new Set(lista.map((p) => p.plazoMeses).filter((p): p is number => p !== null))].sort((a, b) => a - b);
  // Con un plazo elegido, solo se ofrecen los productos de ese plazo.
  const productosVisibles = datos.plazo ? lista.filter((p) => String(p.plazoMeses) === datos.plazo) : lista;
  const estadoLista =
    productos.estado === "cargando" ? "Cargando…" : productos.estado === "error" ? "No se pudieron cargar" : null;

  // Importes APC: filas dinámicas; importe final = monto × factor del detalle.
  const filasApc = datos.importesApc;
  const filaVacia = (f: FilaApc) => !f.detalle && !positivo(f.monto);
  const filaCompleta = (f: FilaApc) => Boolean(f.detalle) && positivo(f.monto);
  const totalApc = filasApc.reduce((acc, f) => acc + importeFinalApc(f.detalle, Number(f.monto)), 0);
  const apcCompleto = filasApc.length > 0 && filasApc.every((f) => filaVacia(f) || filaCompleta(f));
  const cambiarFila = (id: number, cambios: Partial<FilaApc>) =>
    set("importesApc", filasApc.map((f) => (f.id === id ? { ...f, ...cambios } : f)));
  const agregarFila = () => {
    const fila = nuevaFilaApc();
    focoApc.current = `apc-detalle-${fila.id}`;
    set("importesApc", [...filasApc, fila]);
  };
  const eliminarFila = (id: number) => {
    focoApc.current = "apc-agregar";
    set("importesApc", filasApc.filter((f) => f.id !== id));
  };

  const elegirPlazo = (plazo: string) => {
    const actual = lista.find((p) => p.id === datos.producto);
    const sigue = actual && (!plazo || String(actual.plazoMeses) === plazo);
    onChange({ ...datos, plazo, producto: sigue ? datos.producto : "" });
  };

  const elegirProducto = (id: string) => {
    const p = lista.find((x) => x.id === id);
    onChange({ ...datos, producto: id, plazo: p?.plazoMeses ? String(p.plazoMeses) : datos.plazo });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onCalcular();
      }}
      noValidate
    >
      <fieldset className="ic-form-group">
        <Paso n={1} titulo="Cliente" completo={clienteCompleto} extra={<span className="ic-subtitle__hint">Opcional</span>} />
        <div className="ic-form-grid">
          <Campo
            id="cliente"
            etiqueta="Nombre"
            placeholder="Nombre completo"
            valor={datos.cliente}
            onChange={(v) => set("cliente", v)}
          />
          <Campo
            id="identificacion"
            etiqueta="Identificación"
            placeholder="Cédula o pasaporte"
            valor={datos.identificacion}
            onChange={(v) => set("identificacion", v)}
          />
          <Campo
            id="telefono"
            etiqueta="Teléfono"
            tipo="tel"
            autocompletar="tel"
            placeholder="6000-0000"
            valor={datos.telefono}
            onChange={(v) => set("telefono", v)}
          />
          <Campo
            id="correo"
            etiqueta="Correo"
            tipo="email"
            autocompletar="email"
            placeholder="ejemplo@correo.com"
            valor={datos.correo}
            onChange={(v) => set("correo", v)}
            invalido={marcar && correoInvalido}
          />
        </div>
      </fieldset>

      <fieldset className="ic-form-group">
        <Paso n={2} titulo="Ingresos y monto" completo={montosCompletos} />
        <div className="ic-form-grid">
          <Campo
            id="ingresoBruto"
            etiqueta="Ingreso bruto"
            valor={datos.ingresoBruto}
            onChange={(v) => set("ingresoBruto", v)}
            numerico
            prefijo={SIMBOLO_MONEDA}
            ayuda={`Mensual, en ${MONEDA.codigo}`}
            invalido={marcar && !positivo(datos.ingresoBruto)}
          />
          <Campo
            id="ingresoNeto"
            etiqueta="Ingreso neto"
            valor={datos.ingresoNeto}
            onChange={(v) => set("ingresoNeto", v)}
            numerico
            prefijo={SIMBOLO_MONEDA}
            ayuda={netoMayorQueBruto ? "No puede ser mayor que el ingreso bruto" : "Se usa para la relación cuota / ingreso"}
            invalido={(marcar && !positivo(datos.ingresoNeto)) || netoMayorQueBruto}
          />
          <Campo
            id="saldoActual"
            etiqueta="Saldo actual"
            valor={datos.saldoActual}
            onChange={(v) => set("saldoActual", v)}
            numerico
            prefijo={SIMBOLO_MONEDA}
            ayuda="Lo que el cliente ya debe en el sistema. Déjalo vacío si no tiene."
            invalido={marcar && saldo < 0}
          />
          <Campo
            id="montoCliente"
            etiqueta="Monto cliente"
            valor={datos.montoCliente}
            onChange={(v) => set("montoCliente", v)}
            numerico
            prefijo={SIMBOLO_MONEDA}
            ayuda={
              montoNoCubreSaldo
                ? "Debe cubrir al menos el saldo actual"
                : positivo(datos.montoCliente) && saldo > 0
                  ? `El cliente recibe ${formatoMoneda(aEntregar)} tras cancelar el saldo`
                  : "Monto total del préstamo nuevo"
            }
            invalido={(marcar && !positivo(datos.montoCliente)) || montoNoCubreSaldo}
          />
        </div>
      </fieldset>

      <fieldset className="ic-form-group">
        <Paso n={3} titulo="Importes APC" completo={apcCompleto} extra={<span className="ic-subtitle__hint">Opcional</span>} />
        {filasApc.length > 0 && (
          <div className="ic-apc">
            <div className="ic-apc__cabecera" aria-hidden="true">
              <span>Detalle</span>
              <span>Importe APC</span>
              <span className="ic-apc__num">Importe final a considerar</span>
              <span />
            </div>
            <ul className="ic-apc__filas">
              {filasApc.map((f, i) => {
                const n = i + 1;
                const errDetalle = marcar && !filaVacia(f) && !f.detalle;
                const errMonto = marcar && !filaVacia(f) && !positivo(f.monto);
                return (
                  <li key={f.id} className="ic-apc__fila ic-appear">
                    <div className={`ic-field ic-field--full ic-field--stack${errDetalle ? " ic-field--error" : ""}`}>
                      <label className="ic-field__label ic-apc__label" htmlFor={`apc-detalle-${f.id}`}>
                        Detalle <span className="ic-sr-only">del importe {n}</span>
                      </label>
                      <div className="ic-field__control ic-field__control--select">
                        <select
                          id={`apc-detalle-${f.id}`}
                          className="ic-select"
                          required
                          aria-invalid={errDetalle || undefined}
                          value={f.detalle}
                          onChange={(e) => cambiarFila(f.id, { detalle: e.target.value as FilaApc["detalle"] })}
                        >
                          <option value="">Seleccionar…</option>
                          {DETALLE_APC.map((d) => (
                            <option key={d.id} value={d.id}>{d.etiqueta}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className={`ic-field ic-field--full ic-field--stack${errMonto ? " ic-field--error" : ""}`}>
                      <label className="ic-field__label ic-apc__label" htmlFor={`apc-monto-${f.id}`}>
                        Importe APC <span className="ic-sr-only">{n}</span>
                      </label>
                      <div className="ic-field__control">
                        <span className="ic-field__prefix" aria-hidden="true">{SIMBOLO_MONEDA}</span>
                        <input
                          id={`apc-monto-${f.id}`}
                          className="ic-input"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          placeholder="0.00"
                          aria-invalid={errMonto || undefined}
                          value={f.monto}
                          onChange={(e) => cambiarFila(f.id, { monto: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="ic-apc__final">
                      <span className="ic-apc__label ic-apc__final-label" aria-hidden="true">Importe final</span>
                      <output htmlFor={`apc-detalle-${f.id} apc-monto-${f.id}`} aria-label={`Importe final ${n}`}>
                        {formatoMoneda(importeFinalApc(f.detalle, Number(f.monto)))}
                      </output>
                    </div>
                    <button
                      type="button"
                      className="ic-icon-btn ic-apc__eliminar"
                      onClick={() => eliminarFila(f.id)}
                      aria-label={`Eliminar importe ${n}`}
                      title="Eliminar"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="ic-apc__total" aria-live="polite">
              <span>Total a considerar</span>
              <strong>{formatoMoneda(totalApc)}</strong>
            </div>
          </div>
        )}
        <button id="apc-agregar" type="button" className="ic-btn ic-btn--ghost ic-btn--sm ic-apc__agregar" onClick={agregarFila}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          Agregar importe
        </button>
        <p className="ic-note ic-apc__nota">
          {DETALLE_APC.map(
            (d) =>
              `${d.etiqueta.replace(/^\d+\s*–\s*/, "")}: ${
                d.factor === 1 ? "se toma el monto completo" : `se considera el ${+(d.factor * 100).toFixed(2)} % del monto`
              }. `,
          ).join("")}
          El total se suma a la cuota al calcular la relación cuota / ingreso.
        </p>
      </fieldset>

      <fieldset className="ic-form-group">
        <Paso
          n={4}
          titulo="Criterios"
          completo={criteriosCompletos}
          extra={
            <span className={`ic-badge ic-badge--${criteriosCompletos ? "success" : "info"} ic-subtitle__count`}>
              {elegidos}/{totalCriterios}
            </span>
          }
        />
        <div className="ic-form-grid">
          {CRITERIOS.map((c) => (
            <Selector
              key={c.clave}
              id={c.clave}
              etiqueta={c.titulo}
              valor={datos.seleccion[c.clave]}
              onChange={(v) => set("seleccion", { ...datos.seleccion, [c.clave]: v })}
              opciones={c.opciones.map((o) => ({ valor: o.id, texto: o.etiqueta }))}
              invalido={marcar && !datos.seleccion[c.clave]}
            />
          ))}
          <Selector
            id="plazo"
            etiqueta="Plazo"
            valor={datos.plazo}
            onChange={elegirPlazo}
            opciones={plazos.map((p) => ({ valor: String(p), texto: `${p} meses` }))}
            invalido={marcar && !datos.plazo}
            estado={estadoLista ?? (plazos.length ? null : "Sin plazos para este tipo")}
            ocupado={productos.estado === "cargando"}
          />
          <Selector
            id="producto"
            etiqueta="Producto"
            valor={datos.producto}
            onChange={elegirProducto}
            opciones={productosVisibles.map((p) => ({ valor: p.id, texto: p.etiqueta }))}
            invalido={marcar && !datos.producto}
            estado={estadoLista ?? (productosVisibles.length ? null : "Sin productos para este tipo")}
            ocupado={productos.estado === "cargando"}
          />
          <Selector
            id="promotor"
            etiqueta="Promotor independiente"
            valor={datos.promotor}
            onChange={(v) => set("promotor", v as DatosFormulario["promotor"])}
            opciones={PROMOTOR_INDEPENDIENTE.map((o) => ({ valor: o.id, texto: o.etiqueta }))}
            ayuda="Solo informativo: no suma puntos"
            invalido={marcar && !datos.promotor}
          />
        </div>
        {productos.estado === "error" && (
          <div role="alert" className="ic-alert ic-alert--danger ic-mt-8">
            <p className="ic-alert__title">No se pudieron cargar los productos.</p>
            <p>{productos.mensaje}</p>
            <button type="button" className="ic-btn ic-btn--ghost ic-btn--sm" onClick={onReintentarProductos}>
              Reintentar
            </button>
          </div>
        )}
      </fieldset>

      {errores.length > 0 && (
        <div role="alert" className="ic-alert ic-alert--danger ic-appear ic-mt-8">
          <p className="ic-alert__title">
            {errores.length === 1 ? "Revisa 1 dato:" : `Revisa ${errores.length} datos:`}
          </p>
          <ul className="ic-list">
            {errores.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      <div className="ic-form-actions">
        <button type="submit" className="ic-btn ic-btn--primary ic-btn--wide">Calcular</button>
        <button type="button" onClick={onLimpiar} className="ic-btn ic-btn--ghost">Limpiar</button>
      </div>
    </form>
  );
}
