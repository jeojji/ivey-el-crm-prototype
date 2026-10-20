import { Link, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Card, EmptyState } from './components/ui';
import { DashboardPage } from './pages/DashboardPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { CompanyDetailPage } from './pages/CompanyDetailPage';
import { ContactsPage } from './pages/ContactsPage';
import { ContactDetailPage } from './pages/ContactDetailPage';
import { ActivityPage } from './pages/ActivityPage';
import { FollowUpsPage } from './pages/FollowUpsPage';
import { AboutPage } from './pages/AboutPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="companies/:id" element={<CompanyDetailPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="contacts/:id" element={<ContactDetailPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="follow-ups" element={<FollowUpsPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route
          path="*"
          element={
            <Card>
              <EmptyState title="Page not found" action={<Link to="/" className="text-sm font-medium text-ivey-700 hover:underline">Go to the dashboard</Link>} />
            </Card>
          }
        />
      </Route>
    </Routes>
  );
}
