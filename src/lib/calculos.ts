/**
 * Tipos y utilidades comunes del cálculo. Las reglas de evaluación (validar,
 * calcular) están separadas por tipo de cotización en src/lib/cotizaciones/.
 */
import {
  CRITERIOS,
  MONEDA,
  UMBRALES,
  type ClaveCriterio,
  type CodigoTipoCotizacion,
  type Producto,
  type PromotorIndependiente,
} from "@/config/matriz";
import type { ParametrosCotizacion } from "@/lib/cotizaciones/base";
import type { DesgloseIngreso } from "@/lib/cotizaciones/ingresoNeto";

export type Solicitud = {
  /** Tipo de cotización elegido (PV, DD, EP, PYME…); decide qué reglas se aplican. */
  tipoCotizacion: CodigoTipoCotizacion;
  seleccion: Record<ClaveCriterio, string>;
  /** Plazo elegido en meses (columna plazo de producto_credito), o null si falta. */
  plazo: number | null;
  /** Producto elegido (de los cargados para el tipo de cotización), o null si falta. */
  producto: Producto | null;
  promotorIndependiente: PromotorIndependiente | null;
  /** Ingreso bruto mensual; el neto se calcula según el tipo de cotización. */
  ingresoBruto: number;
  /** Saldo que el cliente ya tiene en el sistema; se cancela con el préstamo nuevo. Puede ser 0. */
  saldoActual: number;
  /** Monto total del préstamo nuevo; es el monto que se financia. */
  montoCliente: number;
};

export type NivelRiesgo = "Bajo" | "Medio" | "Alto";

export type DetalleCriterio = {
  titulo: string;
  opcion: string;
  puntos: number;
  maximo: number;
};

export type Resultado = {
  fecha: Date;
  solicitud: Solicitud;
  /** Parámetros del tipo de cotización con que se evaluó. */
  parametros: ParametrosCotizacion;
  /** Ingreso bruto, descuentos y neto calculado; el neto se usa para la relación cuota / ingreso. */
  ingreso: DesgloseIngreso;
  producto: Producto & { plazoMeses: number };
  detalle: DetalleCriterio[];
  puntaje: number;
  puntajeMaximo: number;
  nivelRiesgo: NivelRiesgo;
  cuotaMensual: number;
  totalAPagar: number;
  /** Cuota / ingreso neto. */
  relacionCuotaIngreso: number;
  montoMaximoSugerido: number;
  /** Lo que recibe el cliente: monto cliente − saldo actual. */
  montoAEntregar: number;
};

export const SELECCION_VACIA = Object.fromEntries(
  CRITERIOS.map((c) => [c.clave, ""]),
) as Record<ClaveCriterio, string>;

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

export function nivelDeRiesgo(
  puntaje: number,
  umbrales: { riesgoBajo: number; riesgoMedio: number } = UMBRALES,
): NivelRiesgo {
  if (puntaje >= umbrales.riesgoBajo) return "Bajo";
  if (puntaje >= umbrales.riesgoMedio) return "Medio";
  return "Alto";
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
