"use client";

import { formatoMoneda, formatoPorcentaje, type Oferta, type Resultado as R } from "@/lib/calculos";

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="ic-stat">
      <dt className="ic-stat__label">{etiqueta}</dt>
      <dd className="ic-stat__value">{valor}</dd>
    </div>
  );
}

/** Rango de score APC del producto, si la matriz lo define. */
function rangoScore(o: Oferta): string | null {
  const { scoreMin, scoreMax } = o.producto;
  if (scoreMin === null) return null;
  return scoreMax === null ? `Score ${scoreMin}+` : `Score ${scoreMin}–${scoreMax}`;
}

export default function Resultado({ r }: { r: R }) {
  const { sugerida, categoria } = r;
  const plazo = r.solicitud.plazo;

  return (
    <div aria-live="polite" className="ic-stack ic-result">
      {/* ---- Categorización ---- */}
      <section className="ic-categoria" aria-labelledby="categoria-titulo">
        <p id="categoria-titulo" className="ic-hero-stat__label">Categorización del cliente</p>
        {categoria ? (
          <>
            <p className="ic-categoria__perfil">{categoria.perfil}</p>
            <p className="ic-categoria__rango">
              <span className="ic-badge ic-badge--info">Rango {categoria.rangoIngreso}</span>
              <span>Ingreso neto {formatoMoneda(r.ingreso.neto)}</span>
            </p>
          </>
        ) : (
          <p className="ic-categoria__rango">
            Sin categoría: ningún producto a {plazo} meses cubre un ingreso neto de {formatoMoneda(r.ingreso.neto)}.
          </p>
        )}
      </section>

      {/* ---- Producto sugerido ---- */}
      {sugerida ? (
        <div className="ic-hero-stat ic-sugerencia">
          <p className="ic-hero-stat__label">Producto sugerido</p>
          <p className="ic-sugerencia__nombre">{sugerida.producto.etiqueta}</p>
          <p className="ic-note">
            Tasa {formatoPorcentaje(sugerida.producto.tasaAnual, 2)} anual · {sugerida.producto.plazoMeses} meses
            {rangoScore(sugerida) && <> · {rangoScore(sugerida)}</>}
          </p>
          <p className="ic-hero-stat__label ic-mt-4">Cuota mensual</p>
          <p className="ic-hero-stat__value">{formatoMoneda(sugerida.cuotaMensual)}</p>
        </div>
      ) : (
        <div role="alert" className="ic-alert ic-alert--warning">
          <p className="ic-alert__title">No hay un producto para ofrecer con estos datos.</p>
          {r.alternativas.length ? (
            <p>
              Hay productos para este ingreso y plazo, pero ninguno cubre el monto pedido. Revisa los motivos abajo o
              baja el monto al máximo sugerido.
            </p>
          ) : (
            <p>Prueba con otro plazo o revisa el ingreso bruto.</p>
          )}
        </div>
      )}

      <dl className="ic-stats">
        <Dato etiqueta="Monto cliente" valor={formatoMoneda(r.solicitud.montoCliente)} />
        <Dato etiqueta="Saldo actual" valor={formatoMoneda(r.solicitud.saldoActual)} />
        <Dato etiqueta="A entregar" valor={formatoMoneda(r.montoAEntregar)} />
      </dl>

      {sugerida && (
        <dl className="ic-stats">
          <Dato etiqueta="Cuota / ingreso neto" valor={formatoPorcentaje(sugerida.relacionCuotaIngreso)} />
          <Dato etiqueta="Monto máx. sugerido" valor={formatoMoneda(sugerida.montoMaximoSugerido)} />
          <Dato etiqueta="Total a pagar" valor={formatoMoneda(sugerida.totalAPagar)} />
        </dl>
      )}

      {/* ---- Otras opciones del mismo rango y plazo ---- */}
      {r.alternativas.length > 0 && (
        <div>
          <p className="ic-hero-stat__label ic-alternativas__titulo">
            {sugerida ? "Otras opciones" : "Productos de su rango"} ({r.alternativas.length})
          </p>
          <div className="ic-table-wrap ic-table-wrap--flat">
            <table className="ic-table ic-table--compact">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="ic-table__num">Tasa</th>
                  <th className="ic-table__num">Cuota</th>
                  <th className="ic-table__num">Máx. sugerido</th>
                </tr>
              </thead>
              <tbody>
                {r.alternativas.map((o) => (
                  <tr key={o.producto.id}>
                    <td>
                      {o.producto.etiqueta}
                      {rangoScore(o) && <span className="ic-note"> · {rangoScore(o)}</span>}
                      {o.impedimentos.map((m) => (
                        <span key={m} className="ic-oferta__motivo">{m}</span>
                      ))}
                    </td>
                    <td className="ic-table__num">{formatoPorcentaje(o.producto.tasaAnual, 2)}</td>
                    <td className="ic-table__num">{formatoMoneda(o.cuotaMensual)}</td>
                    <td className="ic-table__num">{formatoMoneda(o.montoMaximoSugerido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
