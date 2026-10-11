import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  ButtonComponent,
  CardComponent,
  CheckboxComponent,
  ConfirmDialogComponent,
  InputTextComponent,
  SelectComponent,
  TextareaComponent,
} from '@ui';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import { CategoryFacade } from '../../../application';
import { CategoryService } from '../../../infrastructure/category.service';

@Component({
  selector: 'lib-category-edit',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    TranslocoPipe,
    ButtonComponent,
    InputTextComponent,
    TextareaComponent,
    CheckboxComponent,
    CardComponent,
    SelectComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './edit.html',
  styleUrl: './edit.css',
  host: {
    class: 'flex-1 flex flex-col min-h-0 container max-w-3xl mx-auto pb-8 px-4',
  },
})
export default class CategoryEdit implements OnInit {
  public readonly categoryFacade = inject(CategoryFacade);
  public readonly categoryService = inject(CategoryService);
  public readonly route = inject(ActivatedRoute);
  public readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly permissions = inject(TeamPermissionsStore);

  public id?: string;
  public readonly isSaving = signal(false);

  // ── Ajuste masivo de precios de la categoría ────────────────────────────
  @ViewChild(ConfirmDialogComponent)
  public adjustConfirm!: ConfirmDialogComponent;

  /** La categoría "Ver todos" no agrupa productos → no tiene sentido ajustar. */
  public readonly isViewAll = signal(false);
  /** La sección de ajuste de precios solo se muestra a quien puede editar
   *  productos (dueño o miembro con permiso productos:edit) y nunca en "Ver
   *  todos". Evita exponer un control destructivo a roles de solo-lectura. */
  public readonly canAdjustPrices = computed(
    () =>
      !this.isViewAll() &&
      (this.permissions.isOwner() || this.permissions.can()('productos', 'edit'))
  );

  public readonly isAdjusting = signal(false);
  /** Mensaje (con conteo) que se muestra en el diálogo de confirmación. */
  public readonly adjustConfirmMessage = signal('');
  /** Ajuste pendiente de confirmar (calculado en el dry-run). */
  private pendingAdjust: { mode: 'percent' | 'fixed'; signedValue: number } | null =
    null;

  public readonly adjustModeOptions = [
    { label: 'Porcentaje (%)', value: 'percent' },
    { label: 'Monto fijo', value: 'fixed' },
  ];
  public readonly adjustDirectionOptions = [
    { label: 'Aumentar', value: 'increase' },
    { label: 'Descontar', value: 'discount' },
  ];

