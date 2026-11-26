import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, newRequestKey } from '../api.js';

// UI-04 — Safety confirmation. The reservation is written only after the
// student actively confirms they have safely parked. Cancel writes nothing.
export default function ConfirmParkPage() {
  const { lotId, spotId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // One idempotency key per user intent; retries reuse it so a flaky network
  // can never create a second reservation.
  const requestKeyRef = useRef(newRequestKey());

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api.createReservation(spotId, requestKeyRef.current);
      navigate('/reservation');
    } catch (err) {
      if (err.code === 'SPOT_TAKEN') {
        // Conflict: explain and send the student back to a refreshed list.
        setError(`${err.message} The spot list has been refreshed.`);
        setTimeout(() => navigate(`/lots/${lotId}`), 1800);
      } else if (err.code === 'NETWORK') {
        // Outcome unknown: ask the server what actually happened.
        try {
          const { reservation } = await api.getCurrentReservation();
          if (reservation) {
            navigate('/reservation');
            return;
          }
        } catch {
          /* fall through to retry message */
        }
        setError('Network problem — your reservation may not have been saved. Please try again.');
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>Safety Check</h1>
      <div className="card">
        <p>
          Only continue <strong>after you have parked</strong> and it is safe to use your phone.
        </p>
        <p className="hint">Never use ParkSmart while driving.</p>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <div className="btn-row">
          <button className="btn-primary" onClick={confirm} disabled={busy}>
            {busy ? 'Reserving…' : 'I have safely parked — Reserve spot'}
          </button>
          <Link className="btn btn-secondary" to={`/lots/${lotId}`}>
            Cancel
          </Link>
        </div>
      </div>
    </section>
  );
}
