/**
 * EP — Empleado público.
 * Hoy usa las reglas base. Cuando estén definidas sus reglas propias:
 *   - ajusta PARAMETROS o INGRESO_NETO (p. ej. crearIngresoNetoPanama({ seguroSocial: 0.1 })), o
 *   - reemplaza `validar` / `calcular` usando los pasos de ./base.ts
 *     (validarBase, puntuar, productoConPlazo, calcularBase).
 */
import { calcularBase, PARAMETROS_BASE, validarBase, type ParametrosCotizacion, type ReglasCotizacion } from "./base";
import { ingresoNetoPanama, type CalculoIngresoNeto } from "./ingresoNeto";

const PARAMETROS: ParametrosCotizacion = { ...PARAMETROS_BASE };

/** Ingreso neto a partir del bruto: hoy, descuentos de ley de Panamá. */
const INGRESO_NETO: CalculoIngresoNeto = ingresoNetoPanama;

export const EP: ReglasCotizacion = {
  codigo: "EP",
  nombre: "Empleado público",
  parametros: PARAMETROS,
  ingresoNeto: INGRESO_NETO,
  validar: (s) => validarBase(s),
  calcular: (s) => calcularBase(s, PARAMETROS, INGRESO_NETO),
};
