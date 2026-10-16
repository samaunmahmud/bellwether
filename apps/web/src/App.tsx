import type { ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { RequireAuth } from './components/RequireAuth';
import { AnimalsPage } from './pages/AnimalsPage';
import { AuthPage } from './pages/AuthPage';
import { BriefingPage } from './pages/BriefingPage';
import { FarmPage } from './pages/FarmPage';
import { FarmsPage } from './pages/FarmsPage';
import { GroupPage } from './pages/GroupPage';
import { RecordsPage } from './pages/RecordsPage';
import { TasksPage } from './pages/TasksPage';
import { ForecastPage } from './pages/ForecastPage';
import { HomePage } from './pages/HomePage';
import { PetPage } from './pages/PetPage';

const signedIn = (page: ReactNode) => <RequireAuth>{page}</RequireAuth>;

export function App() {
  return (
    <div className="shell">
      <NavBar />
      <main className="content">
        <Routes>
          {/* Public: the postcode forecast reads no user data (A15) */}
          <Route path="/" element={<HomePage />} />
          <Route path="/forecast/:kind" element={<ForecastPage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />

          <Route path="/farms" element={signedIn(<FarmsPage />)} />
          <Route path="/farms/:id" element={signedIn(<FarmPage />)} />
          <Route path="/farms/:id/briefing" element={signedIn(<BriefingPage />)} />
          <Route path="/farms/:id/records" element={signedIn(<RecordsPage />)} />
          <Route path="/farms/:id/tasks" element={signedIn(<TasksPage />)} />
          <Route path="/groups/:id" element={signedIn(<GroupPage />)} />
          <Route path="/animals" element={signedIn(<AnimalsPage />)} />
          <Route path="/pets/:id" element={signedIn(<PetPage />)} />
        </Routes>
      </main>
    </div>
  );
}
