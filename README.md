# Zodiac

[![npm version](https://badge.fury.io/js/@xtr-dev%2Fzodiac.svg)](https://badge.fury.io/js/@xtr-dev%2Fzodiac)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Documentation](https://img.shields.io/badge/docs-typedoc-blue)](https://xtr-dev.github.io/zodiac/)
[![License](https://img.shields.io/badge/license-UNLICENSED-red)](./README.md)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@xtr-dev/zodiac)](https://bundlephobia.com/package/@xtr-dev/zodiac)

Type-safe WebSocket messaging with Zod validation. A lean, modern library for real-time communication.

## Features

- 🔒 **Type Safety**: Full TypeScript support with automatic type inference
- ✅ **Runtime Validation**: Powered by Zod schemas for data integrity  
- 🌐 **Universal**: Works in both browser and Node.js environments
- 🎯 **Simple API**: Clean, intuitive message handling with `on`/`off` methods
- 🔄 **Multiple Transports**: WebSocket, WebRTC P2P data channels
- 🚀 **Zero Dependencies**: Only depends on Zod for validation
- 📦 **Lightweight**: Minimal bundle size with tree-shaking support

## Quick Start

```bash
npm install @xtr-dev/zodiac zod
```

### Define Messages

```typescript
import { defineMessage, z } from '@xtr-dev/zodiac';

// Define type-safe messages
const userMessage = defineMessage('user-message', z.object({
  name: z.string(),
  message: z.string(),
  timestamp: z.number().optional()
}));

const chatJoin = defineMessage('chat-join', z.object({
  userId: z.string(),
  username: z.string()
}));
```

### Browser Usage

```typescript
import { BrowserChannel } from '@xtr-dev/zodiac';

const channel = new BrowserChannel();

// Listen for messages with full type safety
channel.on(userMessage, (data, message) => {
  console.log(`${data.name}: ${data.message}`);
  // data.name and data.message are fully typed!
});

channel.on(chatJoin, (data) => {
  console.log(`${data.username} joined!`);
});

// Connect and send messages
await channel.connect('wss://your-websocket-server.com');

// Send with automatic validation
await channel.sendMessage(userMessage, {
  name: 'Alice',
  message: 'Hello everyone!',
  timestamp: Date.now()
});
```

### Node.js Usage

```typescript
import { NodeChannel } from '@xtr-dev/zodiac';

const channel = new NodeChannel();

// Same API as browser
channel.on(userMessage, async (data) => {
  console.log(`Received: ${data.message}`);
  
  // Echo back
  await channel.sendMessage(userMessage, {
    name: 'Server',
    message: `Echo: ${data.message}`
  });
});

await channel.connect('ws://localhost:8080');
```

Zodiac also supports **WebRTC peer-to-peer** communication with `PeerChannel` for direct browser-to-browser messaging. See the [API documentation](https://xtr-dev.github.io/zodiac/) for details.

## Interactive Demo

Try the live HTML demo to see Zodiac in action:

```bash
git clone <this-repo>
cd zodiac
npm install
npm run example
```

This starts both a WebSocket todo server and opens an interactive demo where you can:
- Experience multi-user real-time todo list synchronization
- Send type-safe todo operations with validation
- Test collaborative todo management
- Open multiple tabs for multi-user testing
- See TypeScript types and validation in action

## Validation & Type Safety

Zodiac provides both compile-time and runtime safety:

```typescript
const userMsg = defineMessage('user', z.object({
  name: z.string(),
  age: z.number()
}));

// ✅ TypeScript knows the exact shape
channel.on(userMsg, (data) => {
  console.log(data.name); // string
  console.log(data.age);  // number
});

// ✅ Runtime validation prevents invalid data
await channel.sendMessage(userMsg, {
  name: 'Alice',
  age: 'invalid' // ❌ Throws validation error
});
```

## API Reference

### `defineMessage(id, schema)`

Creates a type-safe message definition with validation schema:

```typescript
const myMessage = defineMessage('my-message', z.object({
  content: z.string(),
  priority: z.enum(['low', 'high'])
}));

// Returns: { id: string, schema: ZodSchema, messageSchema: ZodObject }
```

### Channel Methods

All channels (`BrowserChannel`, `NodeChannel`, `PeerChannel`) share the same core API:

- `channel.on(definition, handler)` - Listen for messages with full type safety
- `channel.off(definition, handler)` - Remove message listeners  
- `channel.sendMessage(definition, data)` - Send validated messages
- `channel.connect(url)` - Establish connection
- `channel.disconnect()` - Close connection
- `channel.isOpen()` - Check connection status

See the [full API documentation](https://xtr-dev.github.io/zodiac/) for complete details.

## 📖 Documentation

- **[API Documentation](https://xtr-dev.github.io/zodiac/)** - Complete TypeDoc-generated API docs
- **[Examples](./examples/)** - Live demos and usage examples  
- **Local docs**: Run `npm run docs` to generate docs locally

Generate and serve docs locally:
```bash
npm run docs        # Generate documentation
npm run docs:serve  # Serve docs at http://localhost:8080
```

## License

UNLICENSED - No rights reserved
