import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { IdentityService } from '../../core/identity/identity.service';
import { HttpClient } from '@angular/common/http';

interface CompanyInfo {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  logoUrl?: string;
  branches: { id: string; name: string; address: string; isMain?: boolean }[];
}

@Component({
  selector: 'app-access',
  standalone: true,
  imports: [RouterLink, MatIconModule, CommonModule],
  template: `
    <div class="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950 flex items-center justify-center p-4 font-sans text-slate-100 relative">
      
      <div class="w-full max-w-lg bg-slate-900/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-800 p-8 space-y-6">
        
        <!-- Header -->
        <div class="text-center space-y-2">
          <div class="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/25">
             <mat-icon class="text-white text-3xl">desktop_windows</mat-icon>
          </div>
          <h2 class="text-2xl font-bold text-white tracking-tight">3EATCRU OS Client Access</h2>
          <p class="text-slate-400 text-xs">
            Autenticação corporativa com isolamento de tenant, controle de filiais e sessão contextualizada.
          </p>
        </div>

        @if (errorMessage()) {
          <div class="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
            <mat-icon class="text-rose-400 text-base">error</mat-icon>
            <span class="font-medium">{{ errorMessage() }}</span>
          </div>
        }

        <!-- Diagnostic OS Boot Overlay -->
        @if (isBooting()) {
          <div class="p-6 bg-slate-950/90 border border-indigo-500/30 rounded-2xl text-xs space-y-3">
            <div class="flex items-center justify-between text-indigo-400 font-bold">
              <span class="flex items-center gap-2">
                <mat-icon class="animate-spin text-sm">sync</mat-icon>
                Inicializando Runtime do Client OS...
              </span>
              <span class="font-mono">{{ bootProgress() }}%</span>
            </div>
            <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full bg-indigo-500 transition-all duration-300" [style.width.%]="bootProgress()"></div>
            </div>
            <p class="text-[11px] font-mono text-slate-400">{{ bootStage() }}</p>
          </div>
        } @else {
          <!-- Step 1: Enterprise Identification / Resolution -->
          @if (step() === 'company') {
            <div class="space-y-4 text-xs">
              <div>
                <label for="company-identifier" class="block font-bold text-slate-300 mb-1.5">Identificação da Empresa (Código / Slug)</label>
                <div class="flex gap-2">
                  <div class="relative flex-1">
                    <mat-icon class="absolute left-3.5 top-3 text-slate-500 text-sm">business</mat-icon>
                    <input 
                      id="company-identifier" 
                      type="text" 
                      [value]="companyQuery()" 
                      (input)="companyQuery.set($any($event.target).value)"
                      (keyup.enter)="resolveCompany()"
                      placeholder="Ex: comp_1 ou burger-3eatcru" 
                      class="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-xs">
                  </div>
                  <button 
                    type="button" 
                    (click)="resolveCompany()"
                    [disabled]="isResolving()"
                    class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50">
                    @if (isResolving()) {
                      <mat-icon class="animate-spin text-sm">sync</mat-icon>
                    } @else {
                      <mat-icon class="text-sm">search</mat-icon>
                      Buscar
                    }
                  </button>
                </div>
              </div>

              <!-- Available Enterprise Selector List -->
              @if (availableCompanies().length > 0) {
                <div class="space-y-2 pt-2 border-t border-slate-800">
                  <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Empresas Licenciadas Disponíveis
                  </span>
                  <div class="space-y-1.5">
                    @for (comp of availableCompanies(); track comp.id) {
                      <button 
                        type="button"
                        (click)="selectResolvedCompany(comp)"
                        class="w-full p-3 rounded-xl border border-slate-800 bg-slate-800/40 hover:bg-slate-800 hover:border-slate-700 text-left flex items-center justify-between transition-all group">
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                            <mat-icon class="text-base">store</mat-icon>
                          </div>
                          <div>
                            <div class="font-bold text-white group-hover:text-indigo-300 transition-colors">{{ comp.name }}</div>
                            <div class="text-[10px] text-slate-500 font-mono">{{ comp.id }} • {{ comp.branches.length }} unidade(s)</div>
                          </div>
                        </div>
                        <mat-icon class="text-slate-500 group-hover:text-white transition-colors text-sm">chevron_right</mat-icon>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          }

          <!-- Step 2: Operator Credentials & Branch Selector -->
          @if (step() === 'credentials' && selectedCompany()) {
            <div class="space-y-4 text-xs">
              
              <!-- Company Header Badge -->
              <div class="p-3 bg-indigo-950/40 border border-indigo-500/20 rounded-2xl flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                    <mat-icon class="text-base">domain</mat-icon>
                  </div>
                  <div>
                    <span class="text-[10px] text-indigo-400 font-mono uppercase font-bold tracking-wider">Empresa Selecionada</span>
                    <h3 class="text-xs font-bold text-white leading-tight">{{ selectedCompany()?.name }}</h3>
                  </div>
                </div>
                <button 
                  type="button" 
                  (click)="step.set('company')" 
                  class="text-[10px] font-bold text-slate-400 hover:text-white underline">
                  Alterar
                </button>
              </div>

              <form (submit)="onFormSubmit($event)" class="space-y-4">
                <div>
                  <label for="corporate-email" class="block font-bold text-slate-400 mb-1.5">E-mail do Operador</label>
                  <div class="relative">
                    <mat-icon class="absolute left-3.5 top-3 text-slate-500 text-sm">person</mat-icon>
                    <input 
                      id="corporate-email" 
                      type="email" 
                      [value]="email()" 
                      (input)="email.set($any($event.target).value)"
                      required
                      placeholder="operador@empresa.com" 
                      class="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-xs">
                  </div>
                </div>
                
                <div>
                  <div class="flex justify-between items-center mb-1.5">
                    <label for="corporate-password" class="block font-bold text-slate-400">Senha Corporativa</label>
                    <a routerLink="/account/recovery" class="text-[11px] text-indigo-400 hover:underline">Esqueci minha senha</a>
                  </div>
                  <div class="relative">
                    <mat-icon class="absolute left-3.5 top-3 text-slate-500 text-sm">lock</mat-icon>
                    <input 
                      id="corporate-password" 
                      type="password" 
                      [value]="password()" 
                      (input)="password.set($any($event.target).value)"
                      required
                      placeholder="••••••••••••" 
                      class="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs">
                  </div>
                </div>

                <!-- Branch Selector if company has multiple active branches -->
                @if (selectedCompany()?.branches && selectedCompany()!.branches.length > 0) {
                  <div>
                    <label for="branch-selector" class="block font-bold text-slate-400 mb-1.5">Unidade / Filial</label>
                    <div class="relative">
                      <mat-icon class="absolute left-3.5 top-3.5 text-slate-500 text-sm">store</mat-icon>
                      <select 
                        id="branch-selector"
                        [value]="selectedBranchId()"
                        (change)="selectedBranchId.set($any($event.target).value)"
                        class="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-sans text-xs appearance-none cursor-pointer">
                        @for (br of selectedCompany()!.branches; track br.id) {
                          <option [value]="br.id">{{ br.name }} ({{ br.address }})</option>
                        }
                      </select>
                      <mat-icon class="absolute right-3.5 top-3 text-slate-500 text-sm pointer-events-none">expand_more</mat-icon>
                    </div>
                  </div>
                }

                <button 
                  type="submit" 
                  [disabled]="isLoading()"
                  class="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 mt-4 text-xs disabled:opacity-50">
                  @if (isLoading()) {
                    <mat-icon class="animate-spin text-sm">sync</mat-icon>
                    Autenticando Sessão de Operador...
                  } @else {
                    <mat-icon class="text-sm">login</mat-icon>
                    Entrar no 3EATCRU OS
                  }
                </button>
              </form>
            </div>
          }
        }

        <div class="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <a routerLink="/" class="hover:text-white transition-colors flex items-center gap-1">
            <mat-icon class="text-[14px]">arrow_back</mat-icon>
            Página Inicial
          </a>
          <a routerLink="/hq/login" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-1 font-medium">
            <mat-icon class="text-xs">shield</mat-icon>
            Acesso Administrativo HQ
          </a>
        </div>
      </div>
    </div>
  `
})
export class AccessComponent implements OnInit {
  private router = inject(Router);
  private identityService = inject(IdentityService);
  private http = inject(HttpClient);

