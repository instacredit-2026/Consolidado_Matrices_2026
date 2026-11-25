/**
 * MATRIZ DE EVALUACIÓN
 * ---------------------------------------------------------------
 * Aquí se editan la moneda, las opciones fijas del formulario y el umbral
 * de capacidad de pago. Los tipos de cotización y los productos (rango de
 * ingreso neto, plazo, tasa, monto) vienen de Supabase (ver src/lib/catalogo.ts):
 * el producto se sugiere a partir del ingreso neto y el plazo del cliente.
 */

/**
 * TIPO DE COTIZACIÓN (tabla `tipo_cotizacion` de Supabase).
 * Ya no se define aquí: se carga en `src/lib/catalogo.ts`.
 */
export type TipoCotizacion = {
  /** PV, DD, EP, PYME… (clave primaria). */
  codigo: string;
  /** Texto que ve el usuario. */
  descripcion: string;
  /** Relación cuota / ingreso del tipo (0.40 = 40 %), si está definida. */
  relacionCuotaIngreso: number | null;
};

export type CodigoTipoCotizacion = TipoCotizacion["codigo"];

/**
 * PRODUCTO (tabla `producto_credito` de Supabase, filtrada por el
 * `tipo_cotizacion` de su perfil). Ya no se define aquí: se carga en
 * `src/lib/catalogo.ts`. El perfil y el rango de ingreso forman la
 * categorización del cliente.
 */
export type Producto = {
  id: string;
  etiqueta: string;
  /** Nombre del perfil al que pertenece (tabla `perfil`). */
  perfil: string;
  /** Rango de ingreso neto mensual del producto (tabla `rango_ingreso`), extremos incluidos. */
  ingresoMinimo: number;
  /** null = "en adelante". */
  ingresoMaximo: number | null;
  /** Texto del rango tal como está en la matriz original (p. ej. "$563,03 - $1044,02"). */
  rangoIngreso: string;
  /** Tasa de interés anual (0.18 = 18 %). Columna `tasa`. */
  tasaAnual: number;
  /** Plazo en meses. Columna `plazo` (puede venir vacía). */
  plazoMeses: number | null;
  /** Monto máximo que se puede prestar. Columna `monto_al_cliente`. */
  montoMaximo: number;
  montoPagare: number;
  comisionDesembolso: number;
  seguro: number;
  nivelEndeudamiento: number | null;
  scoreMin: number | null;
  scoreMax: number | null;
};

export const MONEDA = {
  /** Código ISO de la moneda, usado para formatear cifras. */
  codigo: "USD",
  /** Configuración regional para formato de números. */
  locale: "es-US",
};

/** Promotor independiente: Sí / No. Es solo informativo. */
export const PROMOTOR_INDEPENDIENTE = [
  { id: "si", etiqueta: "Sí" },
  { id: "no", etiqueta: "No" },
] as const;

export type PromotorIndependiente = (typeof PROMOTOR_INDEPENDIENTE)[number]["id"];

export const UMBRALES = {
  /**
   * Relación cuota / ingreso neto aceptable (0.40 = 40 %). Un producto cuya cuota
   * la supere no se sugiere, y define el monto máximo sugerido.
   */
  relacionCuotaMax: 0.4,
};
