/**
 * REGLAS BASE DE EVALUACIÓN
 * ---------------------------------------------------------------
 * Cálculo común a todos los tipos de cotización. Cada tipo (pv.ts, dd.ts,
 * ep.ts, pyme.ts) parte de aquí y cambia solo lo que sea distinto:
 *   - sus `parametros` (umbrales de riesgo y de cuota / ingreso), o
 *   - su `validar` / `calcular`, reutilizando los pasos exportados abajo.
 */
import { CRITERIOS, UMBRALES, type Opcion } from "@/config/matriz";
import {
  cuotaMensual,
  montoParaCuota,
  nivelDeRiesgo,
  type DetalleCriterio,
  type Resultado,
  type Solicitud,
} from "@/lib/calculos";
import { ingresoNetoPanama, type CalculoIngresoNeto } from "./ingresoNeto";

/** Valores numéricos que cada tipo puede ajustar. */
export type ParametrosCotizacion = {
  /** Puntaje mínimo para riesgo BAJO. */
  riesgoBajo: number;
  /** Puntaje mínimo para riesgo MEDIO (por debajo es ALTO). */
  riesgoMedio: number;
  /** Relación cuota / ingreso neto aceptable (0.40 = 40 %); define el monto máximo sugerido. */
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
  riesgoBajo: UMBRALES.riesgoBajo,
  riesgoMedio: UMBRALES.riesgoMedio,
  relacionCuotaMax: UMBRALES.relacionCuotaMax,
};

// ---------------------------------------------------------------
// Validación
// ---------------------------------------------------------------

/** Errores de validación comunes a todos los tipos (vacía si todo está bien). */
export function validarBase(s: Solicitud): string[] {
  const errores: string[] = [];
  for (const c of CRITERIOS) {
    if (!s.seleccion[c.clave]) errores.push(`Selecciona una opción en "${c.titulo}".`);
  }
  if (!s.plazo) errores.push('Selecciona una opción en "Plazo".');
  if (!s.producto) errores.push('Selecciona una opción en "Producto".');
  else if (!(s.producto.plazoMeses && s.producto.plazoMeses > 0))
    errores.push(`El producto "${s.producto.etiqueta}" no tiene plazo definido en la matriz.`);
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

/** Puntaje de los CRITERIOS y nivel de riesgo. */
export function puntuar(s: Solicitud, p: ParametrosCotizacion) {
  const detalle: DetalleCriterio[] = CRITERIOS.map((c) => {
    const opciones = c.opciones as readonly Opcion[];
    const op = opciones.find((o) => o.id === s.seleccion[c.clave]);
    if (!op) throw new Error(`Opción inválida en ${c.titulo}`);
    return {
      titulo: c.titulo,
      opcion: op.etiqueta,
      puntos: op.puntos,
      maximo: Math.max(...opciones.map((o) => o.puntos)),
    };
  });
  const puntaje = detalle.reduce((acc, d) => acc + d.puntos, 0);
  const puntajeMaximo = detalle.reduce((acc, d) => acc + d.maximo, 0);
  return { detalle, puntaje, puntajeMaximo, nivelRiesgo: nivelDeRiesgo(puntaje, p) };
}

/** Producto elegido con su plazo garantizado (validar() ya lo comprobó). */
export function productoConPlazo(s: Solicitud): Resultado["producto"] {
  if (!s.producto?.plazoMeses) throw new Error("Producto inválido o sin plazo");
  return { ...s.producto, plazoMeses: s.producto.plazoMeses };
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
  const { detalle, puntaje, puntajeMaximo, nivelRiesgo } = puntuar(s, p);
  const producto = productoConPlazo(s);
  const cuota = cuotaMensual(s.montoCliente, producto.tasaAnual, producto.plazoMeses);
  const ingreso = calcularNeto(s.ingresoBruto);
  if (!(ingreso.neto > 0)) throw new Error("El ingreso neto calculado no es mayor que 0.");

  const relacion = cuota / ingreso.neto;
  const cuotaDisponible = ingreso.neto * p.relacionCuotaMax;
  const montoMaximoSugerido = Math.min(
    montoParaCuota(cuotaDisponible, producto.tasaAnual, producto.plazoMeses),
    producto.montoMaximo,
  );

  return {
    fecha: new Date(),
    solicitud: s,
    parametros: p,
    ingreso,
    producto,
    detalle,
    puntaje,
    puntajeMaximo,
    nivelRiesgo,
    cuotaMensual: cuota,
    totalAPagar: cuota * producto.plazoMeses,
    relacionCuotaIngreso: relacion,
    montoMaximoSugerido,
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
