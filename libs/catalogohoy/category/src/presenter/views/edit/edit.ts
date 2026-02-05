import { Component, inject, OnInit } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ButtonComponent,
  CardComponent,
  CheckboxComponent,
  InputTextComponent,
  TextareaComponent,
} from '@ui';
import { CategoryFacade } from '../../../application';

@Component({
  selector: 'lib-category-edit',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    ButtonComponent,
    InputTextComponent,
    TextareaComponent,
    CheckboxComponent,
    CardComponent,
  ],
  templateUrl: './edit.html',
  styleUrl: './edit.css',
  host: {
    class: 'flex-1 flex flex-col min-h-0 container max-w-3xl mx-auto pb-8 px-4',
  },
})
export default class CategoryEdit implements OnInit {
  public readonly categoryFacade = inject(CategoryFacade);
  public readonly route = inject(ActivatedRoute);
  public readonly router = inject(Router);

  public id?: string;
  public form = new FormGroup({
    name: new FormControl('', [Validators.required]),
    description: new FormControl(''),
    isVisible: new FormControl(true),
  });

  async ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') ?? undefined;
    if (this.id) {
      const result = await this.categoryFacade.getById(this.id);
      result.mapRight((category) => {
        this.form.patchValue({
          name: category.name,
          description: category.description || '',
          isVisible: category.isVisible,
        });
      });
    }
  }

  public async onSave() {
    if (this.form.invalid || !this.id) return;
    const { name, description, isVisible } = this.form.value;

    if (!name || isVisible === null || isVisible === undefined) return;

    const result = await this.categoryFacade.update({
      id: this.id,
      name,
      description: description || undefined,
      isVisible,
    });

    result.mapRight(() =>
      this.router.navigate(['../../'], { relativeTo: this.route })
    );
  }
}
