import * as migration_20260505_172626_initial_schema from './20260505_172626_initial_schema';
import * as migration_20260505_194128_users_tenants_array from './20260505_194128_users_tenants_array';
import * as migration_20260505_202447_cascade_tenant_delete from './20260505_202447_cascade_tenant_delete';
import * as migration_20260505_222023_grow_site_settings from './20260505_222023_grow_site_settings';
import * as migration_20260506_205114_block_presets from './20260506_205114_block_presets';
import * as migration_20260509_pages_tenant_slug_unique from './20260509_pages_tenant_slug_unique';
import * as migration_20260509_site_settings_tenant_unique from './20260509_site_settings_tenant_unique';
import * as migration_20260509_media_tenant_filename_unique from './20260509_media_tenant_filename_unique';

export const migrations = [
  {
    up: migration_20260505_172626_initial_schema.up,
    down: migration_20260505_172626_initial_schema.down,
    name: '20260505_172626_initial_schema',
  },
  {
    up: migration_20260505_194128_users_tenants_array.up,
    down: migration_20260505_194128_users_tenants_array.down,
    name: '20260505_194128_users_tenants_array',
  },
  {
    up: migration_20260505_202447_cascade_tenant_delete.up,
    down: migration_20260505_202447_cascade_tenant_delete.down,
    name: '20260505_202447_cascade_tenant_delete',
  },
  {
    up: migration_20260505_222023_grow_site_settings.up,
    down: migration_20260505_222023_grow_site_settings.down,
    name: '20260505_222023_grow_site_settings'
  },
  {
    up: migration_20260506_205114_block_presets.up,
    down: migration_20260506_205114_block_presets.down,
    name: '20260506_205114_block_presets'
  },
  {
    up: migration_20260509_pages_tenant_slug_unique.up,
    down: migration_20260509_pages_tenant_slug_unique.down,
    name: '20260509_pages_tenant_slug_unique'
  },
  {
    up: migration_20260509_site_settings_tenant_unique.up,
    down: migration_20260509_site_settings_tenant_unique.down,
    name: '20260509_site_settings_tenant_unique'
  },
  {
    up: migration_20260509_media_tenant_filename_unique.up,
    down: migration_20260509_media_tenant_filename_unique.down,
    name: '20260509_media_tenant_filename_unique'
  },
];
