// Consumo de IA entre todos los usuarios. Fuente: tabla ai_usage_log, que los
// edge functions fal-ai-images / improve-text escriben tras cada generación
// exitosa. Se lee vía RPCs admin (ai_usage_stats_admin, list_ai_usage_logs_admin).

export interface AiUsageFeatureStat {
  feature: string;
  generations: number;
  credits: number;
}

export interface AiUsageTopUser {
  userId: number | null;
  userName: string | null;
  userEmail: string | null;
  generations: number;
  credits: number;
}

export interface AiUsageDay {
  day: string;
  credits: number;
  generations: number;
}

export interface AiUsageStats {
  totalCredits: number;
  totalGenerations: number;
  usersCount: number;
  byFeature: AiUsageFeatureStat[];
  topUsers: AiUsageTopUser[];
  last30d: AiUsageDay[];
}

export interface AiUsageLog {
  id: number;
  userId: number | null;
  userName: string | null;
  userEmail: string | null;
  /** Catálogo default del owner (el log solo guarda el dueño, no el tenant puntual). */
  catalogName: string | null;
  feature: string;
  prompt: string | null;
  credits: number;
  createdAt: string;
}

/** Etiqueta legible para cada feature de IA registrada en el log. */
export function featureLabel(feature: string): string {
  switch (feature) {
    case 'image_generate':
      return 'Generar imagen';
    case 'image_edit':
      return 'Editar imagen';
    case 'image_remove_bg':
      return 'Quitar fondo';
    case 'image_segment':
      return 'Recorte manual';
    case 'improve_text':
      return 'Mejorar texto';
    default:
      return feature;
  }
}

/** Icono (Lucide) representativo de cada feature. */
export function featureIcon(feature: string): string {
  switch (feature) {
    case 'image_generate':
    case 'image_edit':
      return 'sparkles';
    case 'image_remove_bg':
    case 'image_segment':
      return 'image';
    case 'improve_text':
      return 'type';
    default:
      return 'sparkles';
  }
}

export const FEATURE_FILTERS: { value: string | null; label: string }[] = [
  { value: null, label: 'Todas' },
  { value: 'image_generate', label: 'Generar imagen' },
  { value: 'image_edit', label: 'Editar imagen' },
  { value: 'image_remove_bg', label: 'Quitar fondo' },
  { value: 'image_segment', label: 'Recorte manual' },
  { value: 'improve_text', label: 'Mejorar texto' },
];
