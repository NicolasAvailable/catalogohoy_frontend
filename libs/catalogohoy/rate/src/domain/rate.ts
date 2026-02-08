export type RateType = 'bcv_usd' | 'bcv_eur' | 'custom';

export interface ExchangeRate {
  id?: number;
  tenant_id?: number;
  bcv_usd: number;
  bcv_eur: number;
  custom_rate: number;
  active_rate: RateType;
  last_sync?: string;
  updated_at?: string;
}

export interface RateHistory {
  id: number;
  rate_type: 'bcv_usd' | 'bcv_eur' | 'custom';
  value: number;
  created_at: string;
}
