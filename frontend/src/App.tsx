import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { HardRedirect } from "./components/HardRedirect";

import { FacilitiesPage } from "./screens/facility-manager/FacilitiesPage";
import { FacilityDetailPage } from "./screens/facility-manager/FacilityDetailPage";
import { JobsPage } from "./screens/facility-manager/JobsPage";
import { JobCreatePage } from "./screens/facility-manager/JobCreatePage";
import { JobDetailPage } from "./screens/facility-manager/JobDetailPage";
import { DashboardPage } from "./screens/facility-manager/DashboardPage";

import { ProfilePage } from "./screens/technician/ProfilePage";
import { CredentialsPage } from "./screens/technician/CredentialsPage";
import { CapabilitiesPage } from "./screens/technician/CapabilitiesPage";
import { MyJobsPage } from "./screens/technician/MyJobsPage";
import { ReportSubmitPage } from "./screens/technician/ReportSubmitPage";
import { AssessmentsPage } from "./screens/technician/AssessmentsPage";
import { AssessmentTakePage } from "./screens/technician/AssessmentTakePage";

import { CompanyPage } from "./screens/contractor/CompanyPage";
import { RosterPage } from "./screens/contractor/RosterPage";
import { TeamCapabilitiesPage } from "./screens/contractor/TeamCapabilitiesPage";
import { CylindersPage } from "./screens/contractor/CylindersPage";

import { CalendarPage } from "./screens/shared/CalendarPage";
import { EquipmentPage } from "./screens/facility-manager/EquipmentPage";
import { EquipmentListPage } from "./screens/facility-manager/EquipmentListPage";

import { AdminDashboardPage } from "./screens/admin/AdminDashboardPage";
import { CredentialsReviewPage } from "./screens/admin/CredentialsReviewPage";
import { CapabilitiesReviewPage } from "./screens/admin/CapabilitiesReviewPage";
import { ContractorDocumentsReviewPage } from "./screens/admin/ContractorDocumentsReviewPage";
import { ContractorVerificationsReviewPage } from "./screens/admin/ContractorVerificationsReviewPage";

function App() {
  return (
    <Routes>
      {/* The public pages are Next.js routes; reaching one from in here is a full page load. */}
      <Route path="/" element={<HardRedirect to="/" />} />
      <Route path="/login" element={<HardRedirect to="/login" />} />
      <Route path="/register" element={<HardRedirect to="/register" />} />
      <Route path="/forgot-password" element={<HardRedirect to="/forgot-password" />} />
      <Route path="/reset-password" element={<HardRedirect to="/reset-password" />} />

      <Route element={<Layout />}>
        <Route element={<ProtectedRoute />}>
          <Route path="/equipment/:id" element={<EquipmentPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["facility_manager", "technician", "contractor_manager"]} />}>
          <Route path="/calendar" element={<CalendarPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/credentials" element={<CredentialsReviewPage />} />
          <Route path="/admin/capabilities" element={<CapabilitiesReviewPage />} />
          <Route path="/admin/contractor-documents" element={<ContractorDocumentsReviewPage />} />
          <Route path="/admin/contractor-verifications" element={<ContractorVerificationsReviewPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["facility_manager"]} />}>
          <Route path="/facilities" element={<FacilitiesPage />} />
          <Route path="/equipment" element={<EquipmentListPage />} />
          <Route path="/facilities/:id" element={<FacilityDetailPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/new" element={<JobCreatePage />} />
          <Route path="/jobs/:id" element={<JobDetailPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["technician"]} />}>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/credentials" element={<CredentialsPage />} />
          <Route path="/capabilities" element={<CapabilitiesPage />} />
          <Route path="/my-jobs" element={<MyJobsPage />} />
          <Route path="/my-jobs/:id/report" element={<ReportSubmitPage />} />
          <Route path="/assessments" element={<AssessmentsPage />} />
          <Route path="/assessments/:id" element={<AssessmentTakePage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["contractor_manager"]} />}>
          <Route path="/company" element={<CompanyPage />} />
          <Route path="/roster" element={<RosterPage />} />
          <Route path="/team-capabilities" element={<TeamCapabilitiesPage />} />
          <Route path="/cylinders" element={<CylindersPage />} />
        </Route>
      </Route>

      <Route path="*" element={<HardRedirect to="/" />} />
    </Routes>
  );
}

export default App;
