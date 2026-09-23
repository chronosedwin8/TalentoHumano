import * as React from 'react';
import { Navigate, Outlet, createBrowserRouter, useLocation } from 'react-router-dom';
import { AppLayout } from '@/app/layout/AppLayout';
import { useAuth } from '@/lib/auth';
import { Spinner } from '@/components/ui/primitives';

const lazy = <T extends { [K in N]: React.ComponentType<any> }, N extends string>(
  loader: () => Promise<T>,
  name: N,
) => React.lazy(() => loader().then((module) => ({ default: module[name] })));

/* ------------------------------- auth pages ------------------------------- */
const LoginPage = lazy(() => import('@/features/auth/LoginPage'), 'LoginPage');
const ForgotPasswordPage = lazy(
  () => import('@/features/auth/ForgotPasswordPage'),
  'ForgotPasswordPage',
);
const ResetPasswordPage = lazy(
  () => import('@/features/auth/ResetPasswordPage'),
  'ResetPasswordPage',
);

/* ------------------------------ public pages ------------------------------ */
const CareersPage = lazy(() => import('@/features/public/CareersPage'), 'CareersPage');
const JobDetailPage = lazy(() => import('@/features/public/JobDetailPage'), 'JobDetailPage');
const EthicsPortalPage = lazy(
  () => import('@/features/public/EthicsPortalPage'),
  'EthicsPortalPage',
);
const EthicsFollowUpPage = lazy(
  () => import('@/features/public/EthicsFollowUpPage'),
  'EthicsFollowUpPage',
);
const VerifyDocumentPage = lazy(
  () => import('@/features/public/VerifyDocumentPage'),
  'VerifyDocumentPage',
);
const PreboardingPage = lazy(() => import('@/features/public/PreboardingPage'), 'PreboardingPage');

/* ------------------------------ app features ------------------------------ */
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'), 'DashboardPage');
const ApprovalsPage = lazy(() => import('@/features/workflows/ApprovalsPage'), 'ApprovalsPage');
const SearchPage = lazy(() => import('@/features/search/SearchPage'), 'SearchPage');

const PortalHomePage = lazy(() => import('@/features/portal/PortalHomePage'), 'PortalHomePage');
const MyProfilePage = lazy(() => import('@/features/portal/MyProfilePage'), 'MyProfilePage');
const MyRequestsPage = lazy(() => import('@/features/portal/MyRequestsPage'), 'MyRequestsPage');
const MyTeamPage = lazy(() => import('@/features/portal/MyTeamPage'), 'MyTeamPage');

const EmployeesPage = lazy(() => import('@/features/people/EmployeesPage'), 'EmployeesPage');
const EmployeeDetailPage = lazy(
  () => import('@/features/people/EmployeeDetailPage'),
  'EmployeeDetailPage',
);
const OrgChartPage = lazy(() => import('@/features/people/OrgChartPage'), 'OrgChartPage');
const DirectoryPage = lazy(() => import('@/features/people/DirectoryPage'), 'DirectoryPage');
const AssetsPage = lazy(() => import('@/features/people/AssetsPage'), 'AssetsPage');

const JobsPage = lazy(() => import('@/features/recruiting/JobsPage'), 'JobsPage');
const PipelinePage = lazy(() => import('@/features/recruiting/PipelinePage'), 'PipelinePage');
const CandidatesPage = lazy(() => import('@/features/recruiting/CandidatesPage'), 'CandidatesPage');
const RequisitionsPage = lazy(
  () => import('@/features/recruiting/RequisitionsPage'),
  'RequisitionsPage',
);

const OnboardingBoardPage = lazy(
  () => import('@/features/onboarding/OnboardingBoardPage'),
  'OnboardingBoardPage',
);
const OnboardingTemplatesPage = lazy(
  () => import('@/features/onboarding/OnboardingTemplatesPage'),
  'OnboardingTemplatesPage',
);
const OnboardingProcessPage = lazy(
  () => import('@/features/onboarding/OnboardingProcessPage'),
  'OnboardingProcessPage',
);

