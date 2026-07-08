import { AuditLog } from '../models/AuditLog.js';

export const logAudit = async ({ adminId, action, previousValue, newValue, module, req, targetUser, reason }) => {
  try {
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || '';
    const browser = req?.headers?.['user-agent'] || '';

    await AuditLog.create({
      admin: adminId,
      action,
      previousValue,
      newValue,
      module,
      ipAddress,
      browser,
      targetUser,
      reason
    });
  } catch (err) {
    console.error('[AuditLogger] Failed to write audit log:', err.message);
  }
};
