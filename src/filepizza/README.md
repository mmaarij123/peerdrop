# FilePizza channel backend

The channel repository, slug generation, and ingredient list derive from FilePizza commit [`1e4d02f`](https://github.com/kern/filepizza/tree/1e4d02fa91527d8dc83f4094ca394f8c29a88b56). The source paths are `src/channel.ts`, `src/slugs.ts`, `src/config.ts`, and `src/toppings.ts`. See the [upstream license](../../licenses/FilePizza.txt).

PeerDrop uses the in-memory FilePizza repository on the Fastify node that owns the transfer. The adapter uses Node ESM imports, synchronous random generation to keep alias reservation atomic, and a shared expiration timer for both aliases. The timer is cleared when the channel or server closes. The vendored module keeps the FilePizza channel shape and lifecycle methods. PeerDrop provides access control and does not expose the channel secret or use a slug as an invite credential.
