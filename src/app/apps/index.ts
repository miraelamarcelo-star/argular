import { AppManifest } from '../contracts/apps/app-manifest.contract';
import { posAppManifest } from './pos/pos.manifest';
import { inventoryAppManifest } from './inventory/inventory.manifest';
import { crmAppManifest } from './crm/crm.manifest';
import { financeAppManifest } from './finance/finance.manifest';
import { tablesAppManifest } from './tables/tables.manifest';
import { publicSpaceAppManifest } from './public-space/public-space.manifest';
import { whatsappAppManifest } from './whatsapp/whatsapp.manifest';
import { telegramAppManifest } from './telegram/telegram.manifest';
import { ifoodAppManifest } from './ifood/ifood.manifest';

export const BUSINESS_APP_MANIFESTS: AppManifest[] = [
  posAppManifest,
  inventoryAppManifest,
  crmAppManifest,
  financeAppManifest,
  tablesAppManifest,
  publicSpaceAppManifest,
  whatsappAppManifest,
  telegramAppManifest,
  ifoodAppManifest
];
