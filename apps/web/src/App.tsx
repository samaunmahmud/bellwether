import { NavLink, Route, Routes } from 'react-router-dom';
import { AnimalsPage } from './pages/AnimalsPage';
import { ForecastPage } from './pages/ForecastPage';
import { HomePage } from './pages/HomePage';

export function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          AnimalCast
        </NavLink>
        <nav>
          <NavLink to="/">Forecast</NavLink>
          <NavLink to="/animals">My animals</NavLink>
        </nav>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/forecast/:kind" element={<ForecastPage />} />
          <Route path="/animals" element={<AnimalsPage />} />
        </Routes>
      </main>
    </div>
  );
}
