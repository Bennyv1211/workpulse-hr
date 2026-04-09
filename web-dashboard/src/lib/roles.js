export const HR_ROLES = ['super_admin', 'hr_admin', 'hr']
export const MANAGER_ROLES = ['manager']
export const WEB_ALLOWED_ROLES = [...HR_ROLES, ...MANAGER_ROLES]

export function isHrRole(role) {
  return HR_ROLES.includes(role)
}

export function isManagerRole(role) {
  return MANAGER_ROLES.includes(role)
}

export function canAccessWebDashboard(role) {
  return WEB_ALLOWED_ROLES.includes(role)
}

export function getDashboardPathForRole(role) {
  if (canAccessWebDashboard(role)) {
    return '/dashboard'
  }
  return '/login'
}
