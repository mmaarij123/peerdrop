import { randomInt } from 'node:crypto';
import config from './config.js';

function generateRandomWords(wordList: readonly string[], count: number) {
  return Array.from({ length: count }, () => wordList[randomInt(wordList.length)]);
}

export function generateShortSlug() {
  return generateRandomWords(config.shortSlug.chars.split(''), config.shortSlug.numChars).join('');
}

export function generateLongSlug() {
  return generateRandomWords(config.longSlug.words, config.longSlug.numWords).join('/');
}
