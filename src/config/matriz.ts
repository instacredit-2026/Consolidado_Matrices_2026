/**
 * MATRIZ DE EVALUACIÓN (EJEMPLO)
 * ---------------------------------------------------------------
 * Aquí se editan:
 *   - las opciones de los menús desplegables que puntúan y sus puntos,
 *   - los umbrales de riesgo y de capacidad de pago.
 * Los tipos de cotización y los productos (tasa, plazo, monto) vienen de
 * Supabase (ver src/lib/catalogo.ts).
 *
 * Regla general: más puntos = menor riesgo.
 */

export type Opcion = {
  id: string;
  etiqueta: string;
  puntos: number;
};

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
 * `src/lib/catalogo.ts`. No aporta puntos al puntaje.
 */
export type Producto = {
  id: string;
  etiqueta: string;
  /** Nombre del perfil al que pertenece (tabla `perfil`). */
  perfil: string;
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

export const PROVINCIAS: Opcion[] = [
  { id: "prov-a", etiqueta: "Provincia A", puntos: 10 },
  { id: "prov-b", etiqueta: "Provincia B", puntos: 8 },
  { id: "prov-c", etiqueta: "Provincia C", puntos: 6 },
  { id: "prov-d", etiqueta: "Provincia D", puntos: 4 },
];

/** Promotor independiente: Sí / No. No aporta puntos; se registra en el informe. */
export const PROMOTOR_INDEPENDIENTE = [
  { id: "si", etiqueta: "Sí" },
  { id: "no", etiqueta: "No" },
] as const;

export type PromotorIndependiente = (typeof PROMOTOR_INDEPENDIENTE)[number]["id"];

/**
 * Umbrales sobre el puntaje de CRITERIOS. Con solo Provincia el máximo es 10:
 * ajústalos cuando tengas los valores reales.
 */
export const UMBRALES = {
  /** Puntaje mínimo para riesgo BAJO. */
  riesgoBajo: 7,
  /** Puntaje mínimo para riesgo MEDIO (por debajo es ALTO). */
  riesgoMedio: 5,
  /** Relación cuota / ingreso neto aceptable (0.40 = 40 %). */
  relacionCuotaMax: 0.4,
  /** Por encima de esta relación la solicitud se rechaza. */
  relacionCuotaRechazo: 0.5,
};

/**
 * Criterios que puntúan, mostrados como menús desplegables, en orden.
 * El producto no está aquí: sus opciones vienen de Supabase y no puntúa.
 */
export const CRITERIOS = [
  { clave: "provincia", titulo: "Provincia", opciones: PROVINCIAS },
] as const;

export type ClaveCriterio = (typeof CRITERIOS)[number]["clave"];
