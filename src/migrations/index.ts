import * as migration_20260505_172626_initial_schema from './20260505_172626_initial_schema';
import * as migration_20260505_194128_users_tenants_array from './20260505_194128_users_tenants_array';

export const migrations = [
  {
    up: migration_20260505_172626_initial_schema.up,
    down: migration_20260505_172626_initial_schema.down,
    name: '20260505_172626_initial_schema',
  },
  {
    up: migration_20260505_194128_users_tenants_array.up,
    down: migration_20260505_194128_users_tenants_array.down,
    name: '20260505_194128_users_tenants_array'
  },
];
