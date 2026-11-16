import {
  CRITERIOS,
  DETALLE_APC,
  MONEDA,
  UMBRALES,
  type ClaveCriterio,
  type DetalleApc,
  type Opcion,
  type Producto,
  type PromotorIndependiente,
} from "@/config/matriz";

/** Fila de Importes APC. `detalle` es null si no se eligió. */
export type ImporteApc = { detalle: DetalleApc | null; monto: number };

export type DetalleImporteApc = { detalle: DetalleApc; etiqueta: string; monto: number; importeFinal: number };

/** Importe final a considerar de una fila: monto × factor del detalle (0 si falta el detalle). */
export function importeFinalApc(detalle: DetalleApc | null | "", monto: number): number {
  const d = DETALLE_APC.find((x) => x.id === detalle);
  return d && monto > 0 ? monto * d.factor : 0;
}

/** Una fila sin detalle ni monto no cuenta (se ignora). */
const filaApcVacia = (f: ImporteApc) => !f.detalle && !(f.monto > 0);

export type Solicitud = {
  cliente: string;
  identificacion: string;
  telefono: string;
  correo: string;
  seleccion: Record<ClaveCriterio, string>;
  /** Plazo elegido en meses (columna plazo de producto_credito), o null si falta. */
  plazo: number | null;
  /** Producto elegido (de los cargados para el tipo de cotización), o null si falta. */
  producto: Producto | null;
  promotorIndependiente: PromotorIndependiente | null;
  ingresoBruto: number;
  /** Se usa para la relación cuota / ingreso. */
  ingresoNeto: number;
  /** Saldo que el cliente ya tiene en el sistema; se cancela con el préstamo nuevo. Puede ser 0. */
  saldoActual: number;
  /** Monto total del préstamo nuevo; es el monto que se financia. */
  montoCliente: number;
  /** Deudas del cliente en la APC (puede estar vacía). */
  importesApc: ImporteApc[];
};

export type NivelRiesgo = "Bajo" | "Medio" | "Alto";
export type Decision = "Aprobado" | "En revisión" | "Rechazado";

export type DetalleCriterio = {
  titulo: string;
  opcion: string;
  puntos: number;
  maximo: number;
};

export type Resultado = {
  fecha: Date;
  solicitud: Solicitud;
  producto: Producto & { plazoMeses: number };
  detalle: DetalleCriterio[];
  puntaje: number;
  puntajeMaximo: number;
  nivelRiesgo: NivelRiesgo;
  cuotaMensual: number;
  totalAPagar: number;
  /** Filas de Importes APC consideradas (sin las vacías). */
  importesApc: DetalleImporteApc[];
  /** Suma de los importes finales APC; se agrega a la cuota en la relación. */
  totalApc: number;
  /** (cuota + total APC) / ingreso neto. */
  relacionCuotaIngreso: number;
  montoMaximoSugerido: number;
  /** Lo que recibe el cliente: monto cliente − saldo actual. */
  montoAEntregar: number;
  decision: Decision;
  motivos: string[];
  advertencias: string[];
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

export function nivelDeRiesgo(puntaje: number): NivelRiesgo {
  if (puntaje >= UMBRALES.riesgoBajo) return "Bajo";
  if (puntaje >= UMBRALES.riesgoMedio) return "Medio";
  return "Alto";
}

/** Comprobación básica de formato de correo (algo@dominio.ext). */
export function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());
}

/** Devuelve la lista de errores de validación (vacía si todo está bien). */
export function validar(s: Solicitud): string[] {
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
  if (!(s.ingresoNeto > 0)) errores.push("El ingreso neto debe ser mayor que 0.");
  else if (s.ingresoBruto > 0 && s.ingresoNeto > s.ingresoBruto)
    errores.push("El ingreso neto no puede ser mayor que el ingreso bruto.");
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

export function calcular(s: Solicitud): Resultado {
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
  const nivelRiesgo = nivelDeRiesgo(puntaje);

  if (!s.producto?.plazoMeses) throw new Error("Producto inválido o sin plazo");
  const producto = { ...s.producto, plazoMeses: s.producto.plazoMeses };
  const cuota = cuotaMensual(s.montoCliente, producto.tasaAnual, producto.plazoMeses);

  const importesApc: DetalleImporteApc[] = s.importesApc
    .filter((f): f is ImporteApc & { detalle: DetalleApc } => !filaApcVacia(f) && Boolean(f.detalle))
    .map((f) => ({
      detalle: f.detalle,
      etiqueta: DETALLE_APC.find((d) => d.id === f.detalle)?.etiqueta ?? f.detalle,
      monto: f.monto,
      importeFinal: importeFinalApc(f.detalle, f.monto),
    }));
  const totalApc = importesApc.reduce((acc, f) => acc + f.importeFinal, 0);

  const relacion = (cuota + totalApc) / s.ingresoNeto;
  // La capacidad de pago descuenta lo que ya paga en la APC.
  const cuotaDisponible = Math.max(0, s.ingresoNeto * UMBRALES.relacionCuotaMax - totalApc);
  const montoMaximoSugerido = Math.min(
    montoParaCuota(cuotaDisponible, producto.tasaAnual, producto.plazoMeses),
    producto.montoMaximo,
  );

  // --- Decisión -------------------------------------------------
  const rechazo: string[] = [];
  const revision: string[] = [];
  const pct = (n: number) => `${(n * 100).toFixed(1)} %`;
  const queCuota = totalApc > 0 ? "La cuota más los importes APC representan" : "La cuota representa";

  if (nivelRiesgo === "Alto")
    rechazo.push(`Puntaje de ${puntaje} por debajo del mínimo de ${UMBRALES.riesgoMedio} (riesgo alto).`);
  else if (nivelRiesgo === "Medio")
    revision.push(`Puntaje de ${puntaje} en rango de riesgo medio (${UMBRALES.riesgoMedio}–${UMBRALES.riesgoBajo - 1}).`);

  if (relacion > UMBRALES.relacionCuotaRechazo)
    rechazo.push(`${queCuota} ${pct(relacion)} del ingreso neto (máximo ${pct(UMBRALES.relacionCuotaRechazo)}).`);
  else if (relacion > UMBRALES.relacionCuotaMax)
    revision.push(`${queCuota} ${pct(relacion)} del ingreso neto (recomendado hasta ${pct(UMBRALES.relacionCuotaMax)}).`);

  if (s.montoCliente > producto.montoMaximo)
    rechazo.push(`El monto cliente supera el máximo del producto (${formatoMoneda(producto.montoMaximo)}).`);

  let decision: Decision;
  let motivos: string[];
  if (rechazo.length) {
    decision = "Rechazado";
    motivos = [...rechazo, ...revision];
  } else if (revision.length) {
    decision = "En revisión";
    motivos = revision;
  } else {
    decision = "Aprobado";
    motivos = [
      `Puntaje de ${puntaje} con riesgo bajo.`,
      `${queCuota} ${pct(relacion)} del ingreso neto, dentro del límite de ${pct(UMBRALES.relacionCuotaMax)}.`,
    ];
  }

  // --- Advertencias (no cambian la decisión) --------------------
  const advertencias: string[] = [];
  if (decision !== "Aprobado" && montoMaximoSugerido > 0 && montoMaximoSugerido < s.montoCliente)
    advertencias.push(`Monto máximo sugerido según capacidad de pago: ${formatoMoneda(montoMaximoSugerido)}.`);

  return {
    fecha: new Date(),
    solicitud: s,
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
