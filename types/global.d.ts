import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var pool: Pool | undefined;
}
