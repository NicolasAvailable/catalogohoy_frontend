import { NgClass } from '@angular/common';
import {
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  ACTION_LABELS,
  MODULE_ACTIONS,
  MODULE_LABELS,
  PermissionAction,
  PermissionKey,
  PermissionModule,
} from '../../../domain';

@Component({
  selector: 'lib-permission-picker',
  standalone: true,
  imports: [NgClass, LucideAngularModule],
  templateUrl: './permission-picker.html',
  styleUrl: './permission-picker.css',
})
export class PermissionPickerComponent {
  readonly memberId = input.required<number>();
  readonly currentPermissions = input<PermissionKey[]>([]);
  readonly disabled = input<boolean>(false);

  readonly save = output<{ memberId: number; permissions: PermissionKey[] }>();
  readonly cancel = output<void>();

  protected readonly expandedModule = signal<PermissionModule | null>(null);
  protected readonly localPermissions = signal<Set<PermissionKey>>(new Set());

  protected readonly modules = Object.keys(MODULE_ACTIONS) as PermissionModule[];
  protected readonly MODULE_LABELS = MODULE_LABELS;
  protected readonly MODULE_ACTIONS = MODULE_ACTIONS;
  protected readonly ACTION_LABELS = ACTION_LABELS;

  protected moduleCount = computed(() => {
    const perms = this.localPermissions();
    return (mod: PermissionModule) =>
      MODULE_ACTIONS[mod].filter((a) => perms.has(`${mod}:${a}`)).length;
  });

  constructor() {
    effect(() => {
      this.localPermissions.set(new Set(this.currentPermissions()));
    });
  }

  protected toggleModule(mod: PermissionModule): void {
    this.expandedModule.update((current) => (current === mod ? null : mod));
  }

  protected togglePermission(mod: PermissionModule, action: PermissionAction): void {
    if (this.disabled()) return;
    const key: PermissionKey = `${mod}:${action}`;
    this.localPermissions.update((set) => {
      const next = new Set(set);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  protected hasPermission(mod: PermissionModule, action: PermissionAction): boolean {
    return this.localPermissions().has(`${mod}:${action}`);
  }

  protected onSave(): void {
    this.save.emit({
      memberId: this.memberId(),
      permissions: Array.from(this.localPermissions()),
    });
  }

  protected onCancel(): void {
    this.cancel.emit();
  }
}
