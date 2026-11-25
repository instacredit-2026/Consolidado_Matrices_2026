"use client";

import { useEffect, useState } from "react";
import { formatoMoneda, formatoPorcentaje, type Resultado as R } from "@/lib/calculos";

type Tono = "success" | "warning" | "danger";

const TONO_RIESGO: Record<R["nivelRiesgo"], Tono> = {
  Bajo: "success",
  Medio: "warning",
  Alto: "danger",
};

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="ic-stat">
      <dt className="ic-stat__label">{etiqueta}</dt>
      <dd className="ic-stat__value">{valor}</dd>
    </div>
  );
}

export default function Resultado({ r }: { r: R }) {
  const [lleno, setLleno] = useState(false);

  // Dos frames: el primero pinta la barra vacía, el segundo dispara el llenado.
  useEffect(() => {
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => setLleno(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const pos = (puntos: number) => `${(puntos / r.puntajeMaximo) * 100}%`;

  return (
    <div aria-live="polite" className="ic-stack ic-result">
      <div>
        <div className="ic-meter__head">
          <span>Puntaje · Riesgo {r.nivelRiesgo.toLowerCase()}</span>
          <strong>{r.puntaje} / {r.puntajeMaximo}</strong>
        </div>
        <div
          className="ic-meter__track"
          role="meter"
          aria-label="Puntaje"
          aria-valuemin={0}
          aria-valuemax={r.puntajeMaximo}
          aria-valuenow={r.puntaje}
        >
          <div
            className={`ic-meter__bar ic-meter__bar--${TONO_RIESGO[r.nivelRiesgo]} ic-meter__bar--fill`}
            style={{ width: lleno ? pos(r.puntaje) : "0%" }}
          />
          <div className="ic-meter__mark" style={{ left: pos(r.parametros.riesgoMedio) }} title="Mínimo riesgo medio" />
          <div className="ic-meter__mark" style={{ left: pos(r.parametros.riesgoBajo) }} title="Mínimo riesgo bajo" />
        </div>
        <div className="ic-meter__scale" aria-hidden="true">
          <span style={{ left: pos(r.parametros.riesgoMedio) }}>{r.parametros.riesgoMedio}</span>
          <span style={{ left: pos(r.parametros.riesgoBajo) }}>{r.parametros.riesgoBajo}</span>
        </div>
      </div>

      <div className="ic-hero-stat">
        <p className="ic-hero-stat__label">Cuota mensual</p>
        <p className="ic-hero-stat__value">{formatoMoneda(r.cuotaMensual)}</p>
        <p className="ic-note">
          {r.producto.etiqueta} · tasa {formatoPorcentaje(r.producto.tasaAnual, 2)} anual · {r.producto.plazoMeses} meses
        </p>
      </div>

      <dl className="ic-stats">
        <Dato etiqueta="Monto cliente" valor={formatoMoneda(r.solicitud.montoCliente)} />
        <Dato etiqueta="Saldo actual" valor={formatoMoneda(r.solicitud.saldoActual)} />
        <Dato etiqueta="A entregar" valor={formatoMoneda(r.montoAEntregar)} />
      </dl>

      <dl className="ic-stats">
        <Dato etiqueta="Ingreso neto" valor={formatoMoneda(r.ingreso.neto)} />
        <Dato etiqueta="Cuota / ingreso neto" valor={formatoPorcentaje(r.relacionCuotaIngreso)} />
        <Dato etiqueta="Monto máx. sugerido" valor={formatoMoneda(r.montoMaximoSugerido)} />
        <Dato etiqueta="Total a pagar" valor={formatoMoneda(r.totalAPagar)} />
      </dl>

      <div className="ic-table-wrap ic-table-wrap--flat">
        <table className="ic-table ic-table--compact">
          <thead>
            <tr>
              <th>Criterio</th>
              <th>Selección</th>
              <th className="ic-table__num">Puntos</th>
            </tr>
          </thead>
          <tbody>
            {r.detalle.map((d) => (
              <tr key={d.titulo}>
                <td>{d.titulo}</td>
                <td>{d.opcion}</td>
                <td className="ic-table__num">{d.puntos}/{d.maximo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
