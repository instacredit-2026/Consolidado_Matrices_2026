/**
 * REGLAS BASE DE EVALUACIÓN
 * ---------------------------------------------------------------
 * Cálculo común a todos los tipos de cotización. Cada tipo (pv.ts, dd.ts,
 * ep.ts, pyme.ts) parte de aquí y cambia solo lo que sea distinto:
 *   - sus `parametros` (relación cuota / ingreso), o
 *   - su `validar` / `calcular`, reutilizando los pasos exportados abajo.
 *
 * Sugerencia de producto: entre los productos del tipo se toman los del plazo
 * del cliente cuyo rango de ingreso neto contiene su neto. Cada uno se evalúa
 * con el monto cliente; se sugiere el mejor que se pueda ofrecer (ver `ordenarOfertas`).
 */
import { UMBRALES, type Producto } from "@/config/matriz";
import {
  cuotaMensual,
  enRangoIngreso,
  formatoMoneda,
  formatoPorcentaje,
  montoParaCuota,
  type Oferta,
  type Resultado,
  type Solicitud,
} from "@/lib/calculos";
import { ingresoNetoPanama, type CalculoIngresoNeto } from "./ingresoNeto";

/** Valores numéricos que cada tipo puede ajustar. */
export type ParametrosCotizacion = {
  /**
   * Relación cuota / ingreso neto aceptable (0.40 = 40 %): un producto cuya cuota
   * la supere no se sugiere, y define el monto máximo sugerido.
   */
  relacionCuotaMax: number;
};

/** Reglas de un tipo de cotización. */
export type ReglasCotizacion = {
  /** Código del tipo (columna `codigo` de `tipo_cotizacion`). */
  codigo: string;
  nombre: string;
  parametros: ParametrosCotizacion;
  /** Cómo se obtiene el ingreso neto a partir del bruto (ver ./ingresoNeto.ts). */
  ingresoNeto: CalculoIngresoNeto;
  validar: (s: Solicitud) => string[];
  calcular: (s: Solicitud) => Resultado;
};

/** Parámetros por defecto (los de `UMBRALES` en matriz.ts). */
export const PARAMETROS_BASE: ParametrosCotizacion = {
  relacionCuotaMax: UMBRALES.relacionCuotaMax,
};

// ---------------------------------------------------------------
// Validación
// ---------------------------------------------------------------

/** Errores de validación comunes a todos los tipos (vacía si todo está bien). */
export function validarBase(s: Solicitud): string[] {
  const errores: string[] = [];
  if (!s.plazo) errores.push('Selecciona una opción en "Plazo".');
  if (!s.promotorIndependiente) errores.push('Selecciona una opción en "Promotor independiente".');
  if (!(s.ingresoBruto > 0)) errores.push("El ingreso bruto debe ser mayor que 0.");
  if (!(s.saldoActual >= 0)) errores.push("El saldo actual no puede ser negativo.");
  if (!(s.montoCliente > 0)) errores.push("El monto cliente debe ser mayor que 0.");
  else if (s.saldoActual > 0 && s.montoCliente < s.saldoActual)
    errores.push("El monto cliente debe cubrir al menos el saldo actual.");
  return errores;
}

// ---------------------------------------------------------------
// Pasos del cálculo (reutilizables desde cada tipo)
// ---------------------------------------------------------------

/** Productos del plazo pedido cuyo rango de ingreso neto contiene el neto del cliente. */
export function productosElegibles(productos: Producto[], neto: number, plazo: number): Producto[] {
  return productos.filter((p) => p.plazoMeses === plazo && enRangoIngreso(neto, p));
}

/** Cifras de un producto para el monto que pide el cliente, y lo que impide ofrecerlo. */
export function evaluarOferta(s: Solicitud, producto: Producto, neto: number, p: ParametrosCotizacion): Oferta {
  if (!producto.plazoMeses) throw new Error(`El producto "${producto.etiqueta}" no tiene plazo.`);
  const conPlazo = { ...producto, plazoMeses: producto.plazoMeses };
  const cuota = cuotaMensual(s.montoCliente, producto.tasaAnual, producto.plazoMeses);
  const relacion = cuota / neto;
  const montoMaximoSugerido = Math.min(
    montoParaCuota(neto * p.relacionCuotaMax, producto.tasaAnual, producto.plazoMeses),
    producto.montoMaximo,
  );

  const impedimentos: string[] = [];
  if (s.montoCliente > producto.montoMaximo)
    impedimentos.push(`El monto supera el máximo del producto (${formatoMoneda(producto.montoMaximo)}).`);
  if (relacion > p.relacionCuotaMax)
    impedimentos.push(
      `La cuota es el ${formatoPorcentaje(relacion)} del ingreso neto (máximo ${formatoPorcentaje(p.relacionCuotaMax)}).`,
    );

  return {
    producto: conPlazo,
    cuotaMensual: cuota,
    totalAPagar: cuota * producto.plazoMeses,
    relacionCuotaIngreso: relacion,
    montoMaximoSugerido,
    impedimentos,
  };
}

/**
 * Orden de preferencia: primero las que se pueden ofrecer; luego la menor tasa
 * (menor cuota para el cliente) y, a igual tasa, el mayor monto máximo.
 */
export function ordenarOfertas(ofertas: Oferta[]): Oferta[] {
  return [...ofertas].sort(
    (a, b) =>
      Number(a.impedimentos.length > 0) - Number(b.impedimentos.length > 0) ||
      a.producto.tasaAnual - b.producto.tasaAnual ||
      b.producto.montoMaximo - a.producto.montoMaximo,
  );
}

// ---------------------------------------------------------------
// Cálculo completo
// ---------------------------------------------------------------

/** Cálculo común. Supone que `validarBase(s)` no devolvió errores. */
export function calcularBase(
  s: Solicitud,
  p: ParametrosCotizacion,
  calcularNeto: CalculoIngresoNeto = ingresoNetoPanama,
): Resultado {
  const ingreso = calcularNeto(s.ingresoBruto);
  if (!(ingreso.neto > 0)) throw new Error("El ingreso neto calculado no es mayor que 0.");
  if (!s.plazo) throw new Error("Falta el plazo.");

  const ofertas = ordenarOfertas(
    productosElegibles(s.productos, ingreso.neto, s.plazo).map((prod) => evaluarOferta(s, prod, ingreso.neto, p)),
  );
  const sugerida = ofertas[0] && ofertas[0].impedimentos.length === 0 ? ofertas[0] : null;
  const referencia = sugerida ?? ofertas[0];

  return {
    fecha: new Date(),
    solicitud: s,
    parametros: p,
    ingreso,
    categoria: referencia
      ? { perfil: referencia.producto.perfil, rangoIngreso: referencia.producto.rangoIngreso }
      : null,
    sugerida,
    alternativas: sugerida ? ofertas.slice(1) : ofertas,
    montoAEntregar: s.montoCliente - s.saldoActual,
  };
}

/** Reglas que usan el cálculo base con los parámetros dados. */
export function reglasBase(
  codigo: string,
  nombre: string,
  parametros: ParametrosCotizacion,
  ingresoNeto: CalculoIngresoNeto = ingresoNetoPanama,
): ReglasCotizacion {
  return {
    codigo,
    nombre,
    parametros,
    ingresoNeto,
    validar: validarBase,
    calcular: (s) => calcularBase(s, parametros, ingresoNeto),
  };
}
