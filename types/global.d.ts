import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var pool: Pool | undefined;
  // eslint-disable-next-line no-var
  var migrationInitPromise: Promise<void> | undefined;
}
