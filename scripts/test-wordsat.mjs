// Which word a sound is named on (wordsAt in src/js/24-pron.js): never a word that cannot contain the sound.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const src = readFileSync(new URL('../src/js/24-pron.js', import.meta.url), 'utf8');
const body = src.slice(src.indexOf('const SPELLED'), src.indexOf('/* turns the engine'));
const wordsAt = new Function('Store', `${body}; return wordsAt;`)({ get: () => null });
const clip = { id: 'x', words: [{ w: 'I', s: 0, e: 0.28 }, { w: 'think', s: 0.3, e: 0.6 }, { w: 'to', s: 0.6, e: 0.8 }, { w: 'going', s: 0.8, e: 1.2 }, { w: 'beginning', s: 1.2, e: 1.8 }] };
const t = (name, got, want) => { assert.equal(got, want, name); console.log('ok  ' + name); };
t('"th" is not put on "I"', wordsAt(clip, 0.05, 0.15, 'ð'), '');
t('"th" goes on "think" when it is there', wordsAt(clip, 0.35, 0.55, 'θ'), 'think');
t('"v" is not put on "to" (nothing near it has a v)', wordsAt(clip, 0.65, 0.75, 'v'), '');
t('a neighbour within 0.15 s that has the letters is used ("n" next to "think")', wordsAt(clip, 0.65, 0.75, 'n'), 'think');
t('"ng" goes on "going"', wordsAt(clip, 0.9, 1.1, 'ŋ'), 'going');
t('"r" is not put on "beginning" (it has no r)', wordsAt(clip, 1.3, 1.6, 'r'), '');
t('a vowel has no spelling check', wordsAt(clip, 0.05, 0.15, 'ɪ'), 'I');
t('a neighbour more than 0.15 s away is not used', wordsAt(clip, 0.9, 0.95, 'θ'), '');
console.log('wordsAt tests passed');
