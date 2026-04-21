import { Routes, Route } from 'react-router-dom';
import Layout from './layout/Layout';
import Dashboard from './pages/Dashboard';
import OpportunityIntake from './pages/OpportunityIntake';
import CapitalStack from './pages/CapitalStack';
import SPVRegistry from './pages/SPVRegistry';
import Waterfalls from './pages/Waterfalls';
import HoldCoSummary from './pages/HoldCoSummary';
import Documents from './pages/Documents';
import Notifications from './pages/Notifications';
import DealDetail from './pages/DealDetail';
import AdminControl from './pages/AdminControl';
import EnterDashboard from './pages/EnterDashboard';
import AccessPending from './pages/AccessPending';
import AccessDenied from './pages/AccessDenied';
import './index.css';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/enter-dashboard" element={<EnterDashboard />} />
        <Route path="/access/pending" element={<AccessPending />} />
        <Route path="/access/denied" element={<AccessDenied />} />
        <Route path="/intake" element={<OpportunityIntake />} />
        <Route path="/capital" element={<CapitalStack />} />
        <Route path="/spv" element={<SPVRegistry />} />
        <Route path="/waterfalls" element={<Waterfalls />} />
        <Route path="/holdco" element={<HoldCoSummary />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/deal/:id" element={<DealDetail />} />
        <Route path="/admin" element={<AdminControl />} />
      </Routes>
    </Layout>
  );
}
