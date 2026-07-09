import { Component, computed, inject, OnInit, signal } from '@angular/core';
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
  InputTextComponent,
  SelectComponent,
  TextareaComponent,
} from '@ui';
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

  public id?: string;
  public readonly isSaving = signal(false);

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
}
