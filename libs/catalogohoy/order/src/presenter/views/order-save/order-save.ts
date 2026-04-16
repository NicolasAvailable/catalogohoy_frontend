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
import { EcommerceConfigStore, TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
import { TenantStore } from '@catalogohoy/tenant';
import { TeamPermissionsStore } from '@catalogohoy/teams';
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
  DatepickerComponent,
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
    DatepickerComponent,
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
  private readonly configStore = inject(EcommerceConfigStore);
  public readonly tenantCurrency = inject(TenantCurrencyStore);
  private readonly tenantStore = inject(TenantStore);
  // Venezuela exception: products are priced in USD internally (dual with
  // Bs. via BCV rate). Force '$' in the create/edit order form so prices
  // displayed next to product options match the stored values.
  public readonly cs = computed(() => {
    if (this.tenantCurrency.isVenezuela()) return '$';
    return (
      this.tenantCurrency.localSymbol() ||
      this.configStore.config()?.currencySymbol ||
      '$'
    );
  });
  private readonly permissions = inject(TeamPermissionsStore);
  protected readonly canEditOrder = computed(() => this.permissions.isOwner() || this.permissions.can()('ordenes', 'edit'));

  private static readonly CUSTOM_PRODUCT_ID = '__custom__';

  public readonly selectableProducts = computed(() => {
    const real = this.productStore.productList().products;
    const customOption = {
      id: OrderSave.CUSTOM_PRODUCT_ID,
      name: 'Otros',
      price: 0,
      photos: [] as string[],
      isWholesale: false,
      wholesaleTiers: [] as { title: string; price: number }[],
    };
    return [customOption, ...real];
  });

  public readonly form = inject(FormBuilder).group({
    name: ['', [Validators.required, whiteSpacesValidator()]],
    phone: [''],
    comments: [''],
    status: ['pending' as OrderStatus],
    // Default: today. Admin can pick any date via the datepicker.
    deliveryDate: [new Date() as Date | null, [Validators.required]],
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
    // Prime tenant currency cache (localStorage → DB fallback)
    this.tenantStore.getTenantIdAsync().then((tid) => {
      if (tid) this.tenantCurrency.load(tid);
    });

    // Cargar tasas de cambio
    this.rateStore.loadRates().then(() => {
      const rate = this.rateStore.rate();
      if (rate) {
        this.selectedRateType.set(rate.active_rate);
      }
    });

    // Cargar productos primero, luego la orden (para que el select tenga opciones)
    this.productStore.productList$().then(() => {
      const orderId = this.id();
      if (orderId) {
        this.isCreate.set(false);
        this.loadOrder(orderId);
      }
    });
  }

  private async loadOrder(id: string) {
    const result = await this.orderStore.getOrderById(Number(id));
    if (result) {
      this.setValuesForm(result);
    }
  }

  /** Format a Date as "YYYY-MM-DD" in local time. `toISOString()` would
   *  shift by the timezone offset and can land on a different calendar day. */
  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private setValuesForm(order: Order) {
    this.form.controls.name.setValue(order.name);
    this.form.controls.phone.setValue(order.phone || '');
    this.form.controls.comments.setValue(order.comments || '');
    this.form.controls.status.setValue(order.status);
    if (order.deliveryDate) {
      // Parse "YYYY-MM-DD" as local date (avoid the UTC-shift that new Date(iso) causes).
      const [y, m, d] = order.deliveryDate.split('-').map(Number);
      this.form.controls.deliveryDate.setValue(new Date(y, m - 1, d));
    }

    const storeProducts = this.productStore.productList().products;
    this.products.set(
      order.products.map((p) => {
        const match = storeProducts.find((sp) => String(sp.id) === String(p.productId));
        return {
          ...p,
          productId: match ? match.id : p.productId,
        };
      })
    );
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

  public addCustomProduct() {
    this.products.update((products) => [
      ...products,
      {
        productId: OrderSave.CUSTOM_PRODUCT_ID,
        name: '',
        price: 0,
        quantity: 1,
        total: 0,
        isCustom: true,
        description: '',
      },
    ]);
  }

  public cancelCustomProduct(index: number) {
    this.products.update((products) => {
      const updated = [...products];
      updated[index] = {
        productId: '',
        name: '',
        price: 0,
        quantity: 1,
        total: 0,
        isCustom: false,
        description: undefined,
      };
      return updated;
    });
  }

  public removeProduct(index: number) {
    this.products.update((products) => products.filter((_, i) => i !== index));
  }

  public onProductSelect(index: number, productId: string) {
    if (productId === OrderSave.CUSTOM_PRODUCT_ID) {
      this.products.update((products) => {
        const updated = [...products];
        updated[index] = {
          ...updated[index],
          productId: OrderSave.CUSTOM_PRODUCT_ID,
          name: '',
          price: 0,
          photo: undefined,
          total: 0,
          isCustom: true,
          description: '',
        };
        return updated;
      });
      return;
    }

    const selectedProduct = this.productStore
      .productList()
      .products.find((p) => p.id === productId);

    if (selectedProduct) {
      const price = selectedProduct.isWholesale && selectedProduct.wholesaleTiers.length > 0
        ? selectedProduct.wholesaleTiers[0].price
        : selectedProduct.pricePromotional > 0
          ? selectedProduct.pricePromotional
          : selectedProduct.price;

      this.products.update((products) => {
        const updated = [...products];
        updated[index] = {
          ...updated[index],
          productId: selectedProduct.id,
          name: selectedProduct.name,
          price,
          photo: selectedProduct.photos?.[0],
          total: price * updated[index].quantity,
          isCustom: false,
        };
        return updated;
      });
    }
  }

  public onCustomNameChange(index: number, name: string) {
    this.products.update((products) => {
      const updated = [...products];
      updated[index] = { ...updated[index], name };
      return updated;
    });
  }

  public onCustomDescriptionChange(index: number, description: string) {
    this.products.update((products) => {
      const updated = [...products];
      updated[index] = { ...updated[index], description };
      return updated;
    });
  }

  public onCustomPriceChange(index: number, price: number) {
    const safePrice = price || 0;
    this.products.update((products) => {
      const updated = [...products];
      updated[index] = {
        ...updated[index],
        price: safePrice,
        total: safePrice * updated[index].quantity,
      };
      return updated;
    });
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

    const delivery = this.form.controls.deliveryDate.value;
    const orderData = {
      name: this.form.controls.name.value as string,
      phone: this.form.controls.phone.value || undefined,
      comments: this.form.controls.comments.value || undefined,
      status: this.form.controls.status.value as OrderStatus,
      products: this.products(),
      totalUsd: this.calculateTotal(),
      totalBs: this.totalBs(),
      deliveryDate: delivery ? this.toIsoDate(delivery) : undefined,
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
