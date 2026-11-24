const transportModules = new Set(['Routes', 'Vehicles', 'Drivers', 'Students', 'Parents', 'Trips', 'Live tracking', 'Maintenance', 'Documents', 'Attendance', 'Complaints', 'Emergency', 'Reports', 'Performance']);
const financeModules = new Set(['Payments', 'Fees', 'Invoices', 'Receipts', 'Refunds']);
export function canWriteModule(role, module) {
  if (role === 'Institute Admin') return true;
  if (role === 'Transport Manager') return transportModules.has(module);
  if (role === 'Accounts/Admin Staff') return financeModules.has(module);
  return false;
}
export function canWritePath(role, path) {
  if (['/auth/sign-out','/auth/revoke-all-sessions', '/auth/change-password', '/auth/switch-role'].includes(path)) return true;
  if (role === 'Institute Admin') return true;
  if (path.startsWith('/records/')) return canWriteModule(role, decodeURIComponent(path.split('/')[2] || ''));
  if (/^\/(routes|students)(\/|$)/.test(path) || ['/telemetry', '/emergency'].includes(path)) return role === 'Transport Manager';
  if (path.startsWith('/payments/')) return role === 'Accounts/Admin Staff';
  return false;
}
