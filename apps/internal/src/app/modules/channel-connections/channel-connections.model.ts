export type ChannelType = 'whatsapp' | 'instagram' | 'tiktok';

export interface ChannelConnection {
  channel: ChannelType;
  tenantId: number | null;
  tenantName: string | null;
  tenantSlug: string | null;
  /** Número de WhatsApp o usuario de la red social. */
  identity: string | null;
  displayName: string | null;
  connectedAt: string;
}

/** Los tres canales que rastreamos, en orden de lanzamiento. */
export const CHANNELS: ChannelType[] = ['whatsapp', 'instagram', 'tiktok'];

export function channelLabel(channel: ChannelType): string {
  switch (channel) {
    case 'whatsapp':
      return 'WhatsApp';
    case 'instagram':
      return 'Instagram';
    case 'tiktok':
      return 'TikTok';
  }
}

/** Icono de Lucide para cada canal (sin logos de marca en el interno). */
export function channelIcon(channel: ChannelType): string {
  switch (channel) {
    case 'whatsapp':
      return 'message-circle';
    case 'instagram':
      return 'instagram';
    case 'tiktok':
      return 'music';
  }
}
