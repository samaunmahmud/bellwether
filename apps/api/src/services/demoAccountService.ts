import { randomBytes } from 'node:crypto';
import { addDays } from '@bellwether/risk-engine';
import { londonToday } from '../dates';
import { appError } from '../errors';
import type { FarmRepository } from '../repositories/farmRepository';
import type { UserRepository } from '../repositories/userRepository';
import type { PasswordHasher } from '../auth/passwords';
import type { AuthService } from './authService';
import type { DemoFarmService } from './demoFarmService';
import type { PetService } from './petService';
import type { RecordsService } from './recordsService';
import type { TaskService } from './taskService';

/** Where the demo farms are, unless the visitor gives a postcode: Kendal, Cumbria. */
export const DEMO_POSTCODE = 'LA9 4DQ';

export interface DemoAccountDeps {
  enabled: boolean;
  authService: AuthService;
  demoFarmService: DemoFarmService;
  petService: PetService;
  recordsService: RecordsService;
  taskService: TaskService;
  users: UserRepository;
  farms: FarmRepository;
  hasher: PasswordHasher;
  now?: () => Date;
}

const secret = () => randomBytes(24).toString('base64url');

export interface DemoCustomer {
  email: string;
  password: string;
  postcode?: string;
  farms: Array<'hill' | 'dairy'>;
  /** Adds a worker and a viewer to the hill farm, and assigns them tasks */
  team?: boolean;
  pets?: boolean;
}

/**
 * v3.2: "Explore a demo account". Makes a new, private account for each visitor (so nobody sees
 * anyone else's changes) with two farms, a small team and two pets, then signs them in. The
 * password is random and never shown: the account lasts as long as the session.
 */
export function createDemoAccountService(deps: DemoAccountDeps) {
  const now = deps.now ?? (() => new Date());

  /** A team member who never signs in: only there so sharing and assignment have something to show. */
  async function teammate(name: string, tag: string) {
    const user = await deps.users.createUser({
      email: `${name}.${tag}@example.com`,
      passwordHash: await deps.hasher.hash(secret()),
    });
    if (!user) throw new Error('demo teammate already exists');
    return user;
  }

  /** Builds one customer's account. `farms` picks which demo farms they own. */
  async function createCustomer(input: DemoCustomer) {
    const signedIn = await deps.authService.signUp(input.email, input.password);
    const owner = signedIn.user;
    const postcode = input.postcode ?? DEMO_POSTCODE;
    const tag = input.email
      .split('@')[0]!
      .replace(/[^a-z0-9]/gi, '')
      .slice(-12)
      .toLowerCase();

    if (input.farms.includes('hill')) {
      const fellside = await deps.demoFarmService.create(owner, postcode);
      if (input.team) {
        // A worker who does the day-to-day jobs, and a viewer (e.g. the farm's vet or adviser).
        const worker = await teammate('alex', tag);
        const viewer = await teammate('jo.vet', tag);
        await deps.farms.addMember(fellside.id, worker.id, 'WORKER');
        await deps.farms.addMember(fellside.id, viewer.id, 'VIEWER');
        const open = (await deps.taskService.listTasks(owner.id, fellside.id)).filter(
          (t) => !t.done,
        );
        for (const task of open.slice(0, 3))
          await deps.taskService.updateTask(owner.id, task.id, { assigneeId: worker.id });
      }
    }
    if (input.farms.includes('dairy')) await deps.demoFarmService.createDairy(owner, postcode);
    if (input.pets) await addPets(owner.id, postcode);
    return signedIn;
  }

  return {
    createCustomer,

    /** A fresh private account with everything, for one visitor. */
    async start(postcode = DEMO_POSTCODE) {
      if (!deps.enabled) throw appError('BAD_INPUT', 'Demo accounts are turned off on this server');
      return createCustomer({
        email: `demo-${randomBytes(4).toString('hex')}@example.com`,
        password: secret(),
        postcode,
        farms: ['hill', 'dairy'],
        team: true,
        pets: true,
      });
    },
  };

  async function addPets(ownerId: string, postcode: string) {
    const today = londonToday(now());
    const ago = (days: number) => addDays(today, -days);
    const ahead = (days: number) => addDays(today, days);
    const pets = deps.petService;

    const bess = await pets.create(ownerId, {
      name: 'Bess',
      species: 'dog',
      category: 'pet',
      postcode,
      highExposureHabitat: true,
    });
    await pets.update(ownerId, bess.id, { remindersEnabled: true });
    const bessLogs = [
      { date: ago(330), type: 'Vaccination', note: 'Annual booster', nextDueDate: ahead(35) },
      { date: ago(150), type: 'Weigh-in', weightKg: 19.6 },
      { date: ago(120), type: 'Weigh-in', weightKg: 20.3 },
      { date: ago(90), type: 'Worming', nextDueDate: ago(0), weightKg: 20.8 },
      { date: ago(60), type: 'Weigh-in', weightKg: 21.4 },
      { date: ago(30), type: 'Flea and tick treatment', nextDueDate: ahead(7), weightKg: 21.9 },
      { date: ago(12), type: 'Tick check', note: 'One tick removed after woodland walk' },
      { date: ago(4), type: 'Weigh-in', weightKg: 22.1 },
    ];
    for (const log of bessLogs) await pets.addLog(ownerId, bess.id, log);

    const tom = await pets.create(ownerId, {
      name: 'Tom',
      species: 'cat',
      category: 'pet',
      postcode,
    });
    const tomLogs = [
      { date: ago(200), type: 'Vaccination', nextDueDate: ahead(165), weightKg: 4.1 },
      { date: ago(100), type: 'Worming', nextDueDate: ago(5), weightKg: 4.3 },
      { date: ago(20), type: 'Vet visit', note: 'Dental check, all fine', weightKg: 4.4 },
    ];
    for (const log of tomLogs) await pets.addLog(ownerId, tom.id, log);
  }
}

export type DemoAccountService = ReturnType<typeof createDemoAccountService>;
