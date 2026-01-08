import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ButtonComponent,
  CardComponent,
  IconComponent,
  InputNumberComponent,
  InputTextComponent,
  RadioButtonComponent,
  TextareaComponent,
} from '@ui';
import { ProductFacade } from '../../../application';
import { CreateProductInput } from '../../../domain';

@Component({
  selector: 'lib-save',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    CardComponent,
    InputTextComponent,
    TextareaComponent,
    ButtonComponent,
    IconComponent,
    InputNumberComponent,
    RadioButtonComponent,
  ],
  templateUrl: './save.html',
  styleUrl: './save.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Save {
  private readonly productFacade = inject(ProductFacade);
  public readonly form = inject(FormBuilder).group({
    name: ['', [Validators.required]],
    description: ['', [Validators.required]],
    photo: [''],
    price: ['', [Validators.required]],
    pricePromotional: ['', [Validators.required]],
    stock: [null],
  });

  public create() {
    if (this.form.invalid) return;
    const body = this.form.getRawValue();
    this.productFacade.create(body as unknown as CreateProductInput);
  }
}
