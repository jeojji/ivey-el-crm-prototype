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
import { ImportExportPage } from './pages/ImportExportPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { ApplicationDetailPage } from './pages/ApplicationDetailPage';
import { EmailIntakePage } from './pages/EmailIntakePage';
import { EmailDetailPage } from './pages/EmailDetailPage';
import { PrepPage } from './pages/PrepPage';
import { BriefPage } from './pages/BriefPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { CampaignDetailPage } from './pages/CampaignDetailPage';
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
        <Route path="applications" element={<ApplicationsPage />} />
        <Route path="applications/:id" element={<ApplicationDetailPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="emails/new" element={<EmailIntakePage />} />
        <Route path="emails/:id" element={<EmailDetailPage />} />
        <Route path="prep" element={<PrepPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="campaigns/:id" element={<CampaignDetailPage />} />
        <Route path="briefs/:id" element={<BriefPage />} />
        <Route path="follow-ups" element={<FollowUpsPage />} />
        <Route path="import-export" element={<ImportExportPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route
          path="*"
          element={
            <Card>
              <EmptyState title="Page not found" action={<Link to="/" className="text-sm font-medium text-ivey-700 hover:underline">Go to Home</Link>} />
            </Card>
          }
        />
      </Route>
    </Routes>
  );
}
