"use client";

import {
  CRITERIOS,
  MONEDA,
  PROMOTOR_INDEPENDIENTE,
  type ClaveCriterio,
  type Producto,
  type PromotorIndependiente,
} from "@/config/matriz";
import { correoValido } from "@/lib/calculos";

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
  saldoActual: string;
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
};

const positivo = (v: string) => Number(v) > 0;

/** Input "filled" con etiqueta flotante. placeholder=" " es obligatorio para que la etiqueta flote. */
function Campo({ id, etiqueta, valor, onChange, numerico, tipo, autocompletar, invalido }: CampoProps) {
  return (
    <div className={`ic-field ic-field--full${invalido ? " ic-field--error" : ""}`}>
      <input
        id={id}
        className="ic-input"
        placeholder=" "
        value={valor}
        aria-invalid={invalido || undefined}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autocompletar}
        {...(numerico ? { type: "number", inputMode: "decimal" as const, min: 0, step: "0.01" } : tipo ? { type: tipo } : {})}
      />
      <label className="ic-field__label" htmlFor={id}>{etiqueta}</label>
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
};

/** Menú desplegable "filled" con etiqueta flotante. */
function Selector({ id, etiqueta, valor, onChange, opciones, invalido, estado, ocupado }: SelectorProps) {
  return (
    <div className={`ic-field ic-field--full ic-field--select${invalido ? " ic-field--error" : ""}`}>
      <select
        id={id}
        className="ic-select"
        required
        disabled={Boolean(estado)}
        aria-invalid={invalido || undefined}
        aria-busy={ocupado || undefined}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{estado || "Seleccionar…"}</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>{o.texto}</option>
        ))}
      </select>
      <label className="ic-field__label" htmlFor={id}>{etiqueta}</label>
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
  const montosCompletos =
    positivo(datos.ingresoBruto) && positivo(datos.ingresoNeto) && positivo(datos.saldoActual) && !netoMayorQueBruto;

  // Plazos: valores distintos de la columna plazo de los productos del tipo elegido.
  const lista = productos.estado === "listo" ? productos.productos : [];
  const plazos = [...new Set(lista.map((p) => p.plazoMeses).filter((p): p is number => p !== null))].sort((a, b) => a - b);
  // Con un plazo elegido, solo se ofrecen los productos de ese plazo.
  const productosVisibles = datos.plazo ? lista.filter((p) => String(p.plazoMeses) === datos.plazo) : lista;
  const estadoLista =
    productos.estado === "cargando" ? "Cargando…" : productos.estado === "error" ? "No se pudieron cargar" : null;

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
          <Campo id="cliente" etiqueta="Nombre" valor={datos.cliente} onChange={(v) => set("cliente", v)} />
          <Campo id="identificacion" etiqueta="Identificación" valor={datos.identificacion} onChange={(v) => set("identificacion", v)} />
          <Campo
            id="telefono"
            etiqueta="Teléfono"
            tipo="tel"
            autocompletar="tel"
            valor={datos.telefono}
            onChange={(v) => set("telefono", v)}
          />
          <Campo
            id="correo"
            etiqueta="Correo"
            tipo="email"
            autocompletar="email"
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
            etiqueta={`Ingreso bruto (${MONEDA.codigo})`}
            valor={datos.ingresoBruto}
            onChange={(v) => set("ingresoBruto", v)}
            numerico
            invalido={marcar && !positivo(datos.ingresoBruto)}
          />
          <Campo
            id="ingresoNeto"
            etiqueta={`Ingreso neto (${MONEDA.codigo})`}
            valor={datos.ingresoNeto}
            onChange={(v) => set("ingresoNeto", v)}
            numerico
            invalido={marcar && (!positivo(datos.ingresoNeto) || netoMayorQueBruto)}
          />
          <Campo
            id="saldoActual"
            etiqueta={`Saldo actual (${MONEDA.codigo})`}
            valor={datos.saldoActual}
            onChange={(v) => set("saldoActual", v)}
            numerico
            invalido={marcar && !positivo(datos.saldoActual)}
          />
        </div>
      </fieldset>

      <fieldset className="ic-form-group">
        <Paso
          n={3}
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
