import type { ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { RequireAuth } from './components/RequireAuth';
import { ToastProvider } from './components/Toasts';
import { ContactsPage } from './pages/ContactsPage';
import { EmergencyPage } from './pages/EmergencyPage';
import { MyContactsPage } from './pages/MyContactsPage';
import { AnimalsPage } from './pages/AnimalsPage';
import { AuthPage } from './pages/AuthPage';
import { BriefingPage } from './pages/BriefingPage';
import { CalendarPage } from './pages/CalendarPage';
import { FarmDashboardPage } from './pages/FarmDashboardPage';
import { FarmMapPage } from './pages/FarmMapPage';
import { MedicinesPage } from './pages/MedicinesPage';
import { OutlookPage } from './pages/OutlookPage';
import { RegisterPage } from './pages/RegisterPage';
import { FarmPage } from './pages/FarmPage';
import { FarmSettingsPage } from './pages/FarmSettingsPage';
import { FarmsPage } from './pages/FarmsPage';
import { GroupPage } from './pages/GroupPage';
import { RecordsPage } from './pages/RecordsPage';
import { TasksPage } from './pages/TasksPage';
import { ForecastPage } from './pages/ForecastPage';
import { HomePage } from './pages/HomePage';
import { PeoplePage } from './pages/PeoplePage';
import { PetPage } from './pages/PetPage';

const signedIn = (page: ReactNode) => <RequireAuth>{page}</RequireAuth>;

export function App() {
  return (
    <ToastProvider>
      <AppShell>
        <Routes>
          {/* Public: the postcode forecast reads no user data (A15) */}
          <Route path="/" element={<HomePage />} />
          <Route path="/forecast/:kind" element={<ForecastPage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />

          <Route path="/farms" element={signedIn(<FarmsPage />)} />
          <Route path="/farms/:id" element={signedIn(<FarmDashboardPage />)} />
          <Route path="/farms/:id/livestock" element={signedIn(<FarmPage />)} />
          <Route path="/farms/:id/map" element={signedIn(<FarmMapPage />)} />
          <Route path="/farms/:id/outlook" element={signedIn(<OutlookPage />)} />
          <Route path="/farms/:id/calendar" element={signedIn(<CalendarPage />)} />
          <Route path="/farms/:id/register" element={signedIn(<RegisterPage />)} />
          <Route path="/farms/:id/medicines" element={signedIn(<MedicinesPage />)} />
          <Route path="/farms/:id/briefing" element={signedIn(<BriefingPage />)} />
          <Route path="/farms/:id/records" element={signedIn(<RecordsPage />)} />
          <Route path="/farms/:id/tasks" element={signedIn(<TasksPage />)} />
          <Route path="/farms/:id/settings" element={signedIn(<FarmSettingsPage />)} />
          <Route path="/farms/:id/people" element={signedIn(<PeoplePage />)} />
          <Route path="/groups/:id" element={signedIn(<GroupPage />)} />
          <Route path="/animals" element={signedIn(<AnimalsPage />)} />
          <Route path="/contacts" element={signedIn(<MyContactsPage />)} />
          <Route path="/emergency" element={signedIn(<EmergencyPage />)} />
          <Route path="/farms/:id/contacts" element={signedIn(<ContactsPage />)} />
          <Route path="/pets/:id" element={signedIn(<PetPage />)} />
        </Routes>
      </AppShell>
    </ToastProvider>
  );
}
