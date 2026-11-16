"use client";

import type { CodigoTipoCotizacion, TipoCotizacion } from "@/config/matriz";

type Props = {
  /** Tipos cargados de la tabla tipo_cotizacion (null mientras carga). */
  tipos: TipoCotizacion[] | null;
  /** Mensaje si la carga falló. */
  error: string;
  onReintentar: () => void;
  /** Tipo ya elegido, si el usuario volvió a esta pantalla para cambiarlo. */
  actual: CodigoTipoCotizacion | null;
  onElegir: (codigo: CodigoTipoCotizacion) => void;
  /** Vuelve a la evaluación sin cambiar el tipo. Solo aplica si ya hay uno elegido. */
  onCancelar: () => void;
};

/** Pantalla previa a la evaluación: el usuario elige qué tipo de cotización va a realizar. */
export default function SelectorTipoCotizacion({ tipos, error, onReintentar, actual, onElegir, onCancelar }: Props) {
  if (error) {
    return (
      <div role="alert" className="ic-alert ic-alert--danger">
        <p className="ic-alert__title">No se pudieron cargar los tipos de cotización.</p>
        <p>{error}</p>
        <button type="button" className="ic-btn ic-btn--ghost ic-btn--sm" onClick={onReintentar}>
          Reintentar
        </button>
      </div>
    );
  }

  if (!tipos) {
    return (
      <div role="status" aria-live="polite">
        <span className="ic-spinner" aria-hidden="true" /> Cargando tipos de cotización…
      </div>
    );
  }

  if (!tipos.length) {
    return <div className="ic-alert ic-alert--warning">No hay tipos de cotización configurados.</div>;
  }

  return (
    <>
      <ul className="ic-choice-grid">
        {tipos.map((t) => {
          const esActual = t.codigo === actual;
          return (
            <li key={t.codigo}>
              <button
                type="button"
                className={`ic-choice${esActual ? " ic-choice--current" : ""}`}
                aria-current={esActual || undefined}
                onClick={() => onElegir(t.codigo)}
              >
                <span className="ic-choice__code">{t.codigo}</span>
                <span className="ic-choice__text">
                  <span className="ic-choice__title">{t.descripcion}</span>
                  {esActual && <span className="ic-note">Selección actual</span>}
                </span>
                <svg className="ic-choice__chevron" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>

      {actual && (
        <div className="ic-choice-actions">
          <button type="button" className="ic-btn ic-btn--ghost" onClick={onCancelar}>
            Volver a la evaluación
          </button>
        </div>
      )}
    </>
  );
}
