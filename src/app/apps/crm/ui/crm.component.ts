/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { GetCustomersUseCase, CreateCustomerUseCase } from '../application/crm.usecases';
import { Customer } from '../domain/customer.entity';
import { OsSdkService } from '../../../sdk/os-sdk.service';
import { OsContext } from '../../../contracts/os/os-context.contract';

export interface LoyaltyFeedItem {
  id: string;
  customerName: string;
  points: number;
  action: string;
  timestamp: Date;
}

@Component({
  selector: 'app-crm',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="h-full flex flex-col bg-slate-50 font-sans text-slate-800">
      <!-- Header Bar -->
      <header class="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-sm">
            <mat-icon class="text-xl">loyalty</mat-icon>
          </div>
          <div>
            <h2 class="text-lg font-bold text-slate-900 leading-tight flex items-center gap-2">
              CRM & Clube de Fidelidade
              <span class="text-[10px] font-mono uppercase bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-bold">Módulo OS</span>
            </h2>
            <p class="text-xs text-slate-500">Gestão de clientes, histórico de relacionamento e pontuação de cashback.</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button 
            (click)="showNewCustomerModal.set(true)"
            class="bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm">
            <mat-icon class="text-sm">person_add</mat-icon>
            Novo Cliente
          </button>
        </div>
      </header>

      <!-- Toast Feedback -->
      @if (feedbackMessage()) {
        <div class="bg-violet-50 border-b border-violet-200 px-6 py-2 text-xs text-violet-900 flex items-center justify-between">
          <span class="flex items-center gap-2 font-medium">
            <mat-icon class="text-violet-600 text-sm">info</mat-icon>
            {{ feedbackMessage() }}
          </span>
          <button (click)="feedbackMessage.set('')" class="text-violet-700 font-bold hover:underline">FECHAR</button>
        </div>
      }

      <!-- Main Content -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        <!-- Overview Metrics Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <mat-icon class="text-2xl">groups</mat-icon>
            </div>
            <div>
              <span class="text-xs text-slate-500 block">Clientes Ativos</span>
              <span class="text-xl font-bold text-slate-900">{{ customers().length }}</span>
            </div>
          </div>

          <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <mat-icon class="text-2xl">stars</mat-icon>
            </div>
            <div>
              <span class="text-xs text-slate-500 block">Pontos em Circulação</span>
              <span class="text-xl font-bold text-amber-600">{{ totalPoints() }} pts</span>
            </div>
          </div>

          <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <mat-icon class="text-2xl">workspace_premium</mat-icon>
            </div>
            <div>
              <span class="text-xs text-slate-500 block">Clientes VIP & Gold</span>
              <span class="text-xl font-bold text-emerald-600">{{ vipCount() }}</span>
            </div>
          </div>

          <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <mat-icon class="text-2xl">payments</mat-icon>
            </div>
            <div>
              <span class="text-xs text-slate-500 block">Consumo Acumulado</span>
              <span class="text-xl font-bold text-slate-900">R$ {{ totalSpent() | number:'1.2-2' }}</span>
            </div>
          </div>
        </div>

        <!-- Two Column Workspace Layout (Directory vs Live Hub) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          <!-- Column 1: Directory & Filter (Span 8) -->
          <div class="lg:col-span-8 space-y-4">
            
            <!-- Search and Filter Controls -->
            <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div class="relative w-full sm:w-80">
                <mat-icon class="absolute left-3 top-2.5 text-slate-400 text-sm">search</mat-icon>
                <input 
                  id="crm-search-input"
                  type="text" 
                  [value]="searchQuery()"
                  (input)="onSearchInput($event)"
                  placeholder="Buscar por nome ou telefone..." 
                  class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 font-sans">
              </div>

              <div class="flex items-center gap-2 w-full sm:w-auto">
                <label for="tier-filter-select" class="text-xs text-slate-500 whitespace-nowrap">Filtrar Categoria:</label>
                <select 
                  id="tier-filter-select"
                  [value]="selectedTierFilter()"
                  (change)="onTierFilterChange($event)"
                  class="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="ALL">Todas as Categorias</option>
                  <option value="Bronze">Bronze (Iniciante)</option>
                  <option value="Silver">Silver</option>
                  <option value="Gold">Gold</option>
                  <option value="VIP">VIP</option>
                </select>
              </div>
            </div>

            <!-- Customers Directory Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              @for (c of filteredCustomers(); track c.id) {
                <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4">
                  <div>
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <h3 class="font-bold text-slate-900 text-sm">{{ c.name }}</h3>
                        <span class="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <mat-icon class="text-[14px]">phone</mat-icon>
                          {{ c.phone }}
                        </span>
                        @if (c.email) {
                          <span class="text-[11px] text-slate-400 block mt-0.5 truncate">{{ c.email }}</span>
                        }
                      </div>
                      <span 
                        class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono shrink-0"
                        [ngClass]="{
                          'bg-amber-100 text-amber-800 border border-amber-300': c.tier === 'Bronze',
                          'bg-slate-200 text-slate-800 border border-slate-300': c.tier === 'Silver',
                          'bg-yellow-100 text-yellow-800 border border-yellow-300': c.tier === 'Gold',
                          'bg-purple-100 text-purple-900 border border-purple-300': c.tier === 'VIP'
                        }">
                        ★ {{ c.tier }}
                      </span>
                    </div>

                    <div class="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span class="text-slate-400 text-[11px] block">Saldo Fidelidade</span>
                        <span class="font-bold text-violet-700 text-sm">{{ c.points }} pts</span>
                      </div>
                      <div>
                        <span class="text-slate-400 text-[11px] block">Total Consumido</span>
                        <span class="font-bold text-slate-800 text-sm">R$ {{ c.totalSpent | number:'1.2-2' }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button 
                      (click)="printLoyaltyCard(c)"
                      class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                      title="Imprimir Extrato Térmico">
                      <mat-icon class="text-[16px] text-slate-500">receipt</mat-icon>
                      Extrato Impresso
                    </button>
                  </div>
                </div>
              }

              @if (filteredCustomers().length === 0) {
                <div class="col-span-full bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                  <mat-icon class="text-4xl text-slate-300 mb-2">person_search</mat-icon>
                  <p class="text-sm font-medium">Nenhum cliente encontrado com os filtros selecionados.</p>
                </div>
              }
            </div>

          </div>

          <!-- Column 2: Live Activity & Campaigns sidebar (Span 4) -->
          <div class="lg:col-span-4 space-y-6">
            
            <!-- Active Campaigns Card -->
            <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <mat-icon class="text-violet-600 text-sm">campaign</mat-icon>
                Regras de Pontuação Ativas
              </h3>
              <p class="text-[11px] text-slate-500">Configurações de campanhas e acúmulo de pontos no ecossistema.</p>
              
              <div class="space-y-3 pt-1">
                <div class="p-3 bg-violet-50/50 rounded-lg border border-violet-100 flex items-start gap-2.5">
                  <mat-icon class="text-violet-600 text-sm mt-0.5">stars</mat-icon>
                  <div>
                    <h4 class="text-xs font-bold text-slate-800">Regra Geral de Cashback</h4>
                    <p class="text-[10px] text-slate-500 mt-0.5">A cada R$ 10,00 gastos ganha-se 1 ponto.</p>
                    <span class="inline-block px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[8px] font-bold uppercase mt-1">ATIVA</span>
                  </div>
                </div>

                <div class="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 flex items-start gap-2.5">
                  <mat-icon class="text-indigo-600 text-sm mt-0.5">emoji_events</mat-icon>
                  <div>
                    <h4 class="text-xs font-bold text-slate-800">Gold Tier Up Bonus</h4>
                    <p class="text-[10px] text-slate-500 mt-0.5">Ganhe bônus de 50 pontos ao atingir a categoria Gold.</p>
                    <span class="inline-block px-1.5 py-0.2 bg-violet-100 text-violet-800 rounded text-[8px] font-bold uppercase mt-1">PROGRAMADA</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Live Loyalty Stream Feed -->
            <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                  </span>
                  Pulso de Fidelidade ao Vivo
                </h3>
                <span class="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-mono font-bold">REATIVO</span>
              </div>
              <p class="text-[11px] text-slate-500">Eventos em tempo real de pontos acumulados pelos clientes via PDV, Mesas ou Marketplace.</p>

              <div class="space-y-3 max-h-[300px] overflow-y-auto pt-1 divide-y divide-slate-100">
                @for (item of loyaltyFeed(); track item.id) {
                  <div class="pt-3 first:pt-0 flex items-start justify-between gap-2.5 text-xs">
                    <div>
                      <h4 class="font-bold text-slate-800 leading-tight">{{ item.customerName }}</h4>
                      <p class="text-[10px] text-slate-500 mt-0.5 font-medium">{{ item.action }}</p>
                      <span class="text-[9px] text-slate-400 font-mono block mt-1">{{ item.timestamp | date:'HH:mm:ss' }}</span>
                    </div>
                    <span class="text-xs font-black text-emerald-600 font-mono bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 shrink-0">
                      +{{ item.points }} pts
                    </span>
                  </div>
                }
              </div>
            </div>

          </div>

        </div>

      </div>

      <!-- New Customer Modal Dialog -->
      @if (showNewCustomerModal()) {
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-200">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
                <mat-icon class="text-violet-600">person_add</mat-icon>
                Cadastrar Novo Cliente
              </h3>
              <button (click)="showNewCustomerModal.set(false)" class="text-slate-400 hover:text-slate-600">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <div class="space-y-4 text-xs">
              <div>
                <label for="crm-new-name" class="block font-bold text-slate-700 mb-1">Nome Completo *</label>
                <input 
                  id="crm-new-name"
                  type="text" 
                  [value]="newName()"
                  (input)="onNewNameInput($event)"
                  placeholder="Ex: Ana Carolina Silva" 
                  class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500">
              </div>

              <div>
                <label for="crm-new-phone" class="block font-bold text-slate-700 mb-1">Telefone / WhatsApp *</label>
                <input 
                  id="crm-new-phone"
                  type="text" 
                  [value]="newPhone()"
                  (input)="onNewPhoneInput($event)"
                  placeholder="Ex: (11) 98765-4321" 
                  class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500">
              </div>

              <div>
                <label for="crm-new-email" class="block font-bold text-slate-700 mb-1">E-mail</label>
                <input 
                  id="crm-new-email"
                  type="email" 
                  [value]="newEmail()"
                  (input)="onNewEmailInput($event)"
                  placeholder="Ex: ana.silva@email.com" 
                  class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500">
              </div>
            </div>

            <div class="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button 
                (click)="showNewCustomerModal.set(false)"
                class="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs">
                Cancelar
              </button>
              <button 
                (click)="saveNewCustomer()"
                [disabled]="!newName().trim() || !newPhone().trim() || isSaving()"
                class="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm">
                @if (isSaving()) {
                  <mat-icon class="animate-spin text-sm">sync</mat-icon>
                }
                Cadastrar Cliente
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class CrmComponent implements OnInit, OnDestroy {
  private getCustomersUseCase = inject(GetCustomersUseCase);
  private createCustomerUseCase = inject(CreateCustomerUseCase);
  private osSdk = inject(OsSdkService);
  os: OsContext = this.osSdk.bind('app_crm');

  customers = signal<Customer[]>([]);
  searchQuery = signal<string>('');
  selectedTierFilter = signal<string>('ALL');
  feedbackMessage = signal<string>('');

  showNewCustomerModal = signal<boolean>(false);
  newName = signal<string>('');
  newPhone = signal<string>('');
  newEmail = signal<string>('');
  isSaving = signal<boolean>(false);

  // Live feed signal for loyalty points activities
  loyaltyFeed = signal<LoyaltyFeedItem[]>([
    {
      id: 'lf_init_1',
      customerName: 'Renato Guimarães',
      points: 10,
      action: 'Compra iFood #8491',
      timestamp: new Date(Date.now() - 5 * 60000)
    },
    {
      id: 'lf_init_2',
      customerName: 'Fernanda Montenegro',
      points: 4,
      action: 'Compra no PDV Presencial',
      timestamp: new Date(Date.now() - 25 * 60000)
    }
  ]);

  private subs: { unsubscribe: () => void }[] = [];

  onSearchInput(event: Event) {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  onTierFilterChange(event: Event) {
    this.selectedTierFilter.set((event.target as HTMLSelectElement).value);
  }

  onNewNameInput(event: Event) {
    this.newName.set((event.target as HTMLInputElement).value);
  }

  onNewPhoneInput(event: Event) {
    this.newPhone.set((event.target as HTMLInputElement).value);
  }

  onNewEmailInput(event: Event) {
    this.newEmail.set((event.target as HTMLInputElement).value);
  }

  // Computed metrics
  totalPoints = computed(() => {
    return this.customers().reduce((sum, c) => sum + c.points, 0);
  });

  totalSpent = computed(() => {
    return this.customers().reduce((sum, c) => sum + c.totalSpent, 0);
  });

  vipCount = computed(() => {
    return this.customers().filter(c => c.tier === 'VIP' || c.tier === 'Gold').length;
  });

  filteredCustomers = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const tier = this.selectedTierFilter();

    return this.customers().filter(c => {
      const matchesQuery = !q || c.name.toLowerCase().includes(q) || c.phone.includes(q);
      const matchesTier = tier === 'ALL' || c.tier === tier;
      return matchesQuery && matchesTier;
    });
  });

  async ngOnInit() {
    await this.loadCustomers();

    // Subscribe to EventBus updates for real-time customer points & purchases
    this.subs.push(
      this.os.events.subscribe('crm.customer_updated', (evt: any) => {
        const payload = evt.payload;
        if (payload && payload.customerId) {
          // Force customer list reload
          this.loadCustomers().then(() => {
            const customer = this.customers().find(c => c.id === payload.customerId);
            if (customer) {
              const actionText = payload.earnedPoints 
                ? `Acúmulo de +${payload.earnedPoints} pts (${payload.action || 'Venda'})`
                : 'Atualização de Cadastro';

              this.loyaltyFeed.update(feed => [
                {
                  id: `lf_${Date.now()}`,
                  customerName: customer.name,
                  points: payload.earnedPoints || 0,
                  action: actionText,
                  timestamp: new Date()
                },
                ...feed.slice(0, 9) // Cap at 10 items
              ]);
            }
          });
        }
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  async loadCustomers() {
    const companyId = this.os.companyId;
    try {
      const data = await this.getCustomersUseCase.execute(companyId);
      this.customers.set(data);
    } catch (e: unknown) {
      console.error('Failed to load customers', e);
    }
  }

  async saveNewCustomer() {
    if (!this.newName().trim() || !this.newPhone().trim()) return;

    this.isSaving.set(true);
    try {
      const companyId = this.os.companyId;
      const created = await this.createCustomerUseCase.execute({
        companyId,
        name: this.newName().trim(),
        phone: this.newPhone().trim(),
        email: this.newEmail().trim()
      });

      this.customers.update(list => [...list, created]);
      this.feedbackMessage.set(`Cliente "${created.name}" cadastrado com sucesso no Clube de Fidelidade.`);
      
      // Notify the feed of the onboarding action
      this.loyaltyFeed.update(feed => [
        {
          id: `lf_${Date.now()}`,
          customerName: created.name,
          points: 15, // 15 Welcome Points campaign
          action: 'Cadastro Efetuado (Bônus Boas-vindas)',
          timestamp: new Date()
        },
        ...feed
      ]);

      this.newName.set('');
      this.newPhone.set('');
      this.newEmail.set('');
      this.showNewCustomerModal.set(false);
    } catch (e: unknown) {
      console.error('Failed to save customer', e);
      this.feedbackMessage.set('Erro ao cadastrar cliente.');
    } finally {
      this.isSaving.set(false);
    }
  }

  async printLoyaltyCard(customer: Customer) {
    const companyName = this.os.companyName;
    const slip = `
========================================
       ${companyName.toUpperCase()}
     CLUBE DE FIDELIDADE & CASHBACK
========================================
DATA: ${new Date().toLocaleString('pt-BR')}
CLIENTE: ${customer.name.toUpperCase()}
TELEFONE: ${customer.phone}
CATEGORIA: ★ ${customer.tier.toUpperCase()}
----------------------------------------
SALDO ATUAL: ${customer.points} PONTOS
CONSUMO HISTÓRICO: R$ ${customer.totalSpent.toFixed(2)}
----------------------------------------
* A cada R$ 10 em compras acumule 1 ponto!
* Resgate pontos em descontos no caixa.
========================================
      Obrigado pela preferência!
========================================
`;
    try {
      await this.os.print(`Extrato Fidelidade - ${customer.name}`, slip);
      this.feedbackMessage.set(`Extrato do cliente ${customer.name} enviado para a impressora térmica.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'offline';
      this.feedbackMessage.set(`Aviso da Impressora: ${msg}`);
    }
  }
}
