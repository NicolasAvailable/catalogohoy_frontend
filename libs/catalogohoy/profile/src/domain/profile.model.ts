import { TenantList } from '@catalogohoy/tenant';
import { Entity } from '@shared/domain';

export class Profile extends Entity {
  constructor(
    public name: string,
    public email: string,
    public photo: string | null,
    public tenantList: TenantList,
    public notifyPlanExpiry: boolean = true,
    // Preferencias de aviso a nivel CUENTA (llegan al correo/panel de la persona,
    // no del catálogo). Default true = recibir.
    public notifyNewOrdersEmail: boolean = true,
    public notifyWeeklyReportEmail: boolean = true,
    public notifyOrdersInapp: boolean = true,
    // Aviso de stock bajo/agotado (email al dueño) + umbral configurable.
    public notifyLowStock: boolean = true,
    public lowStockThreshold: number = 5
  ) {
    super();
  }

  static empty() {
    return new Profile('', '', null, TenantList.empty(), true, true, true, true, true, 5);
  }

  static primitives(primitives: ProfilePrimitive) {
    return new Profile(
      primitives.name,
      primitives.email,
      primitives.photo,
      primitives.tenantList,
      primitives.notifyPlanExpiry ?? true,
      primitives.notifyNewOrdersEmail ?? true,
      primitives.notifyWeeklyReportEmail ?? true,
      primitives.notifyOrdersInapp ?? true,
      primitives.notifyLowStock ?? true,
      primitives.lowStockThreshold ?? 5
    ).withId(primitives.id);
  }
}

export interface ProfilePrimitive {
  id: number;
  name: string;
  email: string;
  photo: string | null;
  tenantList: TenantList;
  notifyPlanExpiry?: boolean;
  notifyNewOrdersEmail?: boolean;
  notifyWeeklyReportEmail?: boolean;
  notifyOrdersInapp?: boolean;
  notifyLowStock?: boolean;
  lowStockThreshold?: number;
}
