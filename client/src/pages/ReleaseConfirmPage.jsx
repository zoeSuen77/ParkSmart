import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';

// UI-06 — Release confirmation. Names the lot and spot being released;
// Cancel keeps the reservation untouched.
export default function ReleaseConfirmPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reservation, setReservation] = useState(undefined);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .getCurrentReservation()
      .then(({ reservation }) => setReservation(reservation))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function release() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.releaseReservation(id);
      navigate(`/released/${id}`, { state: { reservation: result.reservation } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (reservation === undefined && !error) return <p className="loading">Loading…</p>;

  return (
    <section>
      <h1>Release Spot</h1>
      <div className="card">
        {reservation ? (
          <p>
            You are about to release spot <strong>{reservation.spot?.label}</strong> at{' '}
            <strong>{reservation.lot?.name}</strong>. The spot becomes available to other students
            right away.
          </p>
        ) : (
          <p>No active reservation was found for this session.</p>
        )}
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <div className="btn-row">
          {reservation && (
            <button className="btn-danger" onClick={release} disabled={busy}>
              {busy ? 'Releasing…' : 'Yes, release my spot'}
            </button>
          )}
          <Link className="btn btn-secondary" to="/reservation">
            Cancel — keep my spot
          </Link>
        </div>
      </div>
    </section>
  );
}
