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
  userName: string | null;
  userLastName: string | null;
}
