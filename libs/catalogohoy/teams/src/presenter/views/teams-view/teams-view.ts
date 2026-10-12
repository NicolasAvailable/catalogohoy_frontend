import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Exception } from '@shared/domain';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { OrderService, Order } from '@catalogohoy/order';
import { PlanStore } from '@catalogohoy/plan';
import { Product, ProductService } from '@catalogohoy/product';
import { TenantStore } from '@catalogohoy/tenant';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideAngularModule } from 'lucide-angular';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import {
  ButtonComponent,
  ConfirmDialogComponent,
  IconComponent,
  PremiumUpgradePromptComponent,
  TabPanelDirective,
  TabsComponent,
  type TabHeader,
} from '@ui';
import { ToastService } from '@shared/infrastructure';
import { SkeletonModule } from 'primeng/skeleton';
import { TeamPermissionsStore } from '../../../infrastructure/team-permissions.store';
import { TeamStore } from '../../../infrastructure/team.store';
import { ActivityLogService } from '../../../infrastructure/activity-log.service';
import {
  ACTIVITY_ACTION_LABELS,
  ActivityLogEntry,
  FIELD_LABELS,
  MODULE_ACTIONS,
  PermissionAction,
  PermissionKey,
  PermissionModule,
  TeamMember,
} from '../../../domain';
import { InviteMemberDialogComponent } from '../../components/invite-member-dialog/invite-member-dialog';
import { PermissionPickerComponent } from '../../components/permission-picker/permission-picker';
import { FormsModule } from '@angular/forms';
import { TooltipModule } from 'primeng/tooltip';

type TabKey = 'members' | 'history';

@Component({
  selector: 'lib-teams-view',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    ButtonComponent,
    IconComponent,
    ConfirmDialogComponent,
    InviteMemberDialogComponent,
    PermissionPickerComponent,
    PaginatorModule,
    FormsModule,
    TooltipModule,
    SkeletonModule,
    TabsComponent,
    TabPanelDirective,
    PremiumUpgradePromptComponent,
    TranslocoPipe,
  ],
  templateUrl: './teams-view.html',
  styleUrl: './teams-view.css',
})

