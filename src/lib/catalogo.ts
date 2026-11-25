import type { CodigoTipoCotizacion, Producto, TipoCotizacion } from "@/config/matriz";
import { supabase } from "@/lib/supabase";

type FilaTipo = {
  codigo: string;
  descripcion: string;
  relacion_cuota_ingreso: number | null;
};

type FilaProducto = {
  id: number;
  nombre: string;
  plazo: number | null;
  tasa: number;
  monto_al_cliente: number;
  monto_pagare: number;
  comision_desembolso: number;
  seguro: number;
  nivel_endeudamiento: number | null;
  score_min: number | null;
  score_max: number | null;
  perfil: { nombre: string; tipo_cotizacion: string };
  rango_ingreso: { minimo: number; maximo: number | null; etiqueta_original: string };
};

/** Orden de la pantalla de selección; los códigos que no estén aquí van al final, por orden alfabético. */
const ORDEN_TIPOS = ["PV", "DD", "EP", "PYME"];
const posicion = (c: string) => {
  const i = ORDEN_TIPOS.indexOf(c);
  return i === -1 ? ORDEN_TIPOS.length : i;
};

/** Tabla `tipo_cotizacion`. */
export async function cargarTiposCotizacion(): Promise<TipoCotizacion[]> {
  const { data, error } = await supabase()
    .from("tipo_cotizacion")
    .select("codigo, descripcion, relacion_cuota_ingreso");
  if (error) throw error;
  return (data as FilaTipo[])
    .map((f) => ({
      codigo: f.codigo,
      descripcion: f.descripcion,
      relacionCuotaIngreso: f.relacion_cuota_ingreso === null ? null : Number(f.relacion_cuota_ingreso),
    }))
    .sort((a, b) => posicion(a.codigo) - posicion(b.codigo) || a.codigo.localeCompare(b.codigo));
}

const numONulo = (v: number | null) => (v === null ? null : Number(v));

/** Tabla `producto_credito`, solo los productos cuyo perfil pertenece al tipo de cotización indicado. */
export async function cargarProductos(tipo: CodigoTipoCotizacion): Promise<Producto[]> {
  const { data, error } = await supabase()
    .from("producto_credito")
    .select(
      "id, nombre, plazo, tasa, monto_al_cliente, monto_pagare, comision_desembolso, seguro, " +
        "nivel_endeudamiento, score_min, score_max, perfil!inner(nombre, tipo_cotizacion), " +
        "rango_ingreso!inner(minimo, maximo, etiqueta_original)",
    )
    .eq("perfil.tipo_cotizacion", tipo)
    .order("id");
  if (error) throw error;
  return (data as unknown as FilaProducto[]).map((f) => ({
    id: String(f.id),
    etiqueta: f.nombre,
    perfil: f.perfil.nombre,
    ingresoMinimo: Number(f.rango_ingreso.minimo),
    ingresoMaximo: numONulo(f.rango_ingreso.maximo),
    rangoIngreso: f.rango_ingreso.etiqueta_original,
    // numeric de Postgres puede llegar como texto: se normaliza a number.
    tasaAnual: Number(f.tasa),
    plazoMeses: numONulo(f.plazo),
    montoMaximo: Number(f.monto_al_cliente),
    montoPagare: Number(f.monto_pagare),
    comisionDesembolso: Number(f.comision_desembolso),
    seguro: Number(f.seguro),
    nivelEndeudamiento: numONulo(f.nivel_endeudamiento),
    scoreMin: numONulo(f.score_min),
    scoreMax: numONulo(f.score_max),
  }));
}
