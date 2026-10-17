import { createServices } from './app';
import { buildRuntime } from './runtime';

/**
 * v3.2: creates named demo customers to log in as (`npm run seed:demo -w @bellwether/api`).
 * Customers that already exist are left alone, so it's safe to run again.
 */
export const DEMO_PASSWORD = 'correct horse battery';

const CUSTOMERS = [
  { email: 'hill.farmer@example.com', farms: ['hill'] as const, team: true, pets: false },
  { email: 'dairy.farmer@example.com', farms: ['dairy'] as const, team: false, pets: false },
  { email: 'pet.owner@example.com', farms: [] as const, team: false, pets: true },
  { email: 'mixed.farm@example.com', farms: ['hill', 'dairy'] as const, team: true, pets: true },
];

const { deps, logger } = buildRuntime();
const { demoAccountService } = createServices(deps);

for (const customer of CUSTOMERS) {
  if (await deps.users.findCredentials(customer.email)) {
    logger.info(`${customer.email}: already there, skipped`);
    continue;
  }
  await demoAccountService.createCustomer({
    ...customer,
    farms: [...customer.farms],
    password: DEMO_PASSWORD,
  });
  logger.info(`${customer.email}: created`);
}
logger.info(`Done. Log in with any of these and the password "${DEMO_PASSWORD}".`);
process.exit(0);
