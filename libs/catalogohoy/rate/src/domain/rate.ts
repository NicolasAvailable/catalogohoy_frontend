export type RateType = 'bcv_usd' | 'bcv_eur' | 'custom';

export interface ExchangeRate {
  id: number;
  bcv_usd: number;
  bcv_eur: number;
  custom_rate: number;
  active_rate: RateType;
  updated_at?: string;
}

export interface RateHistory {
  id: number;
  rate_type: RateType;
  value: number;
  created_at: string;
}
