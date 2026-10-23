import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { OsSdkService } from '../../../sdk/os-sdk.service';
import { OsContext } from '../../../contracts/os/os-context.contract';
import { PublicSpaceService, PublicSpaceData } from '../public-space.service';

@Component({
  selector: 'app-public-space-manager',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink],
  templateUrl: './public-space-manager.component.html'
})
export class PublicSpaceManagerComponent implements OnInit {
  private publicSpaceService = inject(PublicSpaceService);
  private sdk = inject(OsSdkService);

  private app!: OsContext;

  loading = signal<boolean>(true);
  saving = signal<boolean>(false);
  activeTab = signal<'settings' | 'content' | 'theme' | 'publish'>('settings');

  // Feedback banner state signals
  feedbackMessage = signal<string>('');
  isErrorFeedback = signal<boolean>(false);

  // Local state bound to form
  spaceData: PublicSpaceData = {
    companyId: '',
    companySlug: '',
    title: '',
    description: '',
    logo: '',
    templateId: 'business',
    themeColor: '#3b82f6',
    status: 'draft',
    phone: '',
    email: '',
    address: '',
    hours: '',
    products: []
  };

  // New product item creator
  newProdName = signal<string>('');
  newProdPrice = signal<number>(0);
  newProdDesc = signal<string>('');

  onTitleInput(event: Event) {
    this.spaceData.title = (event.target as HTMLInputElement).value;
  }

  onSlugInput(event: Event) {
    this.spaceData.companySlug = (event.target as HTMLInputElement).value;
  }

  onDescriptionInput(event: Event) {
    this.spaceData.description = (event.target as HTMLTextAreaElement).value;
  }

  onLogoInput(event: Event) {
    this.spaceData.logo = (event.target as HTMLInputElement).value;
  }

  onThemeColorInput(event: Event) {
    this.spaceData.themeColor = (event.target as HTMLInputElement).value;
  }

  onPhoneInput(event: Event) {
    this.spaceData.phone = (event.target as HTMLInputElement).value;
  }

  onEmailInput(event: Event) {
    this.spaceData.email = (event.target as HTMLInputElement).value;
  }

  onAddressInput(event: Event) {
    this.spaceData.address = (event.target as HTMLInputElement).value;
  }

  onHoursInput(event: Event) {
    this.spaceData.hours = (event.target as HTMLInputElement).value;
  }

  onNewProdNameInput(event: Event) {
    this.newProdName.set((event.target as HTMLInputElement).value);
  }

  onNewProdPriceInput(event: Event) {
    this.newProdPrice.set(Number((event.target as HTMLInputElement).value));
  }

  onNewProdDescInput(event: Event) {
    this.newProdDesc.set((event.target as HTMLInputElement).value);
  }

  // Theme presets
  themePresets = [
    { name: 'Indigo Dream', color: '#4f46e5' },
    { name: 'Emerald Forest', color: '#10b981' },
    { name: 'Amber Sunset', color: '#f59e0b' },
    { name: 'Rose Petal', color: '#f43f5e' },
    { name: 'Slate Modern', color: '#475569' }
  ];

  // Template segments
  templates: { id: 'restaurant' | 'retail' | 'business'; name: string; icon: string; desc: string }[] = [
    { id: 'restaurant', name: 'Restaurante & Gastro', icon: 'restaurant', desc: 'Foco em cardápio, culinária, horários e endereço de atendimento local.' },
    { id: 'retail', name: 'Varejo & Moda', icon: 'shopping_bag', desc: 'Vitrine digital com produtos em destaque, tags de preço e promoção.' },
    { id: 'business', name: 'Empresa & Serviços', icon: 'corporate_fare', desc: 'Layout institucional para profissionais autônomos e prestadores de serviços.' }
  ];

  ngOnInit() {
    this.app = this.sdk.bind('app_public_space');
    this.spaceData.companyId = this.app.companyId;
    this.loadSpaceConfig();
  }

  showFeedback(message: string, isError = false) {
    this.feedbackMessage.set(message);
    this.isErrorFeedback.set(isError);

    // Dispatch a beautiful native system notification via the OS Context (P1)
    if (this.app) {
      this.app.notify('Public Space', message, isError ? 'error' : 'success');
    }

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      if (this.feedbackMessage() === message) {
        this.feedbackMessage.set('');
      }
    }, 4000);
  }

  loadSpaceConfig() {
    this.loading.set(true);
    const companyId = this.app.companyId;
    this.publicSpaceService.getSpaceConfig(companyId).subscribe({
      next: (res) => {
        this.spaceData = { ...res };
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
        this.showFeedback('Erro ao carregar configurações do portal.', true);
      }
    });
  }

  saveConfig(statusChange?: 'draft' | 'published') {
    this.saving.set(true);
    const companyId = this.app.companyId;

    if (statusChange) {
      this.spaceData.status = statusChange;
    }

    this.publicSpaceService.saveSpaceConfig(companyId, this.spaceData).subscribe({
      next: () => {
        this.saving.set(false);
        if (statusChange === 'published') {
          this.showFeedback('Sua Presença Digital foi publicada com sucesso!');
        } else if (statusChange === 'draft') {
          this.showFeedback('Site movido para modo rascunho (Draft).');
        } else {
          this.showFeedback('Configurações salvas como rascunho com sucesso.');
        }
      },
      error: (err) => {
        console.error(err);
        this.saving.set(false);
        
        // Check for 403 authorization error
        if (err.status === 403) {
          this.showFeedback('Acesso Negado: Apenas administradores do tenant podem alterar as configurações do Public Space.', true);
        } else {
          this.showFeedback('Erro ao salvar as configurações.', true);
        }
      }
    });
  }

  addProduct() {
    if (!this.newProdName().trim()) {
      this.showFeedback('Por favor, informe o nome do produto ou serviço.', true);
      return;
    }
    this.spaceData.products.push({
      name: this.newProdName().trim(),
      price: this.newProdPrice() || 0,
      desc: this.newProdDesc().trim()
    });
    this.newProdName.set('');
    this.newProdPrice.set(0);
    this.newProdDesc.set('');
    this.showFeedback('Produto adicionado à vitrine pública com sucesso!');
  }

  removeProduct(index: number) {
    this.spaceData.products.splice(index, 1);
    this.showFeedback('Produto removido da vitrine.');
  }

  selectTheme(color: string) {
    this.spaceData.themeColor = color;
  }
}
