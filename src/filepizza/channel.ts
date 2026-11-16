import { randomUUID } from 'node:crypto';
import config from './config.js';
import { generateShortSlug, generateLongSlug } from './slugs.js';

export type Channel = {
  secret?: string;
  longSlug: string;
  shortSlug: string;
  uploaderPeerID: string;
};

export interface ChannelRepo {
  createChannel(uploaderPeerID: string, ttl?: number): Promise<Channel & { secret: string }>;
  fetchChannel(slug: string, scrubSecret?: boolean): Promise<Channel | null>;
  renewChannel(slug: string, secret: string, ttl?: number): Promise<boolean>;
  destroyChannel(slug: string): Promise<void>;
  close(): void;
}

function getShortSlugKey(slug: string) { return `short:${slug}`; }
function getLongSlugKey(slug: string) { return `long:${slug}`; }

function uniqueSlug(generate: () => string, isTaken: (slug: string) => boolean, attempts: number) {
  for (let i = 0; i < attempts; i++) {
    const slug = generate();
    if (!isTaken(slug)) return slug;
  }
  throw new Error('Max attempts reached generating a FilePizza channel slug');
}

type MemoryStoredChannel = {
  channel: Channel & { secret: string };
  expiresAt: number;
  timeout?: NodeJS.Timeout;
};

export class MemoryChannelRepo implements ChannelRepo {
  private channels = new Map<string, MemoryStoredChannel>();

  private read(key: string) {
    const stored = this.channels.get(key);
    if (stored && stored.expiresAt <= Date.now()) {
      this.remove(stored);
      return undefined;
    }
    return stored;
  }

  private lookup(slug: string) {
    return this.read(getShortSlugKey(slug)) ?? this.read(getLongSlugKey(slug));
  }

  private setChannelTimeout(stored: MemoryStoredChannel, ttl: number) {
    clearTimeout(stored.timeout);
    const milliseconds = ttl * 1000;
    stored.expiresAt = Date.now() + milliseconds;
    stored.timeout = setTimeout(() => this.remove(stored), milliseconds).unref();
  }

  private remove(stored: MemoryStoredChannel) {
    clearTimeout(stored.timeout);
    const shortKey = getShortSlugKey(stored.channel.shortSlug);
    const longKey = getLongSlugKey(stored.channel.longSlug);
    if (this.channels.get(shortKey) === stored) this.channels.delete(shortKey);
    if (this.channels.get(longKey) === stored) this.channels.delete(longKey);
  }

  async createChannel(uploaderPeerID: string, ttl = config.channel.ttl) {
    const shortSlug = uniqueSlug(generateShortSlug, slug => Boolean(this.read(getShortSlugKey(slug))), config.shortSlug.maxAttempts);
    const longSlug = uniqueSlug(generateLongSlug, slug => Boolean(this.read(getLongSlugKey(slug))), config.longSlug.maxAttempts);
    const channel = { secret: randomUUID(), longSlug, shortSlug, uploaderPeerID };
    const stored = { channel, expiresAt: 0 };
    this.setChannelTimeout(stored, ttl);
    this.channels.set(getShortSlugKey(shortSlug), stored);
    this.channels.set(getLongSlugKey(longSlug), stored);
    return { ...channel };
  }

  async fetchChannel(slug: string, scrubSecret = false): Promise<Channel | null> {
    const stored = this.lookup(slug);
    if (!stored) return null;
    const channel: Channel = { ...stored.channel };
    if (scrubSecret) delete channel.secret;
    return channel;
  }

  async renewChannel(slug: string, secret: string, ttl = config.channel.ttl) {
    const stored = this.lookup(slug);
    if (!stored || stored.channel.secret !== secret) return false;
    this.setChannelTimeout(stored, ttl);
    return true;
  }

  async destroyChannel(slug: string) {
    const stored = this.lookup(slug);
    if (stored) this.remove(stored);
  }

  close() {
    for (const stored of new Set(this.channels.values())) this.remove(stored);
  }
}