  step = signal<'company' | 'credentials'>('company');
  companyQuery = signal('comp_1');
  selectedCompany = signal<CompanyInfo | null>(null);
  availableCompanies = signal<CompanyInfo[]>([]);

  selectedBranchId = signal<string | null>(null);
  email = signal('gerente@3eatcru.com');
  password = signal('');
  
  isResolving = signal(false);
  isLoading = signal(false);
  isBooting = signal(false);
  bootProgress = signal(0);
  bootStage = signal('Validando sessão com o servidor...');
  errorMessage = signal<string | null>(null);

  ngOnInit() {
    this.loadAvailableCompanies();
  }

  loadAvailableCompanies() {
    this.http.get<{ id: string; name: string; status: string; plan?: string }[]>('/api/v1/companies').subscribe({
      next: (list) => {
        if (list && list.length > 0) {
          const formatted: CompanyInfo[] = list.map(c => ({
            id: c.id,
            name: c.name,
            slug: c.id,
            status: c.status,
            plan: c.plan || 'pro',
            branches: [{ id: `branch_${c.id}_main`, name: 'Unidade Principal', address: 'Matriz Central' }]
          }));
          this.availableCompanies.set(formatted);
        }
      },
      error: (err: unknown) => {
        console.debug('[AccessComponent] Could not fetch public companies list:', err);
      }
    });
  }

