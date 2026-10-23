import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { IdentityService } from '../../core/identity/identity.service';

@Component({
  selector: 'app-account-recovery',
  standalone: true,
  imports: [RouterLink, MatIconModule, CommonModule],
  template: `
    <div class="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950 flex items-center justify-center p-4 font-sans text-slate-100 relative">
      <div class="w-full max-w-md bg-slate-900/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-800 p-8 space-y-6">
        
        <!-- Header -->
        <div class="text-center space-y-2">
          <div class="w-14 h-14 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl mx-auto flex items-center justify-center text-indigo-400">
             <mat-icon class="text-2xl">lock_reset</mat-icon>
          </div>
          <h2 class="text-xl font-bold text-white tracking-tight">Recuperação de Acesso</h2>
          <p class="text-slate-400 text-xs">
            Informe seu e-mail corporativo para receber instruções seguras de redefinição de senha.
          </p>
        </div>

        @if (successMessage()) {
          <div class="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-300 text-xs space-y-2">
            <div class="flex items-center gap-2 font-bold text-emerald-400">
              <mat-icon class="text-base">check_circle</mat-icon>
              <span>Solicitação Enviada</span>
            </div>
            <p class="text-slate-300 leading-relaxed">{{ successMessage() }}</p>
          </div>
        }

        @if (errorMessage()) {
          <div class="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs flex items-center gap-2.5">
            <mat-icon class="text-rose-400 text-base">error</mat-icon>
            <span class="font-medium">{{ errorMessage() }}</span>
          </div>
        }

        <form (submit)="onSubmit($event)" class="space-y-4 text-xs">
          <div>
            <label for="recovery-email" class="block font-bold text-slate-400 mb-1.5">E-mail Corporativo</label>
            <div class="relative">
              <mat-icon class="absolute left-3.5 top-3 text-slate-500 text-sm">mail</mat-icon>
              <input 
                id="recovery-email" 
                type="email" 
                [value]="email()" 
                (input)="email.set($any($event.target).value)"
                required
                placeholder="operador@empresa.com" 
                class="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-xs">
            </div>
          </div>

          <button 
            type="submit" 
            [disabled]="isLoading() || !!successMessage()"
            class="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 text-xs disabled:opacity-50">
            @if (isLoading()) {
              <mat-icon class="animate-spin text-sm">sync</mat-icon>
              Processando Protocolo Seguro...
            } @else {
              <mat-icon class="text-sm">send</mat-icon>
              Enviar Instruções de Recuperação
            }
          </button>
        </form>

        <div class="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <a routerLink="/access" class="hover:text-white transition-colors flex items-center gap-1 font-medium text-slate-400">
            <mat-icon class="text-[14px]">arrow_back</mat-icon>
            Voltar ao Login do Client OS
          </a>
          <a routerLink="/hq/login" class="hover:text-indigo-400 transition-colors flex items-center gap-1">
            <mat-icon class="text-[14px]">shield</mat-icon>
            Acesso HQ
          </a>
        </div>
      </div>
    </div>
  `
})
export class AccountRecoveryComponent {
  private identityService = inject(IdentityService);

  email = signal('');
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  async onSubmit(event: Event) {
    event.preventDefault();
    if (!this.email()) {
      this.errorMessage.set('Por favor, informe um endereço de e-mail válido.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const msg = await this.identityService.requestPasswordRecovery(this.email());
      this.successMessage.set(msg);
    } catch (err: unknown) {
      const e = err as { error?: { error?: string }; message?: string };
      this.errorMessage.set(e?.error?.error || e?.message || 'Falha ao processar solicitação de recuperação.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
