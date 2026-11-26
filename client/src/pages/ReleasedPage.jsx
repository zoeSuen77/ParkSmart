import { Link, useLocation } from 'react-router-dom';

// UI-07 — Release result, with a link back to the lot list.
export default function ReleasedPage() {
  const location = useLocation();
  const reservation = location.state?.reservation;

  return (
    <section>
      <h1>Spot Released</h1>
      <div className="card">
        <p className="success-box" role="status">
          Your spot has been released and is available again.
        </p>
        {reservation && (
          <>
            <div className="detail-row">
              <span className="k">Parking lot</span>
              <span>{reservation.lot?.name}</span>
            </div>
            <div className="detail-row">
              <span className="k">Spot</span>
              <span>{reservation.spot?.label}</span>
            </div>
          </>
        )}
        <p className="hint">Thanks for keeping ParkSmart availability accurate.</p>
        <div className="btn-row">
          <Link className="btn btn-primary" to="/lots">
            Back to parking lots
          </Link>
        </div>
      </div>
    </section>
  );
}
