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
    });
  }
}
