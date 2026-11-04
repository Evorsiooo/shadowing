// Euno, the mascot: the Bible Strong avatar engine (src/euno/engine, AGPL-3.0) with Euno's definition.
import { createAvatar } from './engine/web/index.ts';
import definition from './euno.avatar.json';

window.EunoEngine = {
  definition,
  create: (el, opts = {}) => createAvatar(el, { definition, size: '100%', ...opts }),
};
