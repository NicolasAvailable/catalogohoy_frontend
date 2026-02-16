import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ProductStore } from '@catalogohoy/product';
import { RateStore, RateType } from '@catalogohoy/rate';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { whiteSpacesValidator } from '@shared/presenter';
import {
  ButtonComponent,
  CardComponent,
  IconComponent,
  InputNumberComponent,
  InputTextComponent,
  SelectComponent,
  SelectItemDirective,
  SelectSelectedItemDirective,
  TextareaComponent,
} from '@ui';
import { Order, OrderItem, OrderStatus } from '../../../domain/order';
import { OrderStore } from '../../../infrastructure/order.store';

@Component({
  selector: 'lib-order-save',
  standalone: true,
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    CardComponent,
    InputTextComponent,
    TextareaComponent,
    ButtonComponent,
    IconComponent,
    InputNumberComponent,
    SelectComponent,
    SelectItemDirective,
    SelectSelectedItemDirective,
  ],
  templateUrl: './order-save.html',
  styleUrl: './order-save.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class OrderSave implements OnInit {
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  public readonly orderStore = inject(OrderStore);
  public readonly productStore = inject(ProductStore);
  public readonly rateStore = inject(RateStore);

  public readonly form = inject(FormBuilder).group({
    name: ['', [Validators.required, whiteSpacesValidator()]],
    phone: [''],
    comments: [''],
    status: ['pending' as OrderStatus],
  });

  public readonly id = input<string | undefined>(undefined);
  public readonly products = signal<OrderItem[]>([]);
  public readonly isCreate = signal<boolean>(true);
  public readonly isSubmitting = signal<boolean>(false);
  public readonly totalBs = signal<number>(0);
  public readonly selectedRateType = signal<RateType>('bcv_usd');

  public readonly exchangeRate = computed(() => {
    const rate = this.rateStore.rate();
    if (!rate) return 0;
    const rateMap: Record<string, number> = {
      bcv_usd: rate.bcv_usd ?? 0,
      bcv_eur: rate.bcv_eur ?? 0,
      custom: rate.custom_rate ?? 0,
    };
    return rateMap[this.selectedRateType()] ?? 0;
  });

  public readonly rateOptions: {
    label: string;
    value: RateType;
    icon: string;
  }[] = [
    { label: 'Dólar BCV', value: 'bcv_usd', icon: 'dollar-sign' },
    { label: 'Euro BCV', value: 'bcv_eur', icon: 'euro' },
    { label: 'Personalizada', value: 'custom', icon: 'settings-2' },
  ];

  ngOnInit(): void {
    // Cargar productos disponibles
    this.productStore.productList$();

    // Cargar tasas de cambio
    this.rateStore.loadRates().then(() => {
      const rate = this.rateStore.rate();
      if (rate) {
        this.selectedRateType.set(rate.active_rate);
      }
    });

    // Si hay un ID, cargar la orden para edición
    const orderId = this.id();
    if (orderId) {
      this.isCreate.set(false);
      this.loadOrder(orderId);
    }
  }

  private async loadOrder(id: string) {
    const result = await this.orderStore.getOrderById(Number(id));
    if (result) {
      this.setValuesForm(result);
    }
  }

  private setValuesForm(order: Order) {
    this.form.controls.name.setValue(order.name);
    this.form.controls.phone.setValue(order.phone || '');
    this.form.controls.comments.setValue(order.comments || '');
    this.form.controls.status.setValue(order.status);
    this.products.set(order.products);
    this.totalBs.set(order.totalBs ?? 0);
  }

  public addProduct() {
    this.products.update((products) => [
      ...products,
      {
        productId: '',
        name: '',
        price: 0,
        quantity: 1,
        total: 0,
      },
    ]);
  }

  public removeProduct(index: number) {
    this.products.update((products) => products.filter((_, i) => i !== index));
  }

  public onProductSelect(index: number, productId: string) {
    const selectedProduct = this.productStore
      .productList()
      .products.find((p) => p.id === productId);

    if (selectedProduct) {
      this.products.update((products) => {
        const updated = [...products];
        updated[index] = {
          ...updated[index],
          productId: selectedProduct.id,
          name: selectedProduct.name,
          price: selectedProduct.price,
          photo: selectedProduct.photos?.[0],
          total: selectedProduct.price * updated[index].quantity,
        };
        return updated;
      });
    }
  }

  public onQuantityChange(index: number, quantity: number) {
    this.products.update((products) => {
      const updated = [...products];
      updated[index] = {
        ...updated[index],
        quantity: quantity || 1,
        total: updated[index].price * (quantity || 1),
      };
      return updated;
    });
  }

  public calculateTotal(): number {
    return this.products().reduce((sum, product) => sum + product.total, 0);
  }

  public recalculateTotalBs() {
    const totalUsd = this.calculateTotal();
    const rate = this.exchangeRate();
    this.totalBs.set(totalUsd * rate);
  }

  public async onRateTypeChange(rateType: RateType) {
    this.selectedRateType.set(rateType);

    // Actualizar la tasa activa globalmente
    const result = await this.rateStore.updateActiveRate(rateType);
    result.fold(
      (error: string) => {
        this.toastService.error(new Exception(error));
      },
      () => {
        this.toastService.success('Tasa activa actualizada');
        this.recalculateTotalBs();
      }
    );
  }

  public async save() {
    if (this.form.invalid) {
      this.toastService.error(
        'Por favor completa los campos requeridos' as unknown as Exception
      );
      return;
    }

    if (this.products().length === 0) {
      this.toastService.error(
        'Debes agregar al menos un producto' as unknown as Exception
      );
      return;
    }

    this.isSubmitting.set(true);

    const orderData = {
      name: this.form.controls.name.value as string,
      phone: this.form.controls.phone.value || undefined,
      comments: this.form.controls.comments.value || undefined,
      status: this.form.controls.status.value as OrderStatus,
      products: this.products(),
      totalUsd: this.calculateTotal(),
      totalBs: this.totalBs(),
    };

    try {
      if (this.isCreate()) {
        const result = await this.orderStore.createOrder(orderData);
        result.fold(
          (error) => {
            this.toastService.error(error as unknown as Exception);
            this.isSubmitting.set(false);
          },
          () => {
            this.toastService.success('Orden creada exitosamente');
            this.router.navigate(['/admin/orders']);
          }
        );
      } else {
        const result = await this.orderStore.updateOrder({
          id: Number(this.id()),
          ...orderData,
        });
        result.fold(
          (error) => {
            this.toastService.error(error as unknown as Exception);
            this.isSubmitting.set(false);
          },
          () => {
            this.toastService.success('Orden actualizada exitosamente');
            this.router.navigate(['/admin/orders']);
          }
        );
      }
    } catch {
      this.toastService.error('Error inesperado' as unknown as Exception);
      this.isSubmitting.set(false);
    }
  }
}
