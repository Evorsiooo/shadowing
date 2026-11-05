// Euno's calm version, used everywhere he appears (the app, the site, the icons).
// In his definition every expression also turns and tilts his whole head, and every animation cycles through several
// expressions, so on screen he kept moving. Here his pose is fixed per place he appears (`look`: where he faces,
// [up/down, left/right] in degrees) and never tilts; an expression only changes his eyes, plus a slight turn
// (`follow` of the expression's own turn). Each mood is a single held expression with blinks.
const BLINK = { enabled: true, initialDelayMs: 2400, minIntervalMs: 4200, maxIntervalMs: 8200, durationMs: 240 };
const NO_BLINK = { ...BLINK, enabled: false };

export function calmDefinition(definition, { look = [0, 0], follow = 0.15, holds = {} } = {}) {
  const def = JSON.parse(JSON.stringify(definition));
  for (const e of Object.values(def.expressions)) {
    e.head = { x: look[0] + e.head.x * follow, y: look[1] + e.head.y * follow, z: 0 };
  }
  def.animations = {};
  for (const [name, [expression, blink = true]] of Object.entries(holds)) {
    def.animations[name] = { playbackMode: 'loop', steps: [{ expression, holdMs: 600000, transitionMs: 450, transition: 'smooth' }], blink: blink ? BLINK : NO_BLINK };
  }
  def.animationOrder = Object.keys(def.animations);
  return def;
}
