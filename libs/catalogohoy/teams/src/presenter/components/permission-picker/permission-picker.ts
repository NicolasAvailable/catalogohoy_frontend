import { NgClass } from '@angular/common';
import {
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { CheckboxComponent } from '@ui';
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
  imports: [NgClass, LucideAngularModule, FormsModule, CheckboxComponent],
  templateUrl: './permission-picker.html',
  styleUrl: './permission-picker.css',
})
export class PermissionPickerComponent {
  readonly memberId = input<number>(0);
  readonly currentPermissions = input<PermissionKey[]>([]);
  readonly disabled = input<boolean>(false);
  readonly hideActions = input<boolean>(false);

  readonly save = output<{ memberId: number; permissions: PermissionKey[] }>();
  readonly cancel = output<void>();
  readonly permissionsChange = output<PermissionKey[]>();

  protected readonly expandedModule = signal<PermissionModule | null>(null);
  protected readonly localPermissions = signal<Set<PermissionKey>>(new Set());

  constructor() {
    effect(() => {
      this.localPermissions.set(new Set(this.currentPermissions()));
    });
  }

  protected readonly modules = Object.keys(MODULE_ACTIONS) as PermissionModule[];
  protected readonly MODULE_LABELS = MODULE_LABELS;
  protected readonly MODULE_ACTIONS = MODULE_ACTIONS;
  protected readonly ACTION_LABELS = ACTION_LABELS;

  protected moduleCount = computed(() => {
    const perms = this.localPermissions();
    return (mod: PermissionModule) =>
      MODULE_ACTIONS[mod].filter((a) => perms.has(`${mod}:${a}`)).length;
  });

  protected readonly allSelected = computed(() => {
    const perms = this.localPermissions();
    return this.modules.every((mod) =>
      MODULE_ACTIONS[mod].every((action) => perms.has(`${mod}:${action}`))
    );
  });

  protected toggleAll(): void {
    if (this.disabled()) return;
    if (this.allSelected()) {
      this.localPermissions.set(new Set());
    } else {
      const all = new Set<PermissionKey>();
      for (const mod of this.modules) {
        for (const action of MODULE_ACTIONS[mod]) {
          all.add(`${mod}:${action}` as PermissionKey);
        }
      }
      this.localPermissions.set(all);
    }
    this.permissionsChange.emit(Array.from(this.localPermissions()));
  }

  protected toggleModule(mod: PermissionModule): void {
    this.expandedModule.update((current) => (current === mod ? null : mod));
  }

  protected isModuleAllSelected(mod: PermissionModule): boolean {
    const perms = this.localPermissions();
    return MODULE_ACTIONS[mod].every((action) => perms.has(`${mod}:${action}`));
  }

  protected isModulePartiallySelected(mod: PermissionModule): boolean {
    const count = this.moduleCount()(mod);
    return count > 0 && !this.isModuleAllSelected(mod);
  }

  protected toggleAllModule(mod: PermissionModule): void {
    if (this.disabled()) return;
    const allSelected = this.isModuleAllSelected(mod);
    this.localPermissions.update((set) => {
      const next = new Set(set);
      for (const action of MODULE_ACTIONS[mod]) {
        const key = `${mod}:${action}` as PermissionKey;
        if (allSelected) {
          next.delete(key);
        } else {
          next.add(key);
        }
      }
      return next;
    });
    this.permissionsChange.emit(Array.from(this.localPermissions()));
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
    this.permissionsChange.emit(Array.from(this.localPermissions()));
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
