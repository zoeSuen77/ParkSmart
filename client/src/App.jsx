import { Route, Routes, Navigate, Link } from 'react-router-dom';
import PlatePage from './pages/PlatePage.jsx';
import LotsPage from './pages/LotsPage.jsx';
import SpotsPage from './pages/SpotsPage.jsx';
import ConfirmParkPage from './pages/ConfirmParkPage.jsx';
import ReservationPage from './pages/ReservationPage.jsx';
import ReleaseConfirmPage from './pages/ReleaseConfirmPage.jsx';
import ReleasedPage from './pages/ReleasedPage.jsx';

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">
          ParkSmart
        </Link>
        <span className="tagline">UAlbany Commuter Parking</span>
        <nav>
          <Link to="/lots">Parking Lots</Link>
          <Link to="/reservation">My Reservation</Link>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/plate" replace />} />
          <Route path="/plate" element={<PlatePage />} />
          <Route path="/lots" element={<LotsPage />} />
          <Route path="/lots/:lotId" element={<SpotsPage />} />
          <Route path="/confirm/:lotId/:spotId" element={<ConfirmParkPage />} />
          <Route path="/reservation" element={<ReservationPage />} />
          <Route path="/release/:id" element={<ReleaseConfirmPage />} />
          <Route path="/released/:id" element={<ReleasedPage />} />
          <Route path="*" element={<Navigate to="/plate" replace />} />
        </Routes>
      </main>
    </div>
  );
}
