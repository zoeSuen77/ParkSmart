import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';

// UI-03 — All spots of one lot with text status + an Available-only selector.
export default function SpotsPage() {
  const { lotId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState('');

  const load = useCallback(() => {
    setError(null);
    api
      .getSpots(lotId)
      .then((res) => {
        setData(res);
        setSelected('');
      })
      .catch((err) => setError(err.message));
  }, [lotId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <section>
        <h1>Parking Spots</h1>
        <div className="error-box" role="alert">
          <p>Could not load spots: {error}</p>
          <div className="btn-row">
            <button className="btn-secondary" onClick={load}>
              Retry
            </button>
            <Link className="btn btn-secondary" to="/lots">
              Back to lots
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!data) return <p className="loading">Loading spots…</p>;

  const { lot, spots } = data;
  const available = spots.filter((s) => s.status === 'Available');

  return (
    <section>
      <h1>{lot.name}</h1>
      <p>
        Available: <strong>{lot.availableCount}</strong> / {lot.capacity} spots
      </p>

      {available.length === 0 ? (
        <div className="error-box" role="status">
          <p>This lot is currently Full — no spots are available.</p>
          <Link className="btn btn-secondary" to="/lots">
            Back to lots
          </Link>
        </div>
      ) : (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            if (selected) navigate(`/confirm/${lot.id}/${selected}`);
          }}
        >
          <label htmlFor="spot">Pick an available spot</label>
          <select id="spot" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Select a spot…</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <div className="btn-row">
            <button className="btn-primary" type="submit" disabled={!selected}>
              I parked in this spot
            </button>
          </div>
        </form>
      )}

      <h2>All spots in this lot</h2>
      <div className="spot-grid">
        {spots.map((s) => (
          <div
            key={s.id}
            className={`spot-cell ${s.status === 'Available' ? 'is-available' : 'is-reserved'}`}
          >
            <div className="spot-label">{s.label}</div>
            <div className="spot-status">{s.status}</div>
          </div>
        ))}
      </div>

      <div className="btn-row">
        <Link className="btn btn-secondary" to="/lots">
          Back to lots
        </Link>
      </div>
    </section>
  );
}