  public readonly adjustForm = new FormGroup({
    mode: new FormControl<'percent' | 'fixed'>('percent', { nonNullable: true }),
    direction: new FormControl<'increase' | 'discount'>('increase', {
      nonNullable: true,
    }),
    value: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
    ]),
  });

  /** Total categories — used to populate the position select. */
  public readonly totalCategories = signal(0);
  /** The position the category had when the page loaded (1-based). */
  private initialPosition = 0;

  public readonly positionOptions = computed(() =>
    Array.from({ length: this.totalCategories() }, (_, i) => i + 1)
  );

  public form = new FormGroup({
    name: new FormControl('', [Validators.required]),
    description: new FormControl(''),
    isVisible: new FormControl(true),
    position: new FormControl<number | null>(null),
  });

  async ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') ?? undefined;
    if (!this.id) return;

    // Fetch the full ordered list (no pagination) so we know both the
    // total count for the position dropdown AND the current 1-based
    // position of this category. Done in parallel with `getById` for
    // the rest of the form fields.
    const [byIdResult, listResult] = await Promise.all([
      this.categoryFacade.getById(this.id),
      this.categoryService.getAll(),
    ]);

    listResult.mapRight(({ list, total }) => {
      this.totalCategories.set(total);
      const idx = list.categories.findIndex(
        (c) => String(c.id) === this.id
      );
      this.initialPosition = idx >= 0 ? idx + 1 : 0;
      if (this.initialPosition > 0) {
        this.form.patchValue({ position: this.initialPosition });
      }
    });

    byIdResult.mapRight((category) => {
      this.isViewAll.set(category.isViewAll ?? false);
      this.form.patchValue({
        name: category.name,
        description: category.description || '',
        isVisible: category.isVisible,
      });
    });
  }

  public async onSave() {
    if (this.form.invalid || !this.id || this.isSaving()) return;
    const { name, description, isVisible, position } = this.form.value;

    if (!name || isVisible === null || isVisible === undefined) return;

    this.isSaving.set(true);

    const updateResult = await this.categoryFacade.update({
      id: this.id,
      name,
      description: description || undefined,
      isVisible,
    });

    if (updateResult.isLeft()) {
      this.isSaving.set(false);
      return;
    }

    // Persist the position change separately if it actually changed.
    if (
      position !== null &&
      position !== undefined &&
      position !== this.initialPosition
    ) {
      const moveResult = await this.categoryService.moveCategoryToPosition(
        this.id,
        position
      );
      if (moveResult.isLeft()) {
        this.isSaving.set(false);
        return;
      }
    }

    this.router.navigate(['../../'], { relativeTo: this.route });
  }

  /** Paso 1: valida, hace un dry-run para saber cuántos productos afecta y abre
   *  el diálogo de confirmación con ese conteo. */
  public async onApplyAdjust(): Promise<void> {
    if (!this.id || this.isAdjusting()) return;
    const { mode, direction, value } = this.adjustForm.getRawValue();
    // El input entrega texto: normalizamos la coma decimal (uso común en LatAm)
    // y validamos de verdad — antes un "3,5" pasaba el form pero Number() daba
    // NaN y el botón "no hacía nada" sin aviso.
    const val = Number(String(value ?? '').trim().replace(',', '.'));
    if (!isFinite(val) || val <= 0) {
      this.toastService.error(
        new Exception('Ingresá un valor válido (un número mayor a 0).')
      );
      return;
    }
    if (mode === 'percent' && direction === 'discount' && val >= 100) {
      this.toastService.error(
        new Exception('El descuento por porcentaje debe ser menor a 100%.')
      );
      return;
    }
    const signedValue = direction === 'increase' ? val : -val;

    this.isAdjusting.set(true);
    const result = await this.categoryService.adjustCategoryPrices(
      this.id,
      mode,
      signedValue,
      true
    );
    this.isAdjusting.set(false);

    result
      .mapRight((count) => {
        if (count === 0) {
          this.toastService.info(
            'Esta categoría no tiene productos para ajustar.'
          );
          return;
        }
        const verb =
          mode === 'percent'
            ? `${direction === 'increase' ? 'aumentar' : 'descontar'} ${val}%`
            : `${direction === 'increase' ? 'sumarle' : 'restarle'} ${val} al precio`;
        this.adjustConfirmMessage.set(
          `Vas a <strong>${verb}</strong> en los <strong>${count}</strong> producto${
            count === 1 ? '' : 's'
          } de esta categoría (incluye variantes y precios al mayor). ¿Continuar?`
        );
        this.pendingAdjust = { mode, signedValue };
        this.adjustConfirm.warning();
      })
      .mapLeft((err) => this.toastService.error(new Exception(err.message)));
  }

  /** Paso 2: confirmado → aplica el ajuste y avisa cuántos productos cambió. */
  public async onConfirmAdjust(): Promise<void> {
    if (!this.pendingAdjust || !this.id || this.isAdjusting()) return;
    const { mode, signedValue } = this.pendingAdjust;
    this.pendingAdjust = null;

    this.isAdjusting.set(true);
    const result = await this.categoryService.adjustCategoryPrices(
      this.id,
      mode,
      signedValue,
      false
    );
    this.isAdjusting.set(false);

    result
      .mapRight((count) => {
        this.toastService.success(
          `Precios actualizados en ${count} producto${count === 1 ? '' : 's'}.`
        );
        this.adjustForm.controls.value.reset();
      })
      .mapLeft((err) => this.toastService.error(new Exception(err.message)));
  }
}
