import type { Role } from '@/src/types/api';

export type RoleHomePath =
  | '/app/facility-manager/dashboard'
  | '/app/technician/jobs'
  | '/app/contractor/company'
  | '/app/admin/dashboard';

export function getRoleHomePath(role: Role): RoleHomePath {
  switch (role) {
    case 'facility_manager':
      return '/app/facility-manager/dashboard';
    case 'technician':
      return '/app/technician/jobs';
    case 'contractor_manager':
      return '/app/contractor/company';
    case 'admin':
      return '/app/admin/dashboard';
  }
}
