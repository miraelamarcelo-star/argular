import { Product, Sale } from './pos.entity';

export interface ProductRepository {
  getProducts(companyId: string): Promise<Product[]>;
  getProductById(id: string, companyId: string): Promise<Product | null>;
  saveProduct(product: Product, companyId: string): Promise<void>;
}

export interface SaleRepository {
  createSale(sale: Omit<Sale, 'id' | 'createdAt'>, companyId: string): Promise<Sale>;
  getSales(companyId: string): Promise<Sale[]>;
}
