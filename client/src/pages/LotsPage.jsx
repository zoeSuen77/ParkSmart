import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const STATUS_CLASS = {
  Available: 'status-available',
  Limited: 'status-limited',
  Full: 'status-full',
  Unknown: 'status-unknown',
};

// UI-02 — Campus map + list of all commuter lots with reported status.
export default function LotsPage() {
  const [lots, setLots] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    api
      .getLots()
      .then(({ lots }) => setLots(lots))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh counts whenever the page regains focus (e.g. after a release).
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  return (
    <section>
      <h1>Commuter Parking Lots</h1>

      <div className="card map-wrap" aria-label="Campus map schematic">
        <svg viewBox="0 0 320 180" role="img" aria-label="Schematic campus map with three parking quads">
          <rect x="0" y="0" width="320" height="180" rx="10" fill="#e8ecf1" />
          <rect x="20" y="20" width="120" height="60" rx="8" fill="#46166b" />
          <text x="80" y="55" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">
            Dutch Quad
          </text>
          <rect x="180" y="20" width="120" height="60" rx="8" fill="#46166b" />
          <text x="240" y="55" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">
            State Quad
          </text>
          <rect x="100" y="105" width="120" height="60" rx="8" fill="#46166b" />
          <text x="160" y="140" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">
            Colonial Quad
          </text>
        </svg>
        <p className="hint">Schematic map — tap a lot below to see its spots.</p>
      </div>

      {error && (
        <div className="error-box" role="alert">
          <p>Could not load parking lots: {error}</p>
          <button className="btn-secondary" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {!error && lots === null && <p className="loading">Loading parking lots…</p>}

      {!error && lots !== null && lots.length === 0 && (
        <p className="empty-state">No commuter parking lots are in the system yet. Please check back later.</p>
      )}

      {lots?.map((lot) => (
        <Link key={lot.id} to={`/lots/${lot.id}`} className="card lot-card">
          <div className="lot-head">
            <span className="lot-name">{lot.name}</span>
            <span className={`status-pill ${STATUS_CLASS[lot.status]}`}>{lot.status}</span>
          </div>
          <p className="counts">
            {lot.availableCount === null ? (
              <>Availability: <strong>Unknown</strong></>
            ) : (
              <>
                Available: <strong>{lot.availableCount}</strong> / {lot.capacity} spots
              </>
            )}
          </p>
        </Link>
      ))}
    </section>
  );
}
