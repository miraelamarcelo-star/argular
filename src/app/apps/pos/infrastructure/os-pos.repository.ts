import { Injectable, inject } from '@angular/core';
import { OsSdkService } from '../../../sdk/os-sdk.service';
import { ProductRepository, SaleRepository } from '../domain/pos.repository';
import { Product, Sale } from '../domain/pos.entity';
import { OsDatabaseNamespace } from '../../../contracts/os/os-database.contract';

@Injectable({
  providedIn: 'root'
})
export class OsProductRepository implements ProductRepository {
  private osSdk = inject(OsSdkService);
  private ns: OsDatabaseNamespace;
  
  constructor() {
    this.ns = this.osSdk.bind('app_pos').storage;
  }

  async getProducts(companyId: string): Promise<Product[]> {
    const items = await this.ns.query<Product>();
    const filtered = items.map((i) => i.value).filter((p) => p.companyId === companyId);
    if (filtered.length > 0) return filtered;

    // Seed conditionally: only auto-seed for the developer sandbox/demo workspace ('comp_1')
    if (companyId !== 'comp_1') {
      return [];
    }

    // Catálogo inicial de produtos para o tenant de demonstração
    const seed: Product[] = [
      { id: `prod_${companyId}_1`, companyId, name: 'Combo Burger Especial 180g', price: 36.90, stock: 45, category: 'Lanches' },
      { id: `prod_${companyId}_2`, companyId, name: 'Refrigerante Lata 350ml', price: 6.50, stock: 120, category: 'Bebidas' },
      { id: `prod_${companyId}_3`, companyId, name: 'Batata Rústica com Alecrim', price: 16.00, stock: 60, category: 'Acompanhamentos' },
      { id: `prod_${companyId}_4`, companyId, name: 'Sundae de Caramelo & Nozes', price: 13.50, stock: 30, category: 'Sobremesas' },
      { id: `prod_${companyId}_5`, companyId, name: 'Água Mineral sem Gás 500ml', price: 4.50, stock: 80, category: 'Bebidas' },
      { id: `prod_${companyId}_6`, companyId, name: 'Suco Natural de Laranja 400ml', price: 9.90, stock: 40, category: 'Bebidas' }
    ];

    for (const p of seed) {
      await this.ns.put(p.id, p);
    }
    return seed;
  }

  async getProductById(id: string, companyId: string): Promise<Product | null> {
    const product = await this.ns.get<Product>(id);
    if (product && product.companyId !== companyId) {
      return null; // Security Tenant Mismatch Defense
    }
    return product;
  }

  async saveProduct(product: Product, companyId: string): Promise<void> {
    if (product.companyId !== companyId) {
      throw new Error('Tenant Mismatch: Tentativa inválida de gravação de produto de outro tenant.');
    }
    await this.ns.put(product.id, product);
  }
}

@Injectable({
  providedIn: 'root'
})
export class OsSaleRepository implements SaleRepository {
  private osSdk = inject(OsSdkService);
  private ns: OsDatabaseNamespace;

  constructor() {
    this.ns = this.osSdk.bind('app_pos').storage;
  }

  async createSale(saleData: Omit<Sale, 'id' | 'createdAt'>, companyId: string): Promise<Sale> {
    if (saleData.companyId !== companyId) {
      throw new Error('Tenant Mismatch: Tentativa inválida de gravação de venda para outro tenant.');
    }

    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    const newId = `sale_${uuid}`;
    const sale: Sale = {
      ...saleData,
      id: newId,
      createdAt: new Date().toISOString()
    };
    
    // Grava no storage local com namespace isolado
    await this.ns.put(newId, sale);

    // Notifica o barramento de eventos do OS
    const app = this.osSdk.bind('app_pos');
    app.events.publish('sale.completed', sale);

    // Registra na fila de sincronização outbox do OS
    await app.sync.queueOperation('sale.create', sale);

    // Registra métrica e log estruturado
    app.logger.info(`Venda #${sale.id} registrada com sucesso`, {
      saleId: sale.id,
      total: sale.total,
      paymentMethod: sale.paymentMethod
    });

    return sale;
  }

  async getSales(companyId: string): Promise<Sale[]> {
    const items = await this.ns.query<Sale>();
    return items.map((i) => i.value).filter((s) => s.companyId === companyId);
  }
}
