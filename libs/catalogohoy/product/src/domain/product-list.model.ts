import { EntityList } from '@shared/domain';
import { Product } from './product.model';

export class ProductList extends EntityList<Product> {
  constructor(public readonly products: Product[]) {
    super(ProductList, products);
  }

  public static from(products: Product[]) {
    return new ProductList(products);
  }

  public static empty() {
    return new ProductList([]);
  }
}
