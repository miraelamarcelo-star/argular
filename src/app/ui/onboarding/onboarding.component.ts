import { Component, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [RouterLink, MatIconModule, CommonModule],
  template: `
    <div class="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950 flex flex-col font-sans text-slate-100">
      
      <!-- Top Navigation -->
      <header class="h-16 flex items-center justify-between px-6 lg:px-12 shrink-0 border-b border-slate-800/60 backdrop-blur-xl bg-slate-950/40">
        <a routerLink="/" class="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold">
          <mat-icon class="text-sm">arrow_back</mat-icon>
          Página Inicial
        </a>
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">3E</div>
          <span class="text-xs font-bold text-slate-300">3eatcru OS Empresas</span>
        </div>
      </header>
      
      <main class="flex-1 flex items-center justify-center p-4 py-8">
        <div class="w-full max-w-xl bg-slate-900/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-800 p-8 space-y-6">
          
          <div class="text-center space-y-2">
            <div class="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <mat-icon class="text-white text-3xl">storefront</mat-icon>
            </div>
            <h2 class="text-2xl font-bold text-white tracking-tight">Criar Conta Comercial</h2>
            <p class="text-slate-400 text-xs">
              Configure sua empresa e inicie seu período de avaliação sem necessidade de cartão de crédito.
            </p>
          </div>

          <!-- Banner Informativo do Trial Corporativo -->
          <div class="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-xs flex items-center gap-3 text-indigo-300">
            <mat-icon class="text-indigo-400 text-lg shrink-0">verified</mat-icon>
            <div>
              <span class="font-bold text-white">Trial Pro 7 Dias Grátis: </span>
              Acesso total ao PDV, Controle de Estoque, Mesas, CRM Fidelidade e Fluxo de Caixa.
            </div>
          </div>

          @if (errorMessage()) {
            <div class="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs flex items-center gap-2.5">
              <mat-icon class="text-rose-400 text-base">error</mat-icon>
              <span>{{ errorMessage() }}</span>
            </div>
          }

          <form (submit)="onFormSubmit($event)" class="space-y-4 text-xs">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="company-name" class="block font-bold text-slate-400 mb-1.5">Nome da Empresa</label>
                <input 
                  id="company-name" 
                  type="text" 
                  [value]="companyName()" 
                  (input)="onCompanyNameInput($event)"
                  name="companyName"
                  required
                  placeholder="Ex: Cantina & Co" 
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium">
              </div>

              <div>
                <label for="segment" class="block font-bold text-slate-400 mb-1.5">Segmento de Atuação</label>
                <select 
                  id="segment" 
                  [value]="segment()" 
                  (change)="onSegmentChange($event)"
                  name="segment"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium">
                  <option value="restaurante">Restaurante / Alimentação</option>
                  <option value="varejo">Varejo / Moda / Comércio</option>
                  <option value="servicos">Serviços / Clínica / Beleza</option>
                  <option value="geral">Geral / Outros</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="admin-email" class="block font-bold text-slate-400 mb-1.5">E-mail do Administrador</label>
                <input 
                  id="admin-email" 
                  type="email" 
                  [value]="adminEmail()" 
                  (input)="onAdminEmailInput($event)"
                  name="adminEmail"
                  required
                  placeholder="gerente@empresa.com" 
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium">
              </div>

              <div>
                <label for="whatsapp" class="block font-bold text-slate-400 mb-1.5">WhatsApp Comercial</label>
                <input 
                  id="whatsapp" 
                  type="tel" 
                  [value]="whatsapp()" 
                  (input)="onWhatsappInput($event)"
                  name="whatsapp"
                  required
                  placeholder="(11) 99999-8888" 
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium">
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="password" class="block font-bold text-slate-400 mb-1.5">Senha de Acesso</label>
                <input 
                  id="password" 
                  type="password" 
                  [value]="password()" 
                  (input)="onPasswordInput($event)"
                  name="password"
                  required
                  placeholder="Crie sua senha segura" 
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium">
              </div>

              <div>
                <label for="pin" class="block font-bold text-slate-400 mb-1.5">PIN do Terminal (4 Dígitos)</label>
                <input 
                  id="pin" 
                  type="password" 
                  maxlength="6"
                  [value]="pin()" 
                  (input)="onPinInput($event)"
                  name="pin"
                  required
                  placeholder="Ex: 1234" 
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono font-bold tracking-widest text-center">
              </div>
            </div>

            <div class="pt-3">
              <button 
                type="submit" 
                [disabled]="isSubmitting() || !companyName().trim() || !adminEmail().trim()"
                class="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 text-xs disabled:opacity-50">
                @if (isSubmitting()) {
                  <mat-icon class="animate-spin text-sm">sync</mat-icon>
                  Provisionando Workspace Comercial...
                } @else {
                  <mat-icon class="text-sm">rocket_launch</mat-icon>
                  Iniciar Trial de 7 Dias Grátis
                }
              </button>
            </div>
          </form>

          <div class="text-center pt-2 border-t border-slate-800/80">
            <span class="text-slate-500 text-[11px]">Já possui uma conta registrada? </span>
            <a routerLink="/access" class="text-indigo-400 hover:underline font-bold text-[11px]">Entrar no Terminal</a>
          </div>

        </div>
      </main>
    </div>
  `
})
export class OnboardingComponent {
  private http = inject(HttpClient);
  private router = inject(Router);

  companyName = signal('');
  segment = signal('restaurante');
  adminEmail = signal('');
  whatsapp = signal('');
  password = signal('');
  pin = signal('');
  isSubmitting = signal(false);
  errorMessage = signal<string | null>(null);

  onCompanyNameInput(event: Event) {
    this.companyName.set((event.target as HTMLInputElement).value);
  }

  onSegmentChange(event: Event) {
    this.segment.set((event.target as HTMLSelectElement).value);
  }

  onAdminEmailInput(event: Event) {
    this.adminEmail.set((event.target as HTMLInputElement).value);
  }

  onWhatsappInput(event: Event) {
    this.whatsapp.set((event.target as HTMLInputElement).value);
  }

  onPasswordInput(event: Event) {
    this.password.set((event.target as HTMLInputElement).value);
  }

  onPinInput(event: Event) {
    this.pin.set((event.target as HTMLInputElement).value);
  }

  onFormSubmit(event: Event) {
    event.preventDefault();
    this.createCompany();
  }

  async createCompany() {
    const name = this.companyName().trim();
    const email = this.adminEmail().trim();
    if (!name || !email) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const payload = {
      companyName: name,
      segment: this.segment(),
      adminEmail: email,
      whatsapp: this.whatsapp().trim(),
      password: this.password().trim(),
      pin: this.pin().trim() || '1234'
    };

    this.http.post<{ success: boolean; company: { id: string } }>('/api/v1/onboarding/provision', payload).subscribe({
      next: () => {
        this.router.navigate(['/access']);
      },
      error: (err) => {
        console.error('Erro ao provisionar empresa:', err);
        this.errorMessage.set(err.error?.error || 'Falha ao conectar com o serviço de provisionamento da Central.');
        this.isSubmitting.set(false);
      }
    });
  }
}
