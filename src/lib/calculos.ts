/**
 * Tipos y utilidades comunes del cálculo. Las reglas de evaluación (validar,
 * calcular) están separadas por tipo de cotización en src/lib/cotizaciones/.
 */
import { MONEDA, type CodigoTipoCotizacion, type Producto, type PromotorIndependiente } from "@/config/matriz";
import type { ParametrosCotizacion } from "@/lib/cotizaciones/base";
import type { DesgloseIngreso } from "@/lib/cotizaciones/ingresoNeto";

export type Solicitud = {
  /** Tipo de cotización elegido (PV, DD, EP, PYME…); decide qué reglas se aplican. */
  tipoCotizacion: CodigoTipoCotizacion;
  /** Plazo que pide el cliente, en meses (columna plazo de producto_credito), o null si falta. */
  plazo: number | null;
  /** Catálogo de productos del tipo de cotización, entre los que se busca la sugerencia. */
  productos: Producto[];
  promotorIndependiente: PromotorIndependiente | null;
  /** Ingreso bruto mensual; el neto se calcula según el tipo de cotización. */
  ingresoBruto: number;
  /** Saldo que el cliente ya tiene en el sistema; se cancela con el préstamo nuevo. Puede ser 0. */
  saldoActual: number;
  /** Monto total del préstamo nuevo; es el monto que se financia. */
  montoCliente: number;
};

/** Categorización del cliente: el perfil y el rango de ingreso neto en que cae. */
export type Categoria = {
  perfil: string;
  rangoIngreso: string;
};

/** Un producto que corresponde al ingreso neto y al plazo del cliente, con sus cifras. */
export type Oferta = {
  producto: Producto & { plazoMeses: number };
  cuotaMensual: number;
  totalAPagar: number;
  /** Cuota / ingreso neto. */
  relacionCuotaIngreso: number;
  /** Lo máximo que se puede prestar con este producto sin pasar la relación cuota / ingreso. */
  montoMaximoSugerido: number;
  /** Por qué no se puede ofrecer tal como se pidió; vacío = se puede ofrecer. */
  impedimentos: string[];
};

export type Resultado = {
  fecha: Date;
  solicitud: Solicitud;
  /** Parámetros del tipo de cotización con que se evaluó. */
  parametros: ParametrosCotizacion;
  /** Ingreso bruto, descuentos y neto calculado; el neto decide el rango y la relación cuota / ingreso. */
  ingreso: DesgloseIngreso;
  /** Categoría del producto sugerido (o de la primera opción si ninguna se puede ofrecer); null si no hay productos. */
  categoria: Categoria | null;
  /** Mejor producto que se puede ofrecer; null si ninguno cumple. */
  sugerida: Oferta | null;
  /** Los demás productos del rango y plazo del cliente (viables primero). */
  alternativas: Oferta[];
  /** Lo que recibe el cliente: monto cliente − saldo actual. */
  montoAEntregar: number;
};

/** Cuota mensual con amortización francesa (cuota fija). */
export function cuotaMensual(monto: number, tasaAnual: number, plazoMeses: number): number {
  const r = tasaAnual / 12;
  if (r === 0) return monto / plazoMeses;
  return (monto * r) / (1 - Math.pow(1 + r, -plazoMeses));
}

/** Monto que se puede financiar con una cuota dada (valor presente). */
export function montoParaCuota(cuota: number, tasaAnual: number, plazoMeses: number): number {
  const r = tasaAnual / 12;
  if (r === 0) return cuota * plazoMeses;
  return (cuota * (1 - Math.pow(1 + r, -plazoMeses))) / r;
}

/** ¿El ingreso neto cae en el rango del producto? Se compara en centavos (la matriz usa 2 decimales). */
export function enRangoIngreso(neto: number, p: Pick<Producto, "ingresoMinimo" | "ingresoMaximo">): boolean {
  const n = Math.round(neto * 100) / 100;
  return n >= p.ingresoMinimo && (p.ingresoMaximo === null || n <= p.ingresoMaximo);
}

const fmtMoneda = new Intl.NumberFormat(MONEDA.locale, {
  style: "currency",
  currency: MONEDA.codigo,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatoMoneda(n: number): string {
  return fmtMoneda.format(n);
}

export function formatoPorcentaje(n: number, decimales = 1): string {
  return `${(n * 100).toFixed(decimales)} %`;
}
