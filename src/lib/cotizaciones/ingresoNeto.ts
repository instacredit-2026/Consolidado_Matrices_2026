/**
 * INGRESO NETO
 * ---------------------------------------------------------------
 * El usuario solo ingresa el ingreso bruto mensual; el neto se calcula.
 * Por defecto se aplican los descuentos de ley de Panamá. Cada tipo de
 * cotización elige su función en su archivo (pv.ts, dd.ts…), así que se
 * puede cambiar la fórmula de un tipo sin tocar los demás:
 *   - ajustando los valores con `crearIngresoNetoPanama({ ... })`, o
 *   - escribiendo una función propia con la forma `CalculoIngresoNeto`.
 */

export type DescuentoIngreso = { concepto: string; monto: number };

export type DesgloseIngreso = {
  bruto: number;
  descuentos: DescuentoIngreso[];
  totalDescuentos: number;
  neto: number;
};

/** Calcula el desglose del ingreso a partir del bruto mensual. */
export type CalculoIngresoNeto = (brutoMensual: number) => DesgloseIngreso;

/** Tramo del impuesto sobre la renta (montos anuales). */
export type TramoIsr = {
  /** Renta anual desde la que aplica el tramo. */
  desde: number;
  /** Tasa sobre el excedente de `desde`. */
  tasa: number;
  /** Impuesto fijo acumulado de los tramos anteriores. */
  fijo: number;
};

export type ParametrosDescuentosPanama = {
  /** Cuota obrera de la Caja de Seguro Social. */
  seguroSocial: number;
  /** Seguro educativo. */
  seguroEducativo: number;
  /** Meses con que se proyecta la renta anual (12 salarios + décimo tercer mes). */
  mesesAnio: number;
  /** Tramos del ISR, de menor a mayor. Por debajo del primero está exento. */
  tramosIsr: TramoIsr[];
};

/** Descuentos de ley de Panamá para asalariados. */
export const DESCUENTOS_PANAMA: ParametrosDescuentosPanama = {
  seguroSocial: 0.0975,
  seguroEducativo: 0.0125,
  mesesAnio: 13,
  tramosIsr: [
    { desde: 11000, tasa: 0.15, fijo: 0 },
    { desde: 50000, tasa: 0.25, fijo: 5850 },
  ],
};

const redondear = (n: number) => Math.round(n * 100) / 100;

/** ISR anual según los tramos. */
export function isrAnual(rentaAnual: number, tramos: TramoIsr[]): number {
  const tramo = [...tramos].reverse().find((t) => rentaAnual > t.desde);
  return tramo ? tramo.fijo + (rentaAnual - tramo.desde) * tramo.tasa : 0;
}

/** Crea el cálculo con descuentos de ley de Panamá; se pueden cambiar los valores. */
export function crearIngresoNetoPanama(cambios: Partial<ParametrosDescuentosPanama> = {}): CalculoIngresoNeto {
  const p = { ...DESCUENTOS_PANAMA, ...cambios };
  return (bruto) => {
    const b = bruto > 0 ? bruto : 0;
    // ISR mensual: renta proyectada a 13 meses, impuesto anual dividido entre 13.
    const isr = isrAnual(b * p.mesesAnio, p.tramosIsr) / p.mesesAnio;
    const descuentos: DescuentoIngreso[] = [
      { concepto: `Seguro social (${+(p.seguroSocial * 100).toFixed(2)} %)`, monto: redondear(b * p.seguroSocial) },
      { concepto: `Seguro educativo (${+(p.seguroEducativo * 100).toFixed(2)} %)`, monto: redondear(b * p.seguroEducativo) },
      { concepto: "Impuesto sobre la renta", monto: redondear(isr) },
    ];
    const totalDescuentos = redondear(descuentos.reduce((acc, d) => acc + d.monto, 0));
    return { bruto: b, descuentos, totalDescuentos, neto: redondear(b - totalDescuentos) };
  };
}

/** Cálculo por defecto: descuentos de ley de Panamá. */
export const ingresoNetoPanama = crearIngresoNetoPanama();
