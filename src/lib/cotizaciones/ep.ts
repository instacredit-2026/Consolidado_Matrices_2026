/**
 * EP — Empleado público.
 * Hoy usa las reglas base. Cuando estén definidas sus reglas propias:
 *   - ajusta PARAMETROS, o
 *   - reemplaza `validar` / `calcular` usando los pasos de ./base.ts
 *     (validarBase, puntuar, resumirApc, productoConPlazo, decidir, calcularBase).
 */
import { calcularBase, PARAMETROS_BASE, validarBase, type ParametrosCotizacion, type ReglasCotizacion } from "./base";

const PARAMETROS: ParametrosCotizacion = { ...PARAMETROS_BASE };

export const EP: ReglasCotizacion = {
  codigo: "EP",
  nombre: "Empleado público",
  parametros: PARAMETROS,
  validar: (s) => validarBase(s),
  calcular: (s) => calcularBase(s, PARAMETROS),
};