export default class TeamsViewComponent implements OnInit {
  protected readonly teamStore = inject(TeamStore);
  protected readonly planStore = inject(PlanStore);
  protected readonly permissionsStore = inject(TeamPermissionsStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly activityLogService = inject(ActivityLogService);
  private readonly productService = inject(ProductService);
  private readonly orderService = inject(OrderService);
  private readonly toaster = inject(ToastService);
  private readonly router = inject(Router);

  // Tab state
  protected readonly activeTab = signal<TabKey>('members');
  protected readonly tabHeaders: TabHeader[] = [
    { ref: 'members', label: 'Miembros' },
    { ref: 'history', label: 'Historial' },
  ];

  // History state
  protected readonly historyEntries = signal<ActivityLogEntry[]>([]);
  protected readonly historyTotalCount = signal(0);
  protected readonly historyPage = signal(1);
  protected readonly historyPageSize = signal(20);
  protected readonly historyLoading = signal(false);

  // Current user email — used to mark "(tú)" next to their own row.
  protected readonly currentUserEmail = signal<string | null>(null);

  // History accordion: which entry is expanded + lazy-loaded entity cache.
  protected readonly expandedEntryId = signal<number | null>(null);
  protected readonly entityCache = signal<
    Record<number, { loading: boolean; product?: Product; order?: Order; missing?: boolean }>
  >({});

  protected readonly canInvite = computed(
    () => this.permissionsStore.isOwner() || this.permissionsStore.can()('equipo', 'invite')
  );
  protected readonly canEditPermissions = computed(
    () => this.permissionsStore.isOwner() || this.permissionsStore.can()('equipo', 'edit')
  );
  protected readonly canRemove = computed(
    () => this.permissionsStore.isOwner() || this.permissionsStore.can()('equipo', 'delete')
  );

  /** A member with `equipo:edit` could otherwise self-grant any permission
   *  by editing their own row. RLS in Supabase rejects this anyway, but we
   *  block it at the UI level so the user gets clear "no puedes editarte
   *  a ti mismo" feedback instead of a generic RLS error.
   *  Owners never appear in the members list (they have implicit
   *  full access), so this rule reduces to "never let me edit my own row". */
  protected canEditMember(member: TeamMember): boolean {
    if (!this.canEditPermissions()) return false;
    return !this.isCurrentUser(member.invitedEmail);
  }

  /** Same idea as `canEditMember` but for the remove button — a member
   *  shouldn't be able to remove themselves from the team (RLS would reject
   *  it anyway, and the result would leave them mid-page with no warning). */
  protected canRemoveMember(member: TeamMember): boolean {
    if (!this.canRemove()) return false;
    return !this.isCurrentUser(member.invitedEmail);
  }
  protected readonly teamFull = computed(() => !this.teamStore.canInviteMore());

  protected readonly totalPermissions = Object.values(MODULE_ACTIONS).reduce(
    (sum, actions) => sum + actions.length,
    0
  );

  protected readonly expandedMemberId = signal<number | null>(null);
  protected readonly memberPermissionsCache = signal<Record<number, PermissionKey[] | undefined>>({});
  protected readonly savingMemberId = signal<number | null>(null);
  protected readonly pendingRemoveMemberId = signal<number | null>(null);

  @ViewChild(InviteMemberDialogComponent) inviteDialog!: InviteMemberDialogComponent;
  @ViewChild(ConfirmDialogComponent) confirmDialog!: ConfirmDialogComponent;

  async ngOnInit(): Promise<void> {
    // Pull the auth email so we can mark "(tú)" on the member's own row.
    const client = SupabaseClientProvider.getInstance();
    const { data } = await client.auth.getUser();
    this.currentUserEmail.set(data.user?.email ?? null);

    await this.planStore.loadTenantPlanUsage();
    await this.teamStore.load();
    await Promise.all(
      this.teamStore.acceptedMembers().map(async (member) => {
        const perms = await this.teamStore.getMemberPermissions(member.id);
        this.memberPermissionsCache.update((cache) => ({
          ...cache,
          [member.id]: perms ?? [],
        }));
      })
    );
  }

  protected openInviteDialog(): void {
    this.inviteDialog.show();
  }

  protected goToPlans(): void {
    this.router.navigate(['/admin/plans']);
  }

  protected async togglePermissions(member: TeamMember): Promise<void> {
    // Belt-and-suspenders: the click handler in the template is already
    // gated by `canEditMember`, but if anyone calls this method directly
    // (or a future template tweak forgets the gate) we still refuse to
    // open the editor for the current user's own row.
    if (!this.canEditMember(member)) return;

    const currentExpanded = this.expandedMemberId();
    if (currentExpanded === member.id) {
      this.expandedMemberId.set(null);
      return;
    }
    this.expandedMemberId.set(member.id);
    if (this.memberPermissionsCache()[member.id] === undefined) {
      const perms = await this.teamStore.getMemberPermissions(member.id);
      this.memberPermissionsCache.update((cache) => ({
        ...cache,
        [member.id]: perms ?? [],
      }));
    }
  }

  protected async onSavePermissions(event: {
    memberId: number;
    permissions: PermissionKey[];
  }): Promise<void> {
    const member = this.teamStore.acceptedMembers().find((m) => m.id === event.memberId);
    if (member && !this.canEditMember(member)) {
      this.toaster.error(
        new Exception('No puedes modificar tus propios permisos. Pídeselo al dueño del catálogo.')
      );
      return;
    }

    this.savingMemberId.set(event.memberId);
    const perms = event.permissions.map((key) => {
      const [module, action] = key.split(':') as [PermissionModule, PermissionAction];
      return { module, action };
    });
    const error = await this.teamStore.savePermissions(event.memberId, perms);
    this.savingMemberId.set(null);
    if (error) {
      this.toaster.error(new Exception(this.translatePermissionError(error)));
      return;
    }
    this.memberPermissionsCache.update((cache) => ({
      ...cache,
      [event.memberId]: event.permissions,
    }));
    this.toaster.success('Permisos actualizados');
  }

  /** Translate RLS / Postgres errors that bubble up from the Supabase
   *  client into a message the user can act on. The DB rejects writes when
   *  a non-owner tries to grant themselves more access (or remove
   *  themselves) — the raw message is "new row violates row-level
   *  security policy", which is opaque for end users. */
  private translatePermissionError(rawError: string): string {
    const lower = rawError.toLowerCase();
    if (lower.includes('row-level security') || lower.includes('row level security') || lower.includes('policy')) {
      return 'No tienes permiso para realizar esta acción. Solo el dueño del catálogo puede modificar permisos del equipo.';
    }
    return rawError;
  }

  protected onCancelPermissions(): void {
    this.expandedMemberId.set(null);
  }

  protected removeMember(memberId: number): void {
    const member = this.teamStore.members().find((m) => m.id === memberId);
    if (member && !this.canRemoveMember(member)) {
      this.toaster.error(
        new Exception('No puedes eliminarte a ti mismo del equipo. Pídeselo al dueño del catálogo.')
      );
      return;
    }
    this.pendingRemoveMemberId.set(memberId);
    this.confirmDialog.warning();
  }

  protected async onConfirmRemove(): Promise<void> {
    const memberId = this.pendingRemoveMemberId();
    if (memberId === null) return;
    const member = this.teamStore.members().find((m) => m.id === memberId);
    await this.teamStore.removeMember(memberId);
    this.pendingRemoveMemberId.set(null);
    if (member?.status === 'pending') {
      this.toaster.success('Invitación cancelada');
    } else {
      this.toaster.success('Miembro eliminado del equipo');
    }
  }

  protected getConfirmRemoveContent(): string {
    const memberId = this.pendingRemoveMemberId();
    if (memberId === null) return '';
    const member = this.teamStore.members().find((m) => m.id === memberId);
    if (member?.status === 'pending') {
      return `¿Cancelar la invitación enviada a <strong>${member.invitedEmail}</strong>?`;
    }
    return `¿Eliminar a <strong>${member?.invitedEmail}</strong> del equipo? Perderá acceso inmediatamente.`;
  }

  protected getMemberDisplayName(member: TeamMember): string | null {
    if (member.userName) {
      return member.userLastName
        ? `${member.userName} ${member.userLastName}`
        : member.userName;
    }
    return null;
  }

  protected getMemberInitial(nameOrEmail: string): string {
    return nameOrEmail.charAt(0).toUpperCase();
  }

  /** True when the given email matches the currently authenticated user. */
  protected isCurrentUser(email: string | null | undefined): boolean {
    const me = this.currentUserEmail();
    return !!me && !!email && me.toLowerCase() === email.toLowerCase();
  }

  // ── History tab ──────────────────────────────────────────

  protected async switchTab(tab: string | number | undefined): Promise<void> {
    if (tab !== 'members' && tab !== 'history') return;
    this.activeTab.set(tab);
    if (tab === 'history' && this.historyEntries().length === 0) {
      await this.loadHistory();
    }
  }

  protected async loadHistory(): Promise<void> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return;

    this.historyLoading.set(true);
    const result = await this.activityLogService.getPage(
      tenantId,
      this.historyPage(),
      this.historyPageSize()
    );
    result.mapRight(({ entries, totalCount }) => {
      this.historyEntries.set(entries);
      this.historyTotalCount.set(totalCount);
    });
    this.historyLoading.set(false);
  }