const LeaveRequestsPage = lazy(
  () => import('@/features/leaves/LeaveRequestsPage'),
  'LeaveRequestsPage',
);
const LeaveCalendarPage = lazy(
  () => import('@/features/leaves/LeaveCalendarPage'),
  'LeaveCalendarPage',
);
const LeaveBalancesPage = lazy(
  () => import('@/features/leaves/LeaveBalancesPage'),
  'LeaveBalancesPage',
);
const EmployeeEventsPage = lazy(
  () => import('@/features/leaves/EmployeeEventsPage'),
  'EmployeeEventsPage',
);
const PayrollExportPage = lazy(
  () => import('@/features/leaves/PayrollExportPage'),
  'PayrollExportPage',
);

const AttendancePage = lazy(() => import('@/features/time/AttendancePage'), 'AttendancePage');
const ClockPage = lazy(() => import('@/features/time/ClockPage'), 'ClockPage');
const ShiftsPage = lazy(() => import('@/features/time/ShiftsPage'), 'ShiftsPage');

const CoursesPage = lazy(() => import('@/features/learning/CoursesPage'), 'CoursesPage');
const CourseDetailPage = lazy(
  () => import('@/features/learning/CourseDetailPage'),
  'CourseDetailPage',
);
const LessonEditorPage = lazy(
  () => import('@/features/learning/LessonEditorPage'),
  'LessonEditorPage',
);
const MyCoursesPage = lazy(() => import('@/features/learning/MyCoursesPage'), 'MyCoursesPage');
const LessonViewerPage = lazy(
  () => import('@/features/learning/LessonViewerPage'),
  'LessonViewerPage',
);

const ObjectivesPage = lazy(
  () => import('@/features/performance/ObjectivesPage'),
  'ObjectivesPage',
);
const ReviewCyclesPage = lazy(
  () => import('@/features/performance/ReviewCyclesPage'),
  'ReviewCyclesPage',
);
const MyReviewsPage = lazy(() => import('@/features/performance/MyReviewsPage'), 'MyReviewsPage');
const NineBoxPage = lazy(() => import('@/features/performance/NineBoxPage'), 'NineBoxPage');
const FeedbackPage = lazy(() => import('@/features/performance/FeedbackPage'), 'FeedbackPage');

const FeedPage = lazy(() => import('@/features/communication/FeedPage'), 'FeedPage');
const RecognitionsPage = lazy(
  () => import('@/features/communication/RecognitionsPage'),
  'RecognitionsPage',
);
const WikiPage = lazy(() => import('@/features/communication/WikiPage'), 'WikiPage');
const BenefitsPage = lazy(() => import('@/features/communication/BenefitsPage'), 'BenefitsPage');

const SurveysPage = lazy(() => import('@/features/surveys/SurveysPage'), 'SurveysPage');
const SurveyResultsPage = lazy(
  () => import('@/features/surveys/SurveyResultsPage'),
  'SurveyResultsPage',
);
const AnswerSurveyPage = lazy(
  () => import('@/features/surveys/AnswerSurveyPage'),
  'AnswerSurveyPage',
);

const EthicsReportsPage = lazy(
  () => import('@/features/ethics/EthicsReportsPage'),
  'EthicsReportsPage',
);
const EthicsReportDetailPage = lazy(
  () => import('@/features/ethics/EthicsReportDetailPage'),
  'EthicsReportDetailPage',
);

const DocumentTemplatesPage = lazy(
  () => import('@/features/documents/DocumentTemplatesPage'),
  'DocumentTemplatesPage',
);
const PoliciesPage = lazy(() => import('@/features/documents/PoliciesPage'), 'PoliciesPage');
const MyDocumentsPage = lazy(
  () => import('@/features/documents/MyDocumentsPage'),
  'MyDocumentsPage',
);

const TicketsPage = lazy(() => import('@/features/helpdesk/TicketsPage'), 'TicketsPage');
const TicketDetailPage = lazy(
  () => import('@/features/helpdesk/TicketDetailPage'),
  'TicketDetailPage',
);
const KnowledgeBasePage = lazy(
  () => import('@/features/helpdesk/KnowledgeBasePage'),
  'KnowledgeBasePage',
);

const SstPage = lazy(() => import('@/features/sst/SstPage'), 'SstPage');
const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage'), 'AnalyticsPage');
const ReportBuilderPage = lazy(
  () => import('@/features/analytics/ReportBuilderPage'),
  'ReportBuilderPage',
);

