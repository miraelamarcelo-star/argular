import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';
import {MatIconModule} from '@angular/material/icon';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/30 via-slate-950 to-slate-950">
      
      <!-- Background Glow Effects -->
      <div class="absolute w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[130px] -top-60 -left-60 pointer-events-none"></div>
      <div class="absolute w-[500px] h-[500px] rounded-full bg-emerald-500/5 blur-[120px] bottom-20 right-20 pointer-events-none"></div>
      <div class="absolute w-[400px] h-[400px] rounded-full bg-violet-600/10 blur-[100px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

      <!-- Top Nav -->
      <header class="h-20 border-b border-slate-800/60 flex items-center justify-between px-6 lg:px-20 shrink-0 relative z-10 backdrop-blur-xl bg-slate-950/60">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-black text-base shadow-lg shadow-indigo-500/20">3E</div>
          <div>
            <div class="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
              3EATCRU OS
              <span class="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-bold">v1.2</span>
            </div>
            <div class="text-[10px] text-slate-400 font-mono">Plataforma Dual-OS & Hub Central</div>
          </div>
        </div>
        <nav class="flex items-center gap-3">
          <a routerLink="/marketplace" class="px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors hidden sm:inline-flex items-center gap-1">
            <mat-icon class="text-xs text-amber-400">storefront</mat-icon>
            Marketplace
          </a>
          <a routerLink="/access" class="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5">
            <mat-icon class="text-xs">desktop_windows</mat-icon>
            Acessar OS
          </a>
          <a routerLink="/hq" class="px-4 py-2 border border-slate-800 hover:border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white rounded-xl transition-all flex items-center gap-1.5">
            <mat-icon class="text-xs text-indigo-400">shield</mat-icon>
            HQ Central
          </a>
        </nav>
      </header>
      
      <!-- Main Content -->
      <main class="flex-1 flex flex-col items-center justify-center text-center px-6 py-12 relative z-10 max-w-6xl mx-auto w-full">
        
        <div class="mb-12 space-y-4">
          <div class="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1.5 rounded-full shadow-sm">
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
            3EATCRU ECOSYSTEM PLATFORM
          </div>
          <h1 class="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight max-w-4xl mx-auto leading-tight">
            O Sistema Operacional Modular para Negócios
          </h1>
          <p class="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Plataforma corporativa com separação de autoridade: opere terminais de venda e salão com o <strong>Client OS</strong> e gerencie o ecossistema com o <strong>HQ Central</strong>.
          </p>
        </div>

        <!-- The 3 Gateways of the Diagram -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left mt-2">
          
          <!-- Column 1: Public Space / Marketplace -->
          <div class="bg-slate-900/60 backdrop-blur-xl border border-emerald-500/20 hover:border-emerald-500/40 p-7 rounded-3xl flex flex-col transition-all duration-200 shadow-xl group hover:-translate-y-1">
            <div class="flex items-center justify-between mb-5">
              <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-sm group-hover:scale-105 transition-transform">
                <mat-icon class="text-2xl">storefront</mat-icon>
              </div>
              <span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full font-mono">Público</span>
            </div>
            <h3 class="text-lg font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">Marketplace Público</h3>
            <p class="text-xs text-slate-400 leading-relaxed flex-1">
              Catálogo de busca e geolocalização dos estabelecimentos cadastrados (Restaurantes, Varejo e Serviços), exibindo distâncias em KM e acesso aos Business Spaces individuais.
            </p>
            <div class="mt-6 pt-4 border-t border-slate-800/80">
              <a routerLink="/marketplace" class="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md shadow-emerald-600/20">
                Explorar Marketplace
                <mat-icon class="text-sm">arrow_forward</mat-icon>
              </a>
            </div>
          </div>

          <!-- Column 2: OS Access -->
          <div class="bg-slate-900/60 backdrop-blur-xl border border-indigo-500/30 hover:border-indigo-500/50 p-7 rounded-3xl flex flex-col transition-all duration-200 shadow-xl group hover:-translate-y-1 relative ring-1 ring-indigo-500/20">
            <div class="flex items-center justify-between mb-5">
              <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-sm group-hover:scale-105 transition-transform">
                <mat-icon class="text-2xl">desktop_windows</mat-icon>
              </div>
              <span class="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full font-mono">Runtime OS</span>
            </div>
            <h3 class="text-lg font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">3EATCRU Client OS</h3>
            <p class="text-xs text-slate-400 leading-relaxed flex-1">
              Ambiente de trabalho do operador. Ponto de Venda (PDV), Mesas & KDS, Estoque, CRM Fidelidade, Finanças e App Store integrados em uma interface Desktop fluida.
            </p>
            <div class="mt-6 pt-4 border-t border-slate-800/80 flex gap-2">
              <a routerLink="/access" class="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md shadow-indigo-600/20">
                <mat-icon class="text-sm">login</mat-icon>
                Entrar no OS
              </a>
              <a routerLink="/onboarding" class="flex-1 flex items-center justify-center border border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-slate-300 font-bold text-xs py-3 rounded-xl transition-all">
                Criar Empresa
              </a>
            </div>
          </div>

          <!-- Column 3: HQ Access -->
          <div class="bg-slate-900/60 backdrop-blur-xl border border-violet-500/20 hover:border-violet-500/40 p-7 rounded-3xl flex flex-col transition-all duration-200 shadow-xl group hover:-translate-y-1">
            <div class="flex items-center justify-between mb-5">
              <div class="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shadow-sm group-hover:scale-105 transition-transform">
                <mat-icon class="text-2xl">admin_panel_settings</mat-icon>
              </div>
              <span class="bg-violet-500/10 text-violet-400 border border-violet-500/20 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full font-mono">Control Plane</span>
            </div>
            <h3 class="text-lg font-bold text-white mb-2 group-hover:text-violet-400 transition-colors">HQ Central & Control</h3>
            <p class="text-xs text-slate-400 leading-relaxed flex-1">
              Painel de governança SaaS e inteligência do ecossistema: gestão de tenants, faturamento de assinaturas, catálogo de módulos, Developer Hub (OTA) e telemetria de saúde.
            </p>
            <div class="mt-6 pt-4 border-t border-slate-800/80">
              <a routerLink="/hq" class="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md shadow-violet-600/20">
                Acessar HQ Central
                <mat-icon class="text-sm">arrow_forward</mat-icon>
              </a>
            </div>
          </div>

        </div>

      </main>
    </div>
  `
})
export class LandingComponent {}
