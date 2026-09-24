import { lazy, Suspense, type ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '@/layouts/AdminLayout';
import { MobileLayout } from '@/layouts/MobileLayout';
import { Spinner } from '@/ui';
import { HomeRedirect, RequireAuth } from './guards';

/** Carga diferida por módulo (§48). Workbox precachea todos los chunks para uso offline. */
const page = (loader: () => Promise<Record<string, ComponentType>>, name: string) =>
  lazy(async () => ({ default: (await loader())[name] as ComponentType }));

const LoginPage = page(() => import('@/features/auth/LoginPage'), 'LoginPage');
const ForgotPasswordPage = page(() => import('@/features/auth/ForgotPasswordPage'), 'ForgotPasswordPage');
const ResetPasswordPage = page(() => import('@/features/auth/ResetPasswordPage'), 'ResetPasswordPage');

const DashboardPage = page(() => import('@/features/dashboard/DashboardPage'), 'DashboardPage');
const WorkOrdersListPage = page(() => import('@/features/work-orders/WorkOrdersListPage'), 'WorkOrdersListPage');
const WorkOrderNewPage = page(() => import('@/features/work-orders/WorkOrderNewPage'), 'WorkOrderNewPage');
const WorkOrderDetailPage = page(() => import('@/features/work-orders/WorkOrderDetailPage'), 'WorkOrderDetailPage');
const WorkOrderReviewPage = page(() => import('@/features/work-orders/WorkOrderReviewPage'), 'WorkOrderReviewPage');
const ClientsListPage = page(() => import('@/features/clients/ClientsListPage'), 'ClientsListPage');
const ClientFormPage = page(() => import('@/features/clients/ClientFormPage'), 'ClientFormPage');
const ClientDetailPage = page(() => import('@/features/clients/ClientDetailPage'), 'ClientDetailPage');
const EquipmentListPage = page(() => import('@/features/equipment/EquipmentListPage'), 'EquipmentListPage');
const EquipmentFormPage = page(() => import('@/features/equipment/EquipmentFormPage'), 'EquipmentFormPage');
const EquipmentDetailPage = page(() => import('@/features/equipment/EquipmentDetailPage'), 'EquipmentDetailPage');
const ChecklistsListPage = page(() => import('@/features/checklists/ChecklistsListPage'), 'ChecklistsListPage');
const ChecklistEditorPage = page(() => import('@/features/checklists/ChecklistEditorPage'), 'ChecklistEditorPage');
const BrandsPage = page(() => import('@/features/brands/BrandsPage'), 'BrandsPage');
const UsersPage = page(() => import('@/features/users/UsersPage'), 'UsersPage');
const SettingsPage = page(() => import('@/features/settings/SettingsPage'), 'SettingsPage');

const MobileHomePage = page(() => import('@/features/mobile/HomePage'), 'HomePage');
const MobileWorkOrdersPage = page(() => import('@/features/mobile/WorkOrdersPage'), 'WorkOrdersPage');
const MobileWorkOrderPage = page(() => import('@/features/mobile/WorkOrderPage'), 'WorkOrderPage');
const MobileChecklistPage = page(() => import('@/features/mobile/ChecklistPage'), 'ChecklistPage');
const MobileEvidencePage = page(() => import('@/features/mobile/EvidencePage'), 'EvidencePage');
const MobileSignaturesPage = page(() => import('@/features/mobile/SignaturesPage'), 'SignaturesPage');
const MobileSummaryPage = page(() => import('@/features/mobile/SummaryPage'), 'SummaryPage');
const MobileSyncPage = page(() => import('@/features/mobile/SyncPage'), 'SyncPage');
const MobileMorePage = page(() => import('@/features/mobile/MorePage'), 'MorePage');

export function AppRoutes() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route
          element={
            <RequireAuth area="admin">
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/work-orders" element={<WorkOrdersListPage />} />
          <Route path="/work-orders/new" element={<WorkOrderNewPage />} />
          <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />
          <Route path="/work-orders/:id/review" element={<WorkOrderReviewPage />} />
          <Route path="/clients" element={<ClientsListPage />} />
          <Route path="/clients/new" element={<ClientFormPage />} />
          <Route path="/clients/:id" element={<ClientDetailPage />} />
          <Route path="/clients/:id/edit" element={<ClientFormPage />} />
          <Route path="/equipment" element={<EquipmentListPage />} />
          <Route path="/equipment/new" element={<EquipmentFormPage />} />
          <Route path="/equipment/:id" element={<EquipmentDetailPage />} />
          <Route path="/equipment/:id/edit" element={<EquipmentFormPage />} />
          <Route path="/checklists" element={<ChecklistsListPage />} />
          <Route path="/checklists/new" element={<ChecklistEditorPage />} />
          <Route path="/checklists/:id" element={<ChecklistEditorPage />} />
          <Route path="/brands" element={<BrandsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route
          element={
            <RequireAuth area="mobile">
              <MobileLayout />
            </RequireAuth>
          }
        >
          <Route path="/mobile" element={<Navigate to="/mobile/home" replace />} />
          <Route path="/mobile/home" element={<MobileHomePage />} />
          <Route path="/mobile/work-orders" element={<MobileWorkOrdersPage />} />
          <Route path="/mobile/work-orders/:id" element={<MobileWorkOrderPage />} />
          <Route path="/mobile/work-orders/:id/checklist" element={<MobileChecklistPage />} />
          <Route path="/mobile/work-orders/:id/evidence" element={<MobileEvidencePage />} />
          <Route path="/mobile/work-orders/:id/signatures" element={<MobileSignaturesPage />} />
          <Route path="/mobile/work-orders/:id/summary" element={<MobileSummaryPage />} />
          <Route path="/mobile/sync" element={<MobileSyncPage />} />
          <Route path="/mobile/more" element={<MobileMorePage />} />
        </Route>

        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </Suspense>
  );
}
