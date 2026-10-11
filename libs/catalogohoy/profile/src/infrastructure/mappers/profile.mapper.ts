import { TenantListMapper } from '@catalogohoy/tenant';
import { Profile } from '../../domain';
import { ProfileResponse } from '../primitives';

export class ProfileMapper {
  static toDomain(profile: ProfileResponse) {
    return Profile.primitives({
      id: profile.user.id,
      name: profile.user.name,
      email: profile.user.email,
      photo: profile.user.photo ?? null,
      tenantList: TenantListMapper.toDomain(profile.tenants),
      notifyPlanExpiry: profile.user.notify_plan_expiry ?? true,
      notifyNewOrdersEmail: profile.user.notify_new_orders_email ?? true,
      notifyWeeklyReportEmail: profile.user.notify_weekly_report_email ?? true,
      notifyOrdersInapp: profile.user.notify_orders_inapp ?? true,
      notifyLowStock: profile.user.notify_low_stock ?? true,
      lowStockThreshold: profile.user.low_stock_threshold ?? 5,
      notifyCreditReminders: profile.user.notify_credit_reminders ?? true,
      creditReminderDays: profile.user.credit_reminder_days ?? 7,
    });
  }
}
