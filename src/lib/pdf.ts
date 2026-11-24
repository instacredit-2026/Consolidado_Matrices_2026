import type { Resultado } from "./calculos";
import { formatoMoneda, formatoPorcentaje } from "./calculos";

const COLOR_DECISION: Record<Resultado["decision"], [number, number, number]> = {
  Aprobado: [75, 157, 69],
  "En revisión": [183, 121, 31],
  Rechazado: [197, 48, 48],
};

// Colores oficiales de marca (ver el :root de src/styles/components-extra.css).
const VERDE: [number, number, number] = [75, 157, 69]; // --ic-primary #4B9D45
const VERDE_OSCURO: [number, number, number] = [6, 37, 91]; // --ic-navy #06255B (títulos)

/** Las fuentes estándar del PDF solo cubren Latin-1: limpiamos caracteres fuera de rango. */
function t(s: string): string {
  return s
    .replace(/[  ]/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

function nombreArchivo(r: Resultado): string {
  const cliente = (r.solicitud.cliente || "cliente")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const f = r.fecha;
  const fecha = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
  return `informe-${cliente || "cliente"}-${fecha}.pdf`;
}

/**
 * @param logo Bytes del logo blanco horizontal en PNG, proporción 640x159 (ver `cargarLogo` en ./logo.ts).
 *             Si falta, el PDF se genera sin logo.
 */
export async function generarPDF(r: Resultado, logo?: Uint8Array): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const ancho = doc.internal.pageSize.getWidth();
  const margen = 15;
  let y = 0;
  const der = (content: string) => ({ content, styles: { halign: "right" as const } });
  // Con importes APC hay una tabla más: se compacta para que el informe siga cabiendo en una página.
  const compacto = r.importesApc.length > 0;
  const estiloTabla = { fontSize: compacto ? 9 : 9.5, cellPadding: compacto ? 0.8 : 1.5 };
  const separacion = compacto ? 5 : 7;
  const finalY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // --- Encabezado ---------------------------------------------
  doc.setFillColor(...VERDE);
  doc.rect(0, 0, ancho, 24, "F");
  const xTitulo = margen;
  if (logo) {
    // Logo oficial (versión blanca) alineado a la derecha de la banda verde.
    const altoLogo = 11;
    const anchoLogo = altoLogo * (640 / 159);
    doc.addImage(logo, "PNG", ancho - margen - anchoLogo, (24 - altoLogo) / 2, anchoLogo, altoLogo, "logo", "FAST");
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(t("Informe de evaluación de solicitud"), xTitulo, 11.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    t(`Generado el ${r.fecha.toLocaleDateString("es")} a las ${r.fecha.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`),
    xTitulo,
    18.5,
  );
  y = 32;

  const titulo = (texto: string) => {
    doc.setTextColor(...VERDE_OSCURO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(t(texto), margen, y);
    y += 2;
  };

  const tablaClaveValor = (filas: [string, string][]) => {
    autoTable(doc, {
      startY: y,
      margin: { left: margen, right: margen },
      body: filas.map(([k, v]) => [t(k), t(v)]),
      theme: "grid",
      styles: estiloTabla,
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 65, fillColor: [247, 248, 250] } },
    });
    y = finalY() + separacion;
  };

  const GRIS: [number, number, number] = [247, 248, 250];

  // --- Datos del cliente ----------------------------------------
  // Dos pares etiqueta-valor por renglón para que ocupe la mitad de alto.
  titulo("Datos del cliente");
  const anchoEtiqueta = 44;
  autoTable(doc, {
    startY: y,
    margin: { left: margen, right: margen },
    body: [
      ["Nombre", r.solicitud.cliente || "-", "Identificación", r.solicitud.identificacion || "-"],
      ["Teléfono", r.solicitud.telefono || "-", "Correo", r.solicitud.correo || "-"],
      [
        "Saldo actual",
        formatoMoneda(r.solicitud.saldoActual),
        "Promotor independiente",
        r.solicitud.promotorIndependiente === "si" ? "Sí" : "No",
      ],
    ].map((fila) => fila.map(t)),
    theme: "grid",
    styles: estiloTabla,
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: anchoEtiqueta, fillColor: GRIS },
      2: { fontStyle: "bold", cellWidth: anchoEtiqueta, fillColor: GRIS },
    },
  });
  y = finalY() + separacion;

  // --- Ingresos (mensual) ---------------------------------------
  // Ingreso bruto, un renglón por cada descuento de ley, el total de descuentos y el neto.
  titulo("Ingresos (mensual)");
  const n = r.ingreso.descuentos.length;
  autoTable(doc, {
    startY: y,
    margin: { left: margen, right: margen },
    body: [
      ["Ingreso bruto", formatoMoneda(r.ingreso.bruto)],
      ...r.ingreso.descuentos.map((d) => [`(-) ${d.concepto}`, formatoMoneda(d.monto)]),
      ["Total descuentos de ley", formatoMoneda(r.ingreso.totalDescuentos)],
      ["Ingreso neto", formatoMoneda(r.ingreso.neto)],
    ].map((fila) => fila.map(t)),
    theme: "grid",
    styles: estiloTabla,
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 65, fillColor: GRIS },
      1: { halign: "right" },
    },
    didParseCell: (d) => {
      if (d.section !== "body") return;
      if (d.row.index >= n + 1) d.cell.styles.fontStyle = "bold"; // total y neto
      if (d.row.index === n + 2) d.cell.styles.fillColor = [230, 242, 224]; // neto
    },
  });
  y = finalY() + separacion;

  // --- Criterios evaluados ------------------------------------
  titulo("Criterios evaluados");
  autoTable(doc, {
    startY: y,
    margin: { left: margen, right: margen },
    head: [["Criterio", t("Selección"), der("Puntos"), der(t("Máximo"))]],
    body: r.detalle.map((d) => [t(d.titulo), t(d.opcion), String(d.puntos), String(d.maximo)]),
    foot: [["Total", "", der(String(r.puntaje)), der(String(r.puntajeMaximo))]],
    theme: "grid",
    styles: estiloTabla,
    headStyles: { fillColor: VERDE },
    footStyles: { fillColor: [230, 242, 224], textColor: 20 },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
  });
  y = finalY() + separacion;

  // --- Importes APC (solo si hay) -----------------------------
  if (r.importesApc.length) {
    titulo("Importes APC");
    autoTable(doc, {
      startY: y,
      margin: { left: margen, right: margen },
      head: [["Detalle", der("Importe APC"), der("Importe final a considerar")]],
      body: r.importesApc.map((f) => [t(f.etiqueta), formatoMoneda(f.monto), formatoMoneda(f.importeFinal)]),
      foot: [["Total", "", der(formatoMoneda(r.totalApc))]],
      theme: "grid",
      styles: estiloTabla,
      headStyles: { fillColor: VERDE },
      footStyles: { fillColor: [230, 242, 224], textColor: 20 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    });
    y = finalY() + separacion;
  }

  // --- Análisis financiero ------------------------------------
  titulo("Análisis financiero");
  tablaClaveValor([
    ["Producto", r.producto.etiqueta],
    ["Tasa de interés anual", formatoPorcentaje(r.producto.tasaAnual, 2)],
    ["Plazo", `${r.producto.plazoMeses} meses`],
    ["Monto cliente", formatoMoneda(r.solicitud.montoCliente)],
    ["Monto a entregar", formatoMoneda(r.montoAEntregar)],
    ["Cuota mensual estimada", formatoMoneda(r.cuotaMensual)],
    ["Total a pagar", formatoMoneda(r.totalAPagar)],
    ...(r.totalApc > 0 ? ([["Importes APC (mensual)", formatoMoneda(r.totalApc)]] as [string, string][]) : []),
    [
      r.totalApc > 0 ? "Relación (cuota + APC) / ingreso neto" : "Relación cuota / ingreso neto",
      formatoPorcentaje(r.relacionCuotaIngreso),
    ],
    ["Monto máximo sugerido", formatoMoneda(r.montoMaximoSugerido)],
    ["Monto máximo del producto", formatoMoneda(r.producto.montoMaximo)],
  ]);

  // --- Resultado ----------------------------------------------
  doc.setFontSize(10);
  // Alto exacto del bloque: título (4) + banner (21) + por cada lista: encabezado (5) + líneas × 5 + espacio (3).
  const altoLista = (items: string[]) =>
    items.length
      ? 5 + items.reduce((n, m) => n + doc.splitTextToSize(t(`- ${m}`), ancho - margen * 2 - 4).length, 0) * 5 + 3
      : 0;
  const altoResultado = 4 + 21 + altoLista(r.motivos) + altoLista(r.advertencias);
  // El pie empieza 14 mm antes del borde inferior.
  if (y + altoResultado > doc.internal.pageSize.getHeight() - 16) {
    doc.addPage();
    y = 20;
  }
  titulo("Resultado");
  y += 2;
  const color = COLOR_DECISION[r.decision];
  doc.setFillColor(...color);
  doc.roundedRect(margen, y, ancho - margen * 2, 14, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(t(`DECISIÓN: ${r.decision.toUpperCase()}`), margen + 5, y + 9);
  doc.setFontSize(11);
  doc.text(
    t(`Puntaje ${r.puntaje}/${r.puntajeMaximo}  |  Riesgo ${r.nivelRiesgo}`),
    ancho - margen - 5,
    y + 9,
    { align: "right" },
  );
  y += 21;

  const lista = (encabezado: string, items: string[]) => {
    if (!items.length) return;
    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(t(encabezado), margen, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    for (const item of items) {
      const lineas = doc.splitTextToSize(t(`- ${item}`), ancho - margen * 2 - 4);
      doc.text(lineas, margen + 2, y);
      y += lineas.length * 5;
    }
    y += 3;
  };
  lista("Motivos:", r.motivos);
  lista("Observaciones:", r.advertencias);

  // --- Pie de página ------------------------------------------
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    const alto = doc.internal.pageSize.getHeight();
    doc.setDrawColor(200, 200, 200);
    doc.line(margen, alto - 14, ancho - margen, alto - 14);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(t("Documento generado automáticamente. Resultado orientativo sujeto a verificación."), margen, alto - 9);
    doc.text(`${i} / ${paginas}`, ancho - margen, alto - 9, { align: "right" });
  }

  doc.save(nombreArchivo(r));
}