  protected async onHistoryPageChange(event: PaginatorState): Promise<void> {
    const pageSize = event.rows ?? 20;
    const page = Math.floor((event.first ?? 0) / pageSize) + 1;
    this.historyPage.set(page);
    this.historyPageSize.set(pageSize);
    await this.loadHistory();
  }

  protected getActionLabel(action: string): string {
    return ACTIVITY_ACTION_LABELS[action] ?? action;
  }

  protected getFieldLabel(field: string): string {
    return FIELD_LABELS[field] ?? field;
  }

  protected formatValue(val: unknown): string {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? 'Sí' : 'No';
    return String(val);
  }

  protected timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Justo ahora';
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Hace ${days}d`;
    return new Date(dateStr).toLocaleDateString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  protected getEntityIcon(entityType: string): string {
    const icons: Record<string, string> = {
      product: 'package',
      order: 'clipboard-list',
      category: 'tag',
      catalog: 'settings',
    };
    return icons[entityType] ?? 'activity';
  }

  // ── Accordion expand / lazy-load detail ──────────────────

  protected async toggleExpanded(entry: ActivityLogEntry): Promise<void> {
    const current = this.expandedEntryId();
    if (current === entry.id) {
      this.expandedEntryId.set(null);
      return;
    }
    this.expandedEntryId.set(entry.id);

    // Only product/order carry fetchable detail today. Skip if already cached.
    if (!entry.entityId) return;
    if (entry.entityType !== 'product' && entry.entityType !== 'order') return;

    const cached = this.entityCache()[entry.id];
    if (cached && (cached.product || cached.order || cached.missing)) return;

    this.entityCache.update((map) => ({
      ...map,
      [entry.id]: { loading: true },
    }));

    if (entry.entityType === 'product') {
      const result = await this.productService.getById(String(entry.entityId));
      this.entityCache.update((map) => ({
        ...map,
        [entry.id]: result.isRight()
          ? { loading: false, product: result.value as Product }
          : { loading: false, missing: true },
      }));
    } else if (entry.entityType === 'order') {
      const tenantId = await this.tenantStore.getTenantIdAsync();
      if (!tenantId) return;
      const result = await this.orderService.getOrderById(entry.entityId, tenantId);
      this.entityCache.update((map) => ({
        ...map,
        [entry.id]: result.isRight()
          ? { loading: false, order: result.value as Order }
          : { loading: false, missing: true },
      }));
    }
  }

  protected isExpanded(entryId: number): boolean {
    return this.expandedEntryId() === entryId;
  }

  protected getCachedProduct(entryId: number): Product | undefined {
    return this.entityCache()[entryId]?.product;
  }

  protected getCachedOrder(entryId: number): Order | undefined {
    return this.entityCache()[entryId]?.order;
  }

  protected isCacheLoading(entryId: number): boolean {
    return this.entityCache()[entryId]?.loading ?? false;
  }

  protected isCacheMissing(entryId: number): boolean {
    return this.entityCache()[entryId]?.missing ?? false;
  }
}
