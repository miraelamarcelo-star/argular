import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { IdentityService } from '../../core/identity/identity.service';

@Component({
  selector: 'app-hq-login',
  standalone: true,
  imports: [RouterLink, MatIconModule, CommonModule],
  template: `
    <div class="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/30 via-slate-950 to-slate-950 flex items-center justify-center p-4 font-sans text-slate-100 relative">
      
      <!-- High Security Grid Accent overlay -->
      <div class="absolute inset-0 bg-[linear-gradient(to_right,#052e16_1px,transparent_1px),linear-gradient(to_bottom,#052e16_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none"></div>

      <div class="w-full max-w-md bg-slate-900/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-emerald-900/40 p-8 space-y-6 relative z-10">
        
        <!-- Header -->
        <div class="text-center space-y-2">
          <div class="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white">
             <mat-icon class="text-2xl">shield</mat-icon>
          </div>
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono tracking-wider uppercase font-bold">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            3eatcru HQ Control Plane
          </div>
          <h2 class="text-xl font-bold text-white tracking-tight">Painel de Governo Central</h2>
          <p class="text-slate-400 text-xs">
            Acesso exclusivo para administradores da plataforma HQ.
          </p>
        </div>

        @if (errorMessage()) {
          <div class="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
            <mat-icon class="text-rose-400 text-base">gpp_bad</mat-icon>
            <span class="font-medium">{{ errorMessage() }}</span>
          </div>
        }

        <!-- Diagnostic HQ Booting Overlay -->
        @if (isBooting()) {
          <div class="p-6 bg-slate-950/90 border border-emerald-500/30 rounded-2xl text-xs space-y-3">
            <div class="flex items-center justify-between text-emerald-400 font-bold">
              <span class="flex items-center gap-2">
                <mat-icon class="animate-spin text-sm">sync</mat-icon>
                Inicializando HQ Control Engine...
              </span>
              <span class="font-mono">{{ bootProgress() }}%</span>
            </div>
            <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full bg-emerald-500 transition-all duration-300" [style.width.%]="bootProgress()"></div>
            </div>
            <p class="text-[11px] font-mono text-slate-400">{{ bootStage() }}</p>
          </div>
        } @else {
          <!-- Form -->
          <form (submit)="onHqSubmit($event)" class="space-y-4 text-xs">
            <div>
              <label for="hq-email" class="block font-bold text-slate-400 mb-1.5">E-mail do Administrador HQ</label>
              <div class="relative">
                <mat-icon class="absolute left-3.5 top-3 text-slate-500 text-sm">admin_panel_settings</mat-icon>
                <input 
                  id="hq-email" 
                  type="email" 
                  [value]="email()" 
                  (input)="email.set($any($event.target).value)"
                  required
                  placeholder="admin@3eatcru.com.br" 
                  class="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono text-xs">
              </div>
            </div>

            <div>
              <label for="hq-password" class="block font-bold text-slate-400 mb-1.5">Chave Mestra de Acesso</label>
              <div class="relative">
                <mat-icon class="absolute left-3.5 top-3 text-slate-500 text-sm">key</mat-icon>
                <input 
                  id="hq-password" 
                  type="password" 
                  [value]="password()" 
                  (input)="password.set($any($event.target).value)"
                  required
                  placeholder="••••••••••••" 
                  class="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-xs">
              </div>
            </div>

            <div>
              <label for="hq-mfa" class="block font-bold text-slate-400 mb-1.5 flex items-center justify-between">
                <span>Código MFA (Multifator)</span>
                <span class="text-[10px] text-red-400 font-normal">Obrigatório / Token 6 dígitos</span>
              </label>
              <div class="relative">
                <mat-icon class="absolute left-3.5 top-3 text-slate-500 text-sm">phonelink_lock</mat-icon>
                <input 
                  id="hq-mfa" 
                  type="text" 
                  maxlength="6"
                  required
                  [value]="mfaCode()" 
                  (input)="mfaCode.set($any($event.target).value)"
                  placeholder="000000" 
                  class="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-emerald-400 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono text-center tracking-widest text-xs">
              </div>
            </div>

            <button 
              type="submit" 
              [disabled]="isLoading()"
              class="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 mt-4 text-xs disabled:opacity-50">
              @if (isLoading()) {
                <mat-icon class="animate-spin text-sm">sync</mat-icon>
                Validando Assinatura Admin...
              } @else {
                <mat-icon class="text-sm">verified_user</mat-icon>
                Autenticar Painel HQ
              }
            </button>
          </form>
        }

        <div class="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <a routerLink="/access" class="hover:text-white transition-colors flex items-center gap-1">
            <mat-icon class="text-[14px]">storefront</mat-icon>
            Acesso ao Client OS
          </a>
          <span class="text-[10px] text-slate-600 font-mono">Restrito 3eatcru Security</span>
        </div>
      </div>
    </div>
  `
})
export class HqLoginComponent {
  private identityService = inject(IdentityService);
  private router = inject(Router);

  email = signal('admin@3eatcru.com.br');
  password = signal('');
  mfaCode = signal('');
  isLoading = signal(false);
  isBooting = signal(false);
  bootProgress = signal(0);
  bootStage = signal('Autenticando sessão...');
  errorMessage = signal<string | null>(null);

  async onHqSubmit(event: Event) {
    event.preventDefault();
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const mfa = this.mfaCode().trim();
    if (!mfa || mfa.length !== 6 || isNaN(Number(mfa))) {
      this.errorMessage.set('O código de autenticação MFA (6 dígitos numéricos) é obrigatório.');
      this.isLoading.set(false);
      return;
    }

    try {
      await this.identityService.hqLogin({
        email: this.email(),
        password: this.password(),
        mfaCode: this.mfaCode() || undefined
      });

      // Run HQ Diagnostic Boot Sequence
      this.isBooting.set(true);
      this.isLoading.set(false);

      const stages = [
        { progress: 25, label: 'Verificando assinatura criptográfica HQ...' },
        { progress: 55, label: 'Carregando barramento de telemetria e audit log...' },
        { progress: 85, label: 'Sincronizando malha de tenants e licenciamento...' },
        { progress: 100, label: 'Acesso autorizado. Abrindo HQ OS Shell...' }
      ];

      for (const st of stages) {
        this.bootProgress.set(st.progress);
        this.bootStage.set(st.label);
        await new Promise(r => setTimeout(r, 160));
      }

      this.router.navigate(['/hq/dashboard']);
    } catch (e: unknown) {
      this.isBooting.set(false);
      this.isLoading.set(false);
      const err = e as { error?: { error?: string }; message?: string };
      this.errorMessage.set(err?.error?.error || err?.message || 'Falha na autenticação de Controle HQ.');
    }
  }
}
