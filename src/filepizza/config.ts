import toppings from './toppings.js';

export default {
  channel: { ttl: 60 * 60 },
  shortSlug: { numChars: 8, chars: '0123456789abcdefghijklmnopqrstuvwxyz', maxAttempts: 8 },
  longSlug: { numWords: 4, words: toppings, maxAttempts: 8 },
};
