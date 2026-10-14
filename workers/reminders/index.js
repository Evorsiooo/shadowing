// Reminders Worker: posts practice reminders to Discord. Shares the app's D1 database.
// The account's free cron triggers are used up, so a Durable Object alarm does the scheduling:
// it wakes every 15 minutes, sends whatever is due, and sets the next alarm. The app's API
// (service binding REMINDERS) calls /arm whenever reminder settings are saved, to start it.
// Deploy: npx wrangler deploy -c workers/reminders/wrangler.toml
import { DurableObject } from 'cloudflare:workers';
import { runReminders } from '../../server/reminders.js';

const EVERY = 15 * 60 * 1000;
const nextSlot = (now) => Math.floor(now / EVERY) * EVERY + EVERY + 5000; // just after each quarter hour

export class Scheduler extends DurableObject {
  async arm() {
    const cur = await this.ctx.storage.getAlarm();
    if (!cur || cur < Date.now() - 60000) await this.ctx.storage.setAlarm(nextSlot(Date.now()));
    return cur || null;
  }
  async alarm() {
    try {
      const r = await runReminders(this.env, new Date());
      console.log('reminders:', r);
    } finally {
      await this.ctx.storage.setAlarm(nextSlot(Date.now()));
    }
  }
}

export default {
  async fetch(request, env) {
    // only reachable through the app's service binding (no public route)
    const url = new URL(request.url);
    if (url.pathname === '/arm') {
      const stub = env.SCHEDULER.get(env.SCHEDULER.idFromName('reminders'));
      const was = await stub.arm();
      return Response.json({ ok: true, armed: true, previous: was });
    }
    return new Response('Not found', { status: 404 });
  },
};
