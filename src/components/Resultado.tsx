"use client";

import { useEffect, useState } from "react";
import { formatoMoneda, formatoPorcentaje, type Resultado as R } from "@/lib/calculos";
import { cargarLogo } from "@/lib/logo";
import { generarPDF } from "@/lib/pdf";

type Tono = "success" | "warning" | "danger";

const TONO_DECISION: Record<R["decision"], Tono> = {
  Aprobado: "success",
  "En revisión": "warning",
  Rechazado: "danger",
};

const TONO_RIESGO: Record<R["nivelRiesgo"], Tono> = {
  Bajo: "success",
  Medio: "warning",
  Alto: "danger",
};

const ICONO_DECISION: Record<R["decision"], string> = {
  Aprobado: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  "En revisión":
    "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z",
  Rechazado:
    "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
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
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");
  const [lleno, setLleno] = useState(false);

  // Dos frames: el primero pinta la barra vacía, el segundo dispara el llenado.
  useEffect(() => {
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => setLleno(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const descargar = async () => {
    setGenerando(true);
    setError("");
    try {
      await generarPDF(r, await cargarLogo());
    } catch (e) {
      console.error(e);
      setError("No se pudo generar el PDF. Intenta de nuevo.");
    } finally {
      setGenerando(false);
    }
  };

  const pos = (puntos: number) => `${(puntos / r.puntajeMaximo) * 100}%`;
  const tono = TONO_DECISION[r.decision];

  return (
    <div aria-live="polite" className="ic-stack ic-result">
      <div className={`ic-decision ic-decision--${tono}`}>
        <span className="ic-decision__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d={ICONO_DECISION[r.decision]} />
          </svg>
        </span>
        <div>
          <p className="ic-decision__label">{r.decision}</p>
          <p className="ic-decision__risk">
            Riesgo {r.nivelRiesgo.toLowerCase()} · {r.puntaje} de {r.puntajeMaximo} puntos
          </p>
        </div>
      </div>

      <div>
        <div className="ic-meter__head">
          <span>Puntaje</span>
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
        {r.totalApc > 0 && <Dato etiqueta="Importes APC" valor={formatoMoneda(r.totalApc)} />}
        <Dato
          etiqueta={r.totalApc > 0 ? "(Cuota + APC) / ingreso" : "Cuota / ingreso neto"}
          valor={formatoPorcentaje(r.relacionCuotaIngreso)}
        />
        <Dato etiqueta="Monto máx. sugerido" valor={formatoMoneda(r.montoMaximoSugerido)} />
        <Dato etiqueta="Total a pagar" valor={formatoMoneda(r.totalAPagar)} />
      </dl>

      <div className={`ic-alert ic-alert--${tono}`}>
        <p className="ic-alert__title">Motivos</p>
        <ul className="ic-list">
          {r.motivos.map((m) => <li key={m}>{m}</li>)}
        </ul>
      </div>

      {r.advertencias.length > 0 && (
        <div className="ic-alert ic-alert--warning">
          <p className="ic-alert__title">Observaciones</p>
          <ul className="ic-list">
            {r.advertencias.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      )}

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

      <button
        type="button"
        onClick={descargar}
        disabled={generando}
        aria-busy={generando}
        className="ic-btn ic-btn--primary ic-btn--block ic-btn--lg"
      >
        {generando ? (
          <span className="ic-spinner" aria-hidden="true" />
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
          </svg>
        )}
        {generando ? "Generando…" : "Generar Informe PDF"}
      </button>
      {error && <div role="alert" className="ic-alert ic-alert--danger ic-appear">{error}</div>}
    </div>
  );
}
