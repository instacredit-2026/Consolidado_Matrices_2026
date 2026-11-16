/**
 * REGLAS BASE DE EVALUACIÓN
 * ---------------------------------------------------------------
 * Cálculo común a todos los tipos de cotización. Cada tipo (pv.ts, dd.ts,
 * ep.ts, pyme.ts) parte de aquí y cambia solo lo que sea distinto:
 *   - sus `parametros` (umbrales de riesgo y de cuota / ingreso), o
 *   - su `validar` / `calcular`, reutilizando los pasos exportados abajo.
 */
import { CRITERIOS, DETALLE_APC, UMBRALES, type DetalleApc, type Opcion } from "@/config/matriz";
import {
  correoValido,
  cuotaMensual,
  filaApcVacia,
  formatoMoneda,
  importeFinalApc,
  montoParaCuota,
  nivelDeRiesgo,
  type Decision,
  type DetalleCriterio,
  type DetalleImporteApc,
  type ImporteApc,
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
  /** Relación (cuota + APC) / ingreso neto aceptable (0.40 = 40 %). */
  relacionCuotaMax: number;
  /** Por encima de esta relación la solicitud se rechaza. */
  relacionCuotaRechazo: number;
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
  relacionCuotaRechazo: UMBRALES.relacionCuotaRechazo,
};

const pct = (n: number) => `${(n * 100).toFixed(1)} %`;

// ---------------------------------------------------------------
// Validación
// ---------------------------------------------------------------

/** Errores de validación comunes a todos los tipos (vacía si todo está bien). */
export function validarBase(s: Solicitud): string[] {
  const errores: string[] = [];
  // Los datos del cliente son opcionales; el correo, si se escribe, debe tener formato válido.
  if (s.correo && !correoValido(s.correo)) errores.push("El correo no tiene un formato válido.");
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
  s.importesApc.forEach((f, i) => {
    if (filaApcVacia(f)) return;
    if (!f.detalle) errores.push(`Selecciona el detalle del importe APC ${i + 1}.`);
    if (!(f.monto > 0)) errores.push(`El monto del importe APC ${i + 1} debe ser mayor que 0.`);
  });
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

/** Filas APC consideradas (sin las vacías) y su total. */
export function resumirApc(s: Solicitud) {
  const importesApc: DetalleImporteApc[] = s.importesApc
    .filter((f): f is ImporteApc & { detalle: DetalleApc } => !filaApcVacia(f) && Boolean(f.detalle))
    .map((f) => ({
      detalle: f.detalle,
      etiqueta: DETALLE_APC.find((d) => d.id === f.detalle)?.etiqueta ?? f.detalle,
      monto: f.monto,
      importeFinal: importeFinalApc(f.detalle, f.monto),
    }));
  const totalApc = importesApc.reduce((acc, f) => acc + f.importeFinal, 0);
  return { importesApc, totalApc };
}

/** Producto elegido con su plazo garantizado (validar() ya lo comprobó). */
export function productoConPlazo(s: Solicitud): Resultado["producto"] {
  if (!s.producto?.plazoMeses) throw new Error("Producto inválido o sin plazo");
  return { ...s.producto, plazoMeses: s.producto.plazoMeses };
}

/** Decisión final: cualquier motivo de rechazo → Rechazado; si no, cualquiera de revisión → En revisión. */
export function decidir(rechazo: string[], revision: string[], motivosAprobado: string[]) {
  if (rechazo.length) return { decision: "Rechazado" as Decision, motivos: [...rechazo, ...revision] };
  if (revision.length) return { decision: "En revisión" as Decision, motivos: revision };
  return { decision: "Aprobado" as Decision, motivos: motivosAprobado };
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
  const { importesApc, totalApc } = resumirApc(s);
  const ingreso = calcularNeto(s.ingresoBruto);
  if (!(ingreso.neto > 0)) throw new Error("El ingreso neto calculado no es mayor que 0.");

  const relacion = (cuota + totalApc) / ingreso.neto;
  // La capacidad de pago descuenta lo que ya paga en la APC.
  const cuotaDisponible = Math.max(0, ingreso.neto * p.relacionCuotaMax - totalApc);
  const montoMaximoSugerido = Math.min(
    montoParaCuota(cuotaDisponible, producto.tasaAnual, producto.plazoMeses),
    producto.montoMaximo,
  );

  // --- Decisión -------------------------------------------------
  const rechazo: string[] = [];
  const revision: string[] = [];
  const queCuota = totalApc > 0 ? "La cuota más los importes APC representan" : "La cuota representa";

  if (nivelRiesgo === "Alto")
    rechazo.push(`Puntaje de ${puntaje} por debajo del mínimo de ${p.riesgoMedio} (riesgo alto).`);
  else if (nivelRiesgo === "Medio")
    revision.push(`Puntaje de ${puntaje} en rango de riesgo medio (${p.riesgoMedio}–${p.riesgoBajo - 1}).`);

  if (relacion > p.relacionCuotaRechazo)
    rechazo.push(`${queCuota} ${pct(relacion)} del ingreso neto (máximo ${pct(p.relacionCuotaRechazo)}).`);
  else if (relacion > p.relacionCuotaMax)
    revision.push(`${queCuota} ${pct(relacion)} del ingreso neto (recomendado hasta ${pct(p.relacionCuotaMax)}).`);

  if (s.montoCliente > producto.montoMaximo)
    rechazo.push(`El monto cliente supera el máximo del producto (${formatoMoneda(producto.montoMaximo)}).`);

  const { decision, motivos } = decidir(rechazo, revision, [
    `Puntaje de ${puntaje} con riesgo bajo.`,
    `${queCuota} ${pct(relacion)} del ingreso neto, dentro del límite de ${pct(p.relacionCuotaMax)}.`,
  ]);

  // --- Advertencias (no cambian la decisión) --------------------
  const advertencias: string[] = [];
  if (decision !== "Aprobado" && montoMaximoSugerido > 0 && montoMaximoSugerido < s.montoCliente)
    advertencias.push(`Monto máximo sugerido según capacidad de pago: ${formatoMoneda(montoMaximoSugerido)}.`);

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
    importesApc,
    totalApc,
    relacionCuotaIngreso: relacion,
    montoMaximoSugerido,
    montoAEntregar: s.montoCliente - s.saldoActual,
    decision,
    motivos,
    advertencias,
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
