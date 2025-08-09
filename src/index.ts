/**
 * # Zodiac - Type-safe WebSocket and WebRTC messaging
 * 
 * Zodiac provides type-safe, validated messaging for real-time applications using WebSockets,
 * WebRTC peer-to-peer connections, with full TypeScript support and Zod validation.
 * 
 * ## Quick Start
 * 
 * ```typescript
 * import { defineMessage, BrowserChannel, z } from '@xtr-dev/zodiac';
 * 
 * // Define a message type
 * const userMessage = defineMessage('user-message', z.object({
 *   name: z.string(),
 *   message: z.string()
 * }));
 * 
 * // Create and connect channel
 * const channel = new BrowserChannel();
 * await channel.connect('ws://localhost:8080');
 * 
 * // Listen for messages (fully typed!)
 * channel.on(userMessage, (data) => {
 *   console.log(`${data.name}: ${data.message}`);
 * });
 * 
 * // Send messages with validation
 * await channel.sendMessage(userMessage, {
 *   name: 'Alice',
 *   message: 'Hello world!'
 * });
 * ```
 * 
 * @packageDocumentation
 */

/**
 * @category Channels
 * WebSocket channel implementation for browser environments.
 * Provides automatic reconnection and type-safe messaging.
 */
export { BrowserChannel } from './browser-channel.js';

/**
 * @category Channels  
 * WebSocket channel implementation for Node.js environments.
 * Provides automatic reconnection and type-safe messaging.
 */
export { NodeChannel } from './node-channel.js';

/**
 * @category Channels
 * WebRTC peer-to-peer data channel implementation.
 * Enables direct browser-to-browser communication without servers.
 */
export { PeerChannel } from './peer-channel.js';

/**
 * @category Types
 * Core type definitions used throughout Zodiac.
 */
export type { MessageId, MessageDefinition, InferMessageData, MessageHandler, Message } from './types.js';

/**
 * @category Configuration
 * Configuration options for WebRTC peer channels and signaling messages.
 */
export type { PeerChannelConfig, SignalingMessage } from './peer-channel.js';

import { z } from 'zod';
import type { MessageId, MessageDefinition } from './types.js';

/**
 * @category Message Definition
 * Re-exported Zod library for schema definition convenience.
 * Use this to create validation schemas for your messages.
 */
export { z };

/**
 * Creates a type-safe message definition with validation schema.
 * 
 * This is the core function for defining message types in Zodiac. It creates a message
 * definition that includes both the data schema and the complete message schema with
 * metadata fields.
 * 
 * @example
 * ```typescript
 * import { defineMessage, z } from '@xtr-dev/zodiac';
 * 
 * // Define a user message type
 * const userMessage = defineMessage('user-message', z.object({
 *   name: z.string().min(1),
 *   message: z.string().max(500),
 *   timestamp: z.number().optional()
 * }));
 * 
 * // The returned definition has full type inference
 * channel.on(userMessage, (data) => {
 *   // data.name is string
 *   // data.message is string  
 *   // data.timestamp is number | undefined
 * });
 * ```
 * 
 * @category Message Definition
 * @template T - The TypeScript type inferred from the Zod schema
 * @param id - Unique identifier for this message type
 * @param dataSchema - Zod schema for validating message data
 * @returns A message definition object with type information and schemas
 */
export function defineMessage<T>(id: MessageId, dataSchema: z.ZodSchema<T>): MessageDefinition<T> {
  const messageSchema = z.object({
    id: z.literal(id),
    data: dataSchema,
    timestamp: z.number().optional()
  });

  return {
    id,
    schema: dataSchema,
    messageSchema
  } as const;
}