import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

// UI-01 — License plate entry, validation and confirmation.
export default function PlatePage() {
  const [input, setInput] = useState('');
  const [savedPlate, setSavedPlate] = useState(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getSession()
      .then(({ plate }) => {
        if (plate) setSavedPlate(plate);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const candidate = input.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(candidate)) {
      // Keep the user's input so they can fix it.
      setError('Plates must be 2-8 letters or digits (example: ABC123). Spaces and symbols are not allowed.');
      return;
    }
    setBusy(true);
    try {
      const { plate } = await api.savePlate(candidate);
      setSavedPlate(plate);
      setEditing(false);
      setInput('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="loading">Loading…</p>;

  return (
    <section>
      <h1>Your License Plate</h1>

      {savedPlate && !editing ? (
        <div className="card">
          <p>
            Saved plate: <strong>{savedPlate}</strong>
          </p>
          <p className="hint">Check that this matches your vehicle before reserving a spot.</p>
          <div className="btn-row">
            <button className="btn-primary" onClick={() => navigate('/lots')}>
              Looks right — Find parking
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setEditing(true);
                setInput(savedPlate);
              }}
            >
              Edit plate
            </button>
          </div>
        </div>
      ) : (
        <form className="card" onSubmit={submit} noValidate>
          <label htmlFor="plate">License plate</label>
          <input
            id="plate"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ABC123"
            maxLength={12}
            autoComplete="off"
          />
          <p className="hint">2-8 letters or digits. Example: ABC123</p>
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          <div className="btn-row">
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save plate'}
            </button>
            {savedPlate && (
              <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
