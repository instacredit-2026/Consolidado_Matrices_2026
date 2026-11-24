import logoClaro from "@/assets/marca/logo-claro.png";

/** Descarga el logo oficial (versión blanca, PNG) para incrustarlo en el PDF. Devuelve undefined si falla. */
export async function cargarLogo(): Promise<Uint8Array | undefined> {
  try {
    const res = await fetch(logoClaro.src);
    if (!res.ok) return undefined;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return undefined;
  }
}
