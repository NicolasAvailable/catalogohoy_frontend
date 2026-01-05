import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ButtonComponent,
  CardComponent,
  IconComponent,
  InputNumberComponent,
  InputTextComponent,
  TextareaComponent,
} from '@ui';

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
  ],
  templateUrl: './save.html',
  styleUrl: './save.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Save {
  public readonly form = inject(FormBuilder).group({
    name: [],
    description: [],
    photo: [],
    price: [],
    price_promotional: [],
  });
}
