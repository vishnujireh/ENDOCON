import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { RequireAdmin, RequireAuth } from './auth/guards';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { PortalHeader } from './components/PortalHeader';
import { MyAbstractDetailPage, MyAbstractsPage } from './features/abstracts/MyAbstractsPage';
import { SubmitAbstractPage } from './features/abstracts/SubmitAbstractPage';
import { DashboardPage } from './pages/DashboardPage';
import { AdminAbstractsPage, AdminAuthorAbstractsPage } from './features/admin/AdminAbstractsPage';
import { AdminHeader } from './features/admin/AdminHeader';
import { AdminLayout } from './features/admin/AdminLayout';
import { AdminReviewersPage } from './features/admin/review/AdminReviewersPage';
import { AdminRegistrationDetailPage } from './features/admin/AdminRegistrationDetailPage';
import { AdminRegistrationsPage } from './features/admin/AdminRegistrationsPage';
import { PaymentResultPage } from './features/registration/PaymentResultPage';
import { RegistrationDashboard } from './features/registration/RegistrationDashboard';
import { RegistrationWizard } from './features/registration/RegistrationWizard';
import { ResumeRedirect } from './features/registration/ResumeRedirect';
import { CreateAccountPage } from './pages/CreateAccountPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HomePage } from './pages/HomePage';
import { LegalPage } from './pages/LegalPage';
import { PRIVACY, REFUND, TERMS } from './data/legalContent';
import { LoginPage } from './pages/LoginPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { RequireReviewer } from './features/reviewer/ReviewerAuth';
import { ReviewerAbstractPage } from './features/reviewer/ReviewerAbstractPage';
import { ReviewerDashboardPage } from './features/reviewer/ReviewerDashboardPage';
import { ReviewerLayout } from './features/reviewer/ReviewerLayout';
import { ReviewerLoginPage } from './features/reviewer/ReviewerLoginPage';

export default function App() {
  const { pathname } = useLocation();
  // Layouts:
  //  bare   – admin login (shown at /admin… while signed out): no header/footer at all
  //  admin  – other /admin pages: admin header (logo, sections, back to site, logout), no footer
  //  portal – delegate auth pages + logged-in portal: logo-only header, no footer
  //  site   – public website: full navbar + footer
  const { user } = useAuth();
  const adminPath = /^\/admin(\/|$)/.test(pathname);
  const bare = adminPath && user?.role !== 'admin';
  const admin = adminPath && !bare;
  // Reviewer (judge) portal: own header inside its layout route, no site header / footer.
  const reviewer = /^\/reviewer(\/|$)/.test(pathname);
  const portal = reviewer || /^\/(login|register|create-account|forgot-password|reset-password|registration|payment|my-abstracts|abstracts|dashboard)(\/|$)/.test(pathname);
  React.useEffect(() => {
    if (pathname !== '/') window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#1a1918] font-sans antialiased selection:bg-[#580c1e] selection:text-[#fef3c7] flex flex-col">
      {bare || reviewer ? null : admin ? <AdminHeader /> : portal ? <PortalHeader /> : <Header />}
      <main className={`flex-grow ${bare ? 'flex items-center justify-center' : admin ? 'pt-[7.25rem] md:pt-20' : portal ? 'pt-16 md:pt-20' : 'pt-20 md:pt-24'}`}>
        <ErrorBoundary key={pathname}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path={`/${PRIVACY.slug}`} element={<LegalPage doc={PRIVACY} />} />
          <Route path={`/${TERMS.slug}`} element={<LegalPage doc={TERMS} />} />
          <Route path={`/${REFUND.slug}`} element={<LegalPage doc={REFUND} />} />
          <Route path="/login" element={<LoginPage />} />
          {/* Old sign-up address: there is one sign-up page now. */}
          <Route path="/register" element={<Navigate to="/create-account" replace />} />
          <Route path="/create-account" element={<CreateAccountPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route path="/registration" element={<RequireAuth><RegistrationDashboard /></RequireAuth>} />
          {/* Takes the delegate to their next unfinished step (Step 1 for a new account). */}
          <Route path="/registration/continue" element={<RequireAuth><ResumeRedirect /></RequireAuth>} />
          <Route path="/registration/wizard/:step" element={<RequireAuth><RegistrationWizard /></RequireAuth>} />
          <Route path="/payment/:paymentId" element={<RequireAuth><PaymentResultPage /></RequireAuth>} />
          {/* My ENDOCON: choose conference registration or abstract submission (default after login / sign-up). */}
          <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/abstracts/submit" element={<RequireAuth><SubmitAbstractPage /></RequireAuth>} />
          <Route path="/my-abstracts" element={<RequireAuth><MyAbstractsPage /></RequireAuth>} />
          <Route path="/my-abstracts/:id" element={<RequireAuth><MyAbstractDetailPage /></RequireAuth>} />

          <Route path="/reviewer" element={<ReviewerLayout />}>
            <Route index element={<RequireReviewer><ReviewerDashboardPage /></RequireReviewer>} />
            <Route path="login" element={<ReviewerLoginPage />} />
            <Route path="abstracts/:id" element={<RequireReviewer><ReviewerAbstractPage /></RequireReviewer>} />
          </Route>

          <Route path="/admin/login" element={<Navigate to="/admin" replace />} /> {/* old address */}
          <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
            <Route index element={<AdminRegistrationsPage />} />
            <Route path="registrations/:userId" element={<AdminRegistrationDetailPage />} />
            <Route path="abstracts" element={<AdminAbstractsPage />} />
            <Route path="abstracts/users/:userId" element={<AdminAuthorAbstractsPage />} />
            <Route path="reviewers" element={<AdminReviewersPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ErrorBoundary>
      </main>
      {!bare && !admin && !portal && <Footer />}
    </div>
  );
}
