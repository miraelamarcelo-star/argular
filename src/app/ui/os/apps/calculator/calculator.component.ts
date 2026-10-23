import { Component, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="h-full flex flex-col bg-slate-900 text-white select-none font-sans p-3">
      <!-- Header / Mode -->
      <div class="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-white/5">
        <div class="flex items-center gap-2">
          <mat-icon class="text-sm text-indigo-400">calculate</mat-icon>
          <span class="font-semibold uppercase tracking-wider text-[11px] text-slate-300">Padrão</span>
        </div>
        <button (click)="clearAll()" class="hover:text-white transition-colors text-[10px] px-2 py-0.5 rounded bg-white/5" title="Limpar">
          Limpar
        </button>
      </div>

      <!-- Display Area -->
      <div class="flex flex-col items-end justify-end py-4 px-2 min-h-[90px] bg-white/[0.02] rounded-xl my-2 border border-white/5">
        <span class="text-xs text-slate-400 font-mono tracking-wider min-h-[16px]">{{ equation() }}</span>
        <span class="text-3xl sm:text-4xl font-light text-white font-mono tracking-tight truncate max-w-full">
          {{ display() }}
        </span>
      </div>

      <!-- Memory Bar -->
      <div class="grid grid-cols-5 gap-1 text-[10px] text-slate-400 font-semibold mb-2">
        <button (click)="memoryClear()" class="py-1 rounded hover:bg-white/10 hover:text-white transition-colors" [disabled]="memory() === null" [class.opacity-40]="memory() === null">MC</button>
        <button (click)="memoryRecall()" class="py-1 rounded hover:bg-white/10 hover:text-white transition-colors" [disabled]="memory() === null" [class.opacity-40]="memory() === null">MR</button>
        <button (click)="memoryAdd()" class="py-1 rounded hover:bg-white/10 hover:text-white transition-colors">M+</button>
        <button (click)="memorySubtract()" class="py-1 rounded hover:bg-white/10 hover:text-white transition-colors">M-</button>
        <button (click)="memoryStore()" class="py-1 rounded hover:bg-white/10 hover:text-white transition-colors">MS</button>
      </div>

      <!-- Keypad Grid -->
      <div class="flex-1 grid grid-cols-4 gap-1.5 text-sm font-medium">
        <!-- Row 1 -->
        <button (click)="inputPercent()" class="rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-300 transition-colors flex items-center justify-center">%</button>
        <button (click)="clearEntry()" class="rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-300 transition-colors flex items-center justify-center">CE</button>
        <button (click)="clearAll()" class="rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-300 transition-colors flex items-center justify-center">C</button>
        <button (click)="backspace()" class="rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-300 transition-colors flex items-center justify-center" aria-label="Apagar dígito">
          <mat-icon class="text-base leading-none">backspace</mat-icon>
        </button>

        <!-- Row 2 -->
        <button (click)="reciprocal()" class="rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-300 transition-colors flex items-center justify-center text-xs">¹/x</button>
        <button (click)="square()" class="rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-300 transition-colors flex items-center justify-center text-xs">x²</button>
        <button (click)="squareRoot()" class="rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-300 transition-colors flex items-center justify-center text-xs">²√x</button>
        <button (click)="setOperation('/')" [class.bg-indigo-600]="pendingOp() === '/'" class="rounded-lg bg-white/10 hover:bg-indigo-600 active:bg-indigo-700 text-white transition-colors flex items-center justify-center text-base">÷</button>

        <!-- Row 3 -->
        <button (click)="inputDigit('7')" class="rounded-lg bg-white/[0.03] hover:bg-white/10 active:bg-white/15 text-white font-semibold transition-colors flex items-center justify-center text-base">7</button>
        <button (click)="inputDigit('8')" class="rounded-lg bg-white/[0.03] hover:bg-white/10 active:bg-white/15 text-white font-semibold transition-colors flex items-center justify-center text-base">8</button>
        <button (click)="inputDigit('9')" class="rounded-lg bg-white/[0.03] hover:bg-white/10 active:bg-white/15 text-white font-semibold transition-colors flex items-center justify-center text-base">9</button>
        <button (click)="setOperation('*')" [class.bg-indigo-600]="pendingOp() === '*'" class="rounded-lg bg-white/10 hover:bg-indigo-600 active:bg-indigo-700 text-white transition-colors flex items-center justify-center text-base">×</button>

        <!-- Row 4 -->
        <button (click)="inputDigit('4')" class="rounded-lg bg-white/[0.03] hover:bg-white/10 active:bg-white/15 text-white font-semibold transition-colors flex items-center justify-center text-base">4</button>
        <button (click)="inputDigit('5')" class="rounded-lg bg-white/[0.03] hover:bg-white/10 active:bg-white/15 text-white font-semibold transition-colors flex items-center justify-center text-base">5</button>
        <button (click)="inputDigit('6')" class="rounded-lg bg-white/[0.03] hover:bg-white/10 active:bg-white/15 text-white font-semibold transition-colors flex items-center justify-center text-base">6</button>
        <button (click)="setOperation('-')" [class.bg-indigo-600]="pendingOp() === '-'" class="rounded-lg bg-white/10 hover:bg-indigo-600 active:bg-indigo-700 text-white transition-colors flex items-center justify-center text-base">−</button>

        <!-- Row 5 -->
        <button (click)="inputDigit('1')" class="rounded-lg bg-white/[0.03] hover:bg-white/10 active:bg-white/15 text-white font-semibold transition-colors flex items-center justify-center text-base">1</button>
        <button (click)="inputDigit('2')" class="rounded-lg bg-white/[0.03] hover:bg-white/10 active:bg-white/15 text-white font-semibold transition-colors flex items-center justify-center text-base">2</button>
        <button (click)="inputDigit('3')" class="rounded-lg bg-white/[0.03] hover:bg-white/10 active:bg-white/15 text-white font-semibold transition-colors flex items-center justify-center text-base">3</button>
        <button (click)="setOperation('+')" [class.bg-indigo-600]="pendingOp() === '+'" class="rounded-lg bg-white/10 hover:bg-indigo-600 active:bg-indigo-700 text-white transition-colors flex items-center justify-center text-base">+</button>

        <!-- Row 6 -->
        <button (click)="toggleSign()" class="rounded-lg bg-white/[0.03] hover:bg-white/10 active:bg-white/15 text-slate-300 transition-colors flex items-center justify-center text-sm">+/−</button>
        <button (click)="inputDigit('0')" class="rounded-lg bg-white/[0.03] hover:bg-white/10 active:bg-white/15 text-white font-semibold transition-colors flex items-center justify-center text-base">0</button>
        <button (click)="inputDecimal()" class="rounded-lg bg-white/[0.03] hover:bg-white/10 active:bg-white/15 text-slate-300 transition-colors flex items-center justify-center text-base">,</button>
        <button (click)="calculate()" class="rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold transition-colors flex items-center justify-center text-lg shadow-md">=</button>
      </div>
    </div>
  `
})
export class CalculatorComponent {
  display = signal<string>('0');
  equation = signal<string>('');
  pendingOp = signal<string | null>(null);
  previousValue = signal<number | null>(null);
  waitingForOperand = signal<boolean>(false);
  memory = signal<number | null>(null);

  inputDigit(digit: string) {
    if (this.waitingForOperand()) {
      this.display.set(digit);
      this.waitingForOperand.set(false);
    } else {
      const current = this.display();
      this.display.set(current === '0' ? digit : current + digit);
    }
  }

  inputDecimal() {
    if (this.waitingForOperand()) {
      this.display.set('0.');
      this.waitingForOperand.set(false);
      return;
    }
    if (!this.display().includes('.')) {
      this.display.set(this.display() + '.');
    }
  }

  setOperation(op: string) {
    const currentVal = parseFloat(this.display());
    const prev = this.previousValue();
    const currentOp = this.pendingOp();

    if (prev !== null && currentOp && !this.waitingForOperand()) {
      const result = this.executeMath(prev, currentVal, currentOp);
      this.display.set(String(result));
      this.previousValue.set(result);
    } else {
      this.previousValue.set(currentVal);
    }

    this.pendingOp.set(op);
    this.equation.set(`${this.previousValue()} ${this.formatOp(op)}`);
    this.waitingForOperand.set(true);
  }

  calculate() {
    const prev = this.previousValue();
    const op = this.pendingOp();
    const current = parseFloat(this.display());

    if (prev === null || !op) return;

    this.equation.set(`${prev} ${this.formatOp(op)} ${current} =`);
    const result = this.executeMath(prev, current, op);
    this.display.set(String(result));
    this.previousValue.set(null);
    this.pendingOp.set(null);
    this.waitingForOperand.set(true);
  }

  private executeMath(a: number, b: number, op: string): number {
    let res = 0;
    switch (op) {
      case '+': res = a + b; break;
      case '-': res = a - b; break;
      case '*': res = a * b; break;
      case '/': res = b === 0 ? 0 : a / b; break;
    }
    // Round to avoid IEEE-754 precision bugs (e.g. 0.1 + 0.2 = 0.30000000000000004)
    return Math.round(res * 100000000) / 100000000;
  }

  private formatOp(op: string): string {
    if (op === '*') return '×';
    if (op === '/') return '÷';
    if (op === '-') return '−';
    return op;
  }

  toggleSign() {
    const current = parseFloat(this.display());
    if (current !== 0) {
      this.display.set(String(-current));
    }
  }

  inputPercent() {
    const current = parseFloat(this.display());
    this.display.set(String(current / 100));
  }

  square() {
    const current = parseFloat(this.display());
    const res = current * current;
    this.equation.set(`sqr(${current})`);
    this.display.set(String(res));
    this.waitingForOperand.set(true);
  }

  squareRoot() {
    const current = parseFloat(this.display());
    if (current < 0) return;
    const res = Math.sqrt(current);
    this.equation.set(`√(${current})`);
    this.display.set(String(res));
    this.waitingForOperand.set(true);
  }

  reciprocal() {
    const current = parseFloat(this.display());
    if (current === 0) return;
    const res = 1 / current;
    this.equation.set(`1/(${current})`);
    this.display.set(String(res));
    this.waitingForOperand.set(true);
  }

  clearEntry() {
    this.display.set('0');
  }

  clearAll() {
    this.display.set('0');
    this.equation.set('');
    this.pendingOp.set(null);
    this.previousValue.set(null);
    this.waitingForOperand.set(false);
  }

  backspace() {
    const current = this.display();
    if (current.length > 1) {
      this.display.set(current.slice(0, -1));
    } else {
      this.display.set('0');
    }
  }

  memoryClear() {
    this.memory.set(null);
  }

  memoryRecall() {
    const mem = this.memory();
    if (mem !== null) {
      this.display.set(String(mem));
      this.waitingForOperand.set(true);
    }
  }

  memoryAdd() {
    const current = parseFloat(this.display());
    this.memory.set((this.memory() || 0) + current);
  }

  memorySubtract() {
    const current = parseFloat(this.display());
    this.memory.set((this.memory() || 0) - current);
  }

  memoryStore() {
    this.memory.set(parseFloat(this.display()));
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent) {
    if (event.key >= '0' && event.key <= '9') {
      this.inputDigit(event.key);
    } else if (event.key === '.' || event.key === ',') {
      this.inputDecimal();
    } else if (event.key === '+' || event.key === '-' || event.key === '*' || event.key === '/') {
      this.setOperation(event.key);
    } else if (event.key === 'Enter' || event.key === '=') {
      event.preventDefault();
      this.calculate();
    } else if (event.key === 'Backspace') {
      this.backspace();
    } else if (event.key === 'Escape') {
      this.clearAll();
    }
  }
}