  async resolveCompany() {
    const query = this.companyQuery().trim();
    if (!query) {
      this.errorMessage.set('Informe o código ou identificador da empresa.');
      return;
    }

    this.isResolving.set(true);
    this.errorMessage.set(null);
    try {
      const company = await this.identityService.resolveCompany(query);
      this.selectResolvedCompany(company);
    } catch (e: unknown) {
      const err = e as { error?: { error?: string }; message?: string };
      this.errorMessage.set(err?.error?.error || err?.message || 'Empresa não encontrada.');
    } finally {
      this.isResolving.set(false);
    }
  }

  selectResolvedCompany(company: CompanyInfo) {
    this.selectedCompany.set(company);
    this.errorMessage.set(null);
    if (company.branches && company.branches.length > 0) {
      this.selectedBranchId.set(company.branches[0].id);
    } else {
      this.selectedBranchId.set(null);
    }
    this.step.set('credentials');
  }

  onFormSubmit(event: Event) {
    event.preventDefault();
    this.login();
  }

  async login() {
    const comp = this.selectedCompany();
    if (!comp) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      await this.identityService.login({
        companyId: comp.id,
        email: this.email(),
        password: this.password(),
        branchId: this.selectedBranchId() || undefined
      });

      // Run Client OS Diagnostic Boot Sequence
      this.isBooting.set(true);
      this.isLoading.set(false);

      const stages = [
        { progress: 20, label: 'Autenticando sessão com Central Auth Server...' },
        { progress: 45, label: 'Carregando mapa de permissões (RBAC) e contexto de filial...' },
        { progress: 75, label: 'Verificando licença e inicializando motores do OS...' },
        { progress: 100, label: 'Sessão autorizada. Abrindo 3EATCRU OS...' }
      ];

      for (const st of stages) {
        this.bootProgress.set(st.progress);
        this.bootStage.set(st.label);
        await new Promise(r => setTimeout(r, 150));
      }

      this.router.navigate(['/os']);
    } catch (e: unknown) {
      this.isBooting.set(false);
      this.isLoading.set(false);
      const err = e as { error?: { error?: string }; message?: string };
      this.errorMessage.set(err?.error?.error || err?.message || 'Erro ao realizar login no Client OS.');
    }
  }
}
