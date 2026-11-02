export type NewsletterKind = 'monthly' | 'weekly';
export type NewsletterStatus =
  | 'draft'
  | 'approved'
  | 'sending'
  | 'sent'
  | 'cancelled';

export interface NewsletterItem {
  title: string;
  text: string;
}

export interface NewsletterSection {
  emoji?: string;
  title: string;
  items: NewsletterItem[];
}

export interface NewsletterIssue {
  id: number | null;
  kind: NewsletterKind;
  period_start: string;
  period_end: string;
  subject: string;
  title: string;
  intro: string;
  sections: NewsletterSection[];
  outro: string;
  status: NewsletterStatus;
  approved_at?: string | null;
  sent_at?: string | null;
  sent_count?: number;
  failed_count?: number;
}

export interface NewsletterList {
  issues: NewsletterIssue[];
  unsubscribes: number;
}

export interface NewsletterSendResult {
  sent: number;
  failed: number;
  remaining: number;
  errors: string[];
}

export const NEWSLETTER_STATUS_LABEL: Record<NewsletterStatus, string> = {
  draft: 'Borrador',
  approved: 'Aprobado',
  sending: 'Enviando',
  sent: 'Enviado',
  cancelled: 'Cancelado',
};
