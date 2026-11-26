import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

// UI-05 — Reservation details, restored from the server on every visit
// (refresh-safe). Read-only: it never changes state or counts.
export default function ReservationPage() {
  const [reservation, setReservation] = useState(undefined);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    api
      .getCurrentReservation()
      .then(({ reservation }) => setReservation(reservation))
      .catch((err) => {
        setReservation(undefined);
        setError(err.message);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <section>
        <h1>My Reservation</h1>
        <div className="error-box" role="alert">
          <p>Could not load your reservation: {error}</p>
          <button className="btn-secondary" onClick={load}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (reservation === undefined) return <p className="loading">Loading reservation…</p>;

  if (reservation === null) {
    return (
      <section>
        <h1>My Reservation</h1>
        <div className="card empty-state">
          <p>You have no active reservation.</p>
          <Link className="btn btn-primary" to="/lots">
            Find parking
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h1>My Reservation</h1>
      <div className="card">
        <p>
          <span className="status-pill status-active">{reservation.status}</span>
        </p>
        <div className="detail-row">
          <span className="k">Parking lot</span>
          <span>{reservation.lot?.name ?? 'Unknown'}</span>
        </div>
        <div className="detail-row">
          <span className="k">Spot</span>
          <span>{reservation.spot?.label ?? 'Unknown'}</span>
        </div>
        <div className="detail-row">
          <span className="k">License plate</span>
          <span>{reservation.plate}</span>
        </div>
        <div className="detail-row">
          <span className="k">Reserved at</span>
          <span>{new Date(reservation.createdAt).toLocaleString()}</span>
        </div>
        <div className="btn-row">
          <Link className="btn btn-danger" to={`/release/${reservation.id}`}>
            Release this spot
          </Link>
          <Link className="btn btn-secondary" to="/lots">
            Back to lots
          </Link>
        </div>
      </div>
    </section>
  );
}
