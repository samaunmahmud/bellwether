import { createServer } from 'node:http';
import { createApp, createServices } from './app';
import { createBriefingJob } from './jobs/briefingJob';
import { createPetReminderJob } from './jobs/petReminderJob';
import { buildRuntime } from './runtime';

const { config, logger, deps } = buildRuntime();

const services = createServices(deps);
const app = createApp(deps, services);

createServer(app).listen(config.port, () => {
  logger.info(`Bellwether API running at http://localhost:${config.port}/graphql`);
});

// FR-4.5 / FR-4.3: generate each farm's daily briefing and send emails at each user's chosen time.
if (config.briefingJobMinutes > 0) {
  const job = createBriefingJob({ ...deps, services });
  const petJob = createPetReminderJob(deps);
  let running = false;
  const tick = async () => {
    if (running) return; // never overlap runs
    running = true;
    try {
      const summary = await job.runOnce();
      logger.debug(`briefing job: ${JSON.stringify(summary)}`);
    } catch (err) {
      logger.warn(`briefing job failed: ${(err as Error).message}`);
    }
    try {
      const summary = await petJob.runOnce();
      logger.debug(`pet reminder job: ${JSON.stringify(summary)}`);
    } catch (err) {
      logger.warn(`pet reminder job failed: ${(err as Error).message}`);
    } finally {
      running = false;
    }
  };
  setInterval(tick, config.briefingJobMinutes * 60 * 1000).unref();
  void tick();
}
