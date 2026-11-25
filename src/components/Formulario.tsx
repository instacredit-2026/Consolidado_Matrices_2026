"use client";

import { MONEDA, PROMOTOR_INDEPENDIENTE, type Producto, type PromotorIndependiente } from "@/config/matriz";
import { formatoMoneda } from "@/lib/calculos";
import type { CalculoIngresoNeto } from "@/lib/cotizaciones";

export type DatosFormulario = {
  /** Plazo que pide el cliente, en meses, como texto (valores de la columna plazo de producto_credito). */
  plazo: string;
  promotor: PromotorIndependiente | "";
  /** Ingreso bruto mensual; el neto no se ingresa, se calcula. */
  ingresoBruto: string;
  /** Saldo que el cliente ya tiene en el sistema (opcional, 0 si no tiene). */
  saldoActual: string;
  /** Monto total del préstamo nuevo. */
  montoCliente: string;
};

/** Productos del tipo de cotización elegido, cargados desde Supabase. */
export type EstadoProductos =
  | { estado: "cargando" }
  | { estado: "error"; mensaje: string }
  | { estado: "listo"; productos: Producto[] };

type Props = {
  datos: DatosFormulario;
  productos: EstadoProductos;
  /** Cálculo del ingreso neto del tipo de cotización elegido. */
  calcularNeto: CalculoIngresoNeto;
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
function Campo({ id, etiqueta, valor, onChange, numerico, invalido, placeholder, prefijo, ayuda }: CampoProps) {
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
          {...(numerico ? { type: "number", inputMode: "decimal" as const, min: 0, step: "0.01" } : {})}
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

export default function Formulario({
  datos,
  productos,
  calcularNeto,
  onReintentarProductos,
  onChange,
  onCalcular,
  onLimpiar,
  errores,
}: Props) {
  const set = <K extends keyof DatosFormulario>(k: K, v: DatosFormulario[K]) => onChange({ ...datos, [k]: v });

  // Tras el primer intento de cálculo, los campos pendientes se marcan en línea.
  const marcar = errores.length > 0;
  const condicionesCompletas = Boolean(datos.plazo && datos.promotor);

  // Ingreso neto: se calcula del bruto con la fórmula del tipo de cotización.
  const ingreso = positivo(datos.ingresoBruto) ? calcularNeto(Number(datos.ingresoBruto)) : null;
  const saldo = Number(datos.saldoActual || 0);
  const montoNoCubreSaldo = positivo(datos.montoCliente) && saldo > Number(datos.montoCliente);
  const aEntregar = Number(datos.montoCliente) - saldo;
  const montosCompletos = positivo(datos.ingresoBruto) && positivo(datos.montoCliente) && !montoNoCubreSaldo;

  // Plazos: valores distintos de la columna plazo de los productos del tipo elegido.
  // El producto no se elige: se sugiere en el resultado según el ingreso neto y el plazo.
  const lista = productos.estado === "listo" ? productos.productos : [];
  const plazos = [...new Set(lista.map((p) => p.plazoMeses).filter((p): p is number => p !== null))].sort((a, b) => a - b);
  const estadoLista =
    productos.estado === "cargando" ? "Cargando…" : productos.estado === "error" ? "No se pudieron cargar" : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onCalcular();
      }}
      noValidate
    >
      <fieldset className="ic-form-group">
        <Paso n={1} titulo="Ingresos y monto" completo={montosCompletos} />
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
          <div className="ic-field ic-field--full ic-field--stack">
            <span className="ic-field__label" id="ingresoNeto-etiqueta">Ingreso neto</span>
            <output
              className="ic-calculado"
              htmlFor="ingresoBruto"
              aria-labelledby="ingresoNeto-etiqueta"
              aria-describedby="ingresoNeto-ayuda"
              aria-live="polite"
            >
              <span className="ic-calculado__valor">{ingreso ? formatoMoneda(ingreso.neto) : "—"}</span>
              <span className="ic-calculado__tag">Calculado</span>
            </output>
            <span id="ingresoNeto-ayuda" className="ic-field__hint">
              {ingreso
                ? ingreso.descuentos
                    .filter((d) => d.monto > 0)
                    .map((d) => `${d.concepto.replace(/ \(.*\)$/, "")} ${formatoMoneda(d.monto)}`)
                    .join(" · ") || "Sin descuentos"
                : "Se calcula del ingreso bruto con los descuentos de ley"}
            </span>
          </div>
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
        <Paso n={2} titulo="Plazo del cliente" completo={condicionesCompletas} />
        <div className="ic-form-grid">
          <Selector
            id="plazo"
            etiqueta="Plazo"
            valor={datos.plazo}
            onChange={(v) => set("plazo", v)}
            opciones={plazos.map((p) => ({ valor: String(p), texto: `${p} meses` }))}
            invalido={marcar && !datos.plazo}
            estado={estadoLista ?? (plazos.length ? null : "Sin plazos para este tipo")}
            ocupado={productos.estado === "cargando"}
            ayuda="El producto se sugiere con este plazo y el ingreso neto"
          />
          <Selector
            id="promotor"
            etiqueta="Promotor independiente"
            valor={datos.promotor}
            onChange={(v) => set("promotor", v as DatosFormulario["promotor"])}
            opciones={PROMOTOR_INDEPENDIENTE.map((o) => ({ valor: o.id, texto: o.etiqueta }))}
            ayuda="Solo informativo"
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
