// Euno, the mascot: the Bible Strong avatar engine (src/euno/engine) with Euno's definition, in his calm version (calm.mjs).
import { createAvatar } from './engine/web/index.ts';
import definition from './euno.avatar.json';
import { calmDefinition } from './calm.mjs';

window.EunoEngine = {
  definition,
  calm: (opts) => calmDefinition(definition, opts),
  create: (el, opts = {}) => createAvatar(el, { definition, size: '100%', ...opts }),
};
