/**
 * Punto de entrada del cálculo: elige las reglas según `Solicitud.tipoCotizacion`.
 * Para agregar un tipo nuevo: crea su archivo (copia pv.ts) y regístralo en REGLAS.
 */
import type { Resultado, Solicitud } from "@/lib/calculos";
import { PARAMETROS_BASE, reglasBase, type ReglasCotizacion } from "./base";
import { DD } from "./dd";
import { EP } from "./ep";
import { PV } from "./pv";
import { PYME } from "./pyme";

export type { ParametrosCotizacion, ReglasCotizacion } from "./base";

const REGLAS: Record<string, ReglasCotizacion> = { PV, DD, EP, PYME };

/** Para tipos de Supabase que aún no tienen archivo propio. */
const GENERICA = reglasBase("GENERICA", "Reglas base", PARAMETROS_BASE);

export function reglasDe(codigo: string): ReglasCotizacion {
  return REGLAS[codigo] ?? GENERICA;
}

/** Errores de validación según el tipo de cotización (vacía si todo está bien). */
export function validar(s: Solicitud): string[] {
  return reglasDe(s.tipoCotizacion).validar(s);
}

/** Evaluación completa según el tipo de cotización. Supone que `validar(s)` no devolvió errores. */
export function calcular(s: Solicitud): Resultado {
  return reglasDe(s.tipoCotizacion).calcular(s);
}
