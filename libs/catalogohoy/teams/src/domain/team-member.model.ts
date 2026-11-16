export type TeamMemberStatus = 'pending' | 'accepted' | 'declined';

export interface TeamMember {
  id: number;
  teamId: number;
  userId: number | null;
  invitedEmail: string;
  status: TeamMemberStatus;
  inviteToken: string;
  inviteExpiresAt: string | null;
  createdAt: string;
  /** Set when the invitation email bounced (the address does not exist). */
  bouncedAt: string | null;
  userName: string | null;
  userLastName: string | null;
}