const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'), 'SettingsPage');

/* -------------------------------------------------------------------------- */

function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

function Suspended({ children }: { children: React.ReactNode }) {
  return <React.Suspense fallback={<Loading />}>{children}</React.Suspense>;
}

/** Blocks the private area until the silent refresh finished. */
function RequireAuth() {
  const { status, user, bootstrap } = useAuth();
  const location = useLocation();

  React.useEffect(() => {
    if (status === 'loading') void bootstrap();
  }, [status, bootstrap]);

  if (status === 'loading') return <Loading />;
  if (status === 'anonymous' || !user) {
    return <Navigate to="/auth/ingresar" state={{ from: location.pathname }} replace />;
  }
  return <Outlet />;
}

/** Hides a route when the module is not enabled for the user. */
function RequireModule({ module, children }: { module: string; children: React.ReactNode }) {
  const hasModule = useAuth((state) => state.hasModule(module));
  if (!hasModule) return <Navigate to="/dashboard" replace />;
  return <Suspended>{children}</Suspended>;
}

function PublicOnly() {
  const { status, user, bootstrap } = useAuth();

  React.useEffect(() => {
    if (status === 'loading') void bootstrap();
  }, [status, bootstrap]);

  if (status === 'loading') return <Loading />;
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <Suspended>
      <Outlet />
    </Suspended>
  );
}

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },

  {
    path: '/auth',
    element: <PublicOnly />,
    children: [
      { index: true, element: <Navigate to="/auth/ingresar" replace /> },
      { path: 'ingresar', element: <LoginPage /> },
      { path: 'recuperar', element: <ForgotPasswordPage /> },
      { path: 'restablecer', element: <ResetPasswordPage /> },
    ],
  },

  // Public portals: no session required.
  {
    path: '/careers/:companySlug',
    element: (
      <Suspended>
        <CareersPage />
      </Suspended>
    ),
  },
  {
    path: '/careers/:companySlug/:jobSlug',
    element: (
      <Suspended>
        <JobDetailPage />
      </Suspended>
    ),
  },
  {
    path: '/ethics/:companySlug',
    element: (
      <Suspended>
        <EthicsPortalPage />
      </Suspended>
    ),
  },
  {
    path: '/ethics-seguimiento',
    element: (
      <Suspended>
        <EthicsFollowUpPage />
      </Suspended>
    ),
  },
  {
    path: '/verificar/:code',
    element: (
      <Suspended>
        <VerifyDocumentPage />
      </Suspended>
    ),
  },
  {
    path: '/pre-ingreso/:token',
    element: (
      <Suspended>
        <PreboardingPage />
      </Suspended>
    ),
  },

  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: '/dashboard',
            element: (
              <Suspended>
                <DashboardPage />
              </Suspended>
            ),
          },
          {
            path: '/approvals',
            element: (
              <Suspended>
                <ApprovalsPage />
              </Suspended>
            ),
          },
          {
            path: '/buscar',
            element: (
              <Suspended>
                <SearchPage />
              </Suspended>
            ),
          },

          {
            path: '/portal',
            element: (
              <Suspended>
                <PortalHomePage />
              </Suspended>
            ),
          },
          {
            path: '/portal/perfil',
            element: (
              <Suspended>
                <MyProfilePage />
              </Suspended>
            ),
          },
          {
            path: '/portal/solicitudes',
            element: (
              <Suspended>
                <MyRequestsPage />
              </Suspended>
            ),
          },
          {
            path: '/portal/equipo',
            element: (
              <Suspended>
                <MyTeamPage />
              </Suspended>
            ),
          },
          {
            path: '/portal/tareas',
            element: (
              <Suspended>
                <PortalHomePage />
              </Suspended>
            ),
          },
          {
            path: '/portal/documentos',
            element: (
              <Suspended>
                <MyDocumentsPage />
              </Suspended>
            ),
          },
          {
            path: '/portal/tickets/:id',
            element: (
              <Suspended>
                <TicketDetailPage />
              </Suspended>
            ),
          },

          {
            path: '/people',
            element: (
              <RequireModule module="people">
                <EmployeesPage />
              </RequireModule>
            ),
          },
          {
            path: '/people/employees/:id',
            element: (
              <RequireModule module="people">
                <EmployeeDetailPage />
              </RequireModule>
            ),
          },
          {
            path: '/people/organigrama',
            element: (
              <RequireModule module="people">
                <OrgChartPage />
              </RequireModule>
            ),
          },
          {
            path: '/people/directorio',
            element: (
              <RequireModule module="people">
                <DirectoryPage />
              </RequireModule>
            ),
          },
          {
            path: '/people/activos',
            element: (
              <RequireModule module="people">
                <AssetsPage />
              </RequireModule>
            ),
          },
          {
            path: '/people/movements/:id',
            element: (
              <RequireModule module="people">
                <EmployeesPage />
              </RequireModule>
            ),
          },

          {
            path: '/recruiting',
            element: (
              <RequireModule module="recruiting">
                <JobsPage />
              </RequireModule>
            ),
          },
          {
            path: '/recruiting/jobs/:id',
            element: (
              <RequireModule module="recruiting">
                <PipelinePage />
              </RequireModule>
            ),
          },
          {
            path: '/recruiting/candidatos',
            element: (
              <RequireModule module="recruiting">
                <CandidatesPage />
              </RequireModule>
            ),
          },
          {
            path: '/recruiting/requisiciones',
            element: (
              <RequireModule module="recruiting">
                <RequisitionsPage />
              </RequireModule>
            ),
          },
          {
            path: '/recruiting/requisitions/:id',
            element: (
              <RequireModule module="recruiting">
                <RequisitionsPage />
              </RequireModule>
            ),
          },

          {
            path: '/onboarding',
            element: (
              <RequireModule module="onboarding">
                <OnboardingBoardPage />
              </RequireModule>
            ),
          },
          {
            path: '/onboarding/plantillas',
            element: (
              <RequireModule module="onboarding">
                <OnboardingTemplatesPage />
              </RequireModule>
            ),
          },
          {
            path: '/onboarding/procesos/:id',
            element: (
              <RequireModule module="onboarding">
                <OnboardingProcessPage />
              </RequireModule>
            ),
          },

          {
            path: '/leaves',
            element: (
              <RequireModule module="leaves">
                <LeaveRequestsPage />
              </RequireModule>
            ),
          },
          {
            path: '/leaves/requests/:id',
            element: (
              <RequireModule module="leaves">
                <LeaveRequestsPage />
              </RequireModule>
            ),
          },
          {
            path: '/leaves/calendario',
            element: (
              <RequireModule module="leaves">
                <LeaveCalendarPage />
              </RequireModule>
            ),
          },
          {
            path: '/leaves/saldos',
            element: (
              <RequireModule module="leaves">
                <LeaveBalancesPage />
              </RequireModule>
            ),
          },
          {
            path: '/leaves/novedades',
            element: (
              <RequireModule module="leaves">
                <EmployeeEventsPage />
              </RequireModule>
            ),
          },
          {
            path: '/leaves/exportacion',
            element: (
              <RequireModule module="leaves">
                <PayrollExportPage />
              </RequireModule>
            ),
          },

          {
            path: '/time',
            element: (
              <RequireModule module="time">
                <ClockPage />
              </RequireModule>
            ),
          },
          {
            path: '/time/asistencia',
            element: (
              <RequireModule module="time">
                <AttendancePage />
              </RequireModule>
            ),
          },
          {
            path: '/time/turnos',
            element: (
              <RequireModule module="time">
                <ShiftsPage />
              </RequireModule>
            ),
          },

          {
            path: '/learning',
            element: (
              <RequireModule module="learning">
                <MyCoursesPage />
              </RequireModule>
            ),
          },
          {
            path: '/learning/catalogo',
            element: (
              <RequireModule module="learning">
                <CoursesPage />
              </RequireModule>
            ),
          },
          {
            path: '/learning/courses/:id',
            element: (
              <RequireModule module="learning">
                <CourseDetailPage />
              </RequireModule>
            ),
          },
          {
            path: '/learning/lecciones/:id/editar',
            element: (
              <RequireModule module="learning">
                <LessonEditorPage />
              </RequireModule>
            ),
          },
          {
            path: '/learning/lecciones/:id',
            element: (
              <RequireModule module="learning">
                <LessonViewerPage />
              </RequireModule>
            ),
          },

          {
            path: '/performance',
            element: (
              <RequireModule module="performance">
                <ObjectivesPage />
              </RequireModule>
            ),
          },
          {
            path: '/performance/ciclos',
            element: (
              <RequireModule module="performance">
                <ReviewCyclesPage />
              </RequireModule>
            ),
          },
          {
            path: '/performance/mis-evaluaciones',
            element: (
              <RequireModule module="performance">
                <MyReviewsPage />
              </RequireModule>
            ),
          },
          {
            path: '/performance/nine-box/:cycleId',
            element: (
              <RequireModule module="performance">
                <NineBoxPage />
              </RequireModule>
            ),
          },
          {
            path: '/performance/feedback',
            element: (
              <RequireModule module="performance">
                <FeedbackPage />
              </RequireModule>
            ),
          },

          {
            path: '/communication',
            element: (
              <RequireModule module="communication">
                <FeedPage />
              </RequireModule>
            ),
          },
          {
            path: '/communication/posts/:id',
            element: (
              <RequireModule module="communication">
                <FeedPage />
              </RequireModule>
            ),
          },
          {
            path: '/communication/recognitions',
            element: (
              <RequireModule module="communication">
                <RecognitionsPage />
              </RequireModule>
            ),
          },
          {
            path: '/communication/wiki',
            element: (
              <RequireModule module="communication">
                <WikiPage />
              </RequireModule>
            ),
          },
          {
            path: '/communication/beneficios',
            element: (
              <RequireModule module="communication">
                <BenefitsPage />
              </RequireModule>
            ),
          },

          {
            path: '/surveys',
            element: (
              <RequireModule module="surveys">
                <SurveysPage />
              </RequireModule>
            ),
          },
          {
            path: '/surveys/:id/resultados',
            element: (
              <RequireModule module="surveys">
                <SurveyResultsPage />
              </RequireModule>
            ),
          },
          {
            path: '/surveys/:id/responder',
            element: (
              <RequireModule module="surveys">
                <AnswerSurveyPage />
              </RequireModule>
            ),
          },
          {
            path: '/surveys/mine',
            element: (
              <RequireModule module="surveys">
                <SurveysPage />
              </RequireModule>
            ),
          },

          {
            path: '/ethics',
            element: (
              <RequireModule module="ethics">
                <EthicsReportsPage />
              </RequireModule>
            ),
          },
          {
            path: '/ethics/reports/:id',
            element: (
              <RequireModule module="ethics">
                <EthicsReportDetailPage />
              </RequireModule>
            ),
          },

          {
            path: '/documents',
            element: (
              <RequireModule module="documents">
                <MyDocumentsPage />
              </RequireModule>
            ),
          },
          {
            path: '/documents/plantillas',
            element: (
              <RequireModule module="documents">
                <DocumentTemplatesPage />
              </RequireModule>
            ),
          },
          {
            path: '/documents/policies',
            element: (
              <RequireModule module="documents">
                <PoliciesPage />
              </RequireModule>
            ),
          },

          {
            path: '/helpdesk',
            element: (
              <RequireModule module="helpdesk">
                <TicketsPage />
              </RequireModule>
            ),
          },
          {
            path: '/helpdesk/tickets/:id',
            element: (
              <RequireModule module="helpdesk">
                <TicketDetailPage />
              </RequireModule>
            ),
          },
          {
            path: '/helpdesk/conocimiento',
            element: (
              <RequireModule module="helpdesk">
                <KnowledgeBasePage />
              </RequireModule>
            ),
          },

          {
            path: '/sst',
            element: (
              <RequireModule module="sst">
                <SstPage />
              </RequireModule>
            ),
          },

          {
            path: '/analytics',
            element: (
              <RequireModule module="analytics">
                <AnalyticsPage />
              </RequireModule>
            ),
          },
          {
            path: '/analytics/reportes',
            element: (
              <RequireModule module="analytics">
                <ReportBuilderPage />
              </RequireModule>
            ),
          },

          {
            path: '/settings',
            element: (
              <RequireModule module="settings">
                <SettingsPage />
              </RequireModule>
            ),
          },
          {
            path: '/settings/:tab',
            element: (
              <RequireModule module="settings">
                <SettingsPage />
              </RequireModule>
            ),
          },
        ],
      },
    ],
  },

  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
