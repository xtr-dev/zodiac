import { z } from 'zod';

/**
 * @category Types
 * Unique identifier for message types. Should be descriptive and unique across your application.
 * 
 * @example
 * ```typescript
 * const messageId: MessageId = 'user-login';
 * const anotherMessageId: MessageId = 'chat-message';
 * ```
 */
export type MessageId = string;

/**
 * @category Types
 * The complete message structure sent over the wire.
 * Contains the message ID, validated data, and optional timestamp.
 * 
 * @template T - The type of the message data
 * 
 * @example
 * ```typescript
 * const message: Message<{name: string}> = {
 *   id: 'user-message',
 *   data: { name: 'Alice' },
 *   timestamp: Date.now()
 * };
 * ```
 */
export interface Message<T = any> {
  /** Unique identifier for this message type */
  id: MessageId;
  /** The validated message data */
  data: T;
  /** Optional timestamp when message was sent */
  timestamp?: number;
}

/**
 * @category Types
 * Handler function for processing incoming messages of a specific type.
 * Receives the validated data and complete message object.
 * 
 * @template T - The type of the message data
 * 
 * @example
 * ```typescript
 * const handler: MessageHandler<{name: string, message: string}> = (data, message) => {
 *   console.log(`${data.name} says: ${data.message}`);
 *   console.log(`Received at: ${message.timestamp}`);
 * };
 * ```
 */
export type MessageHandler<T = any> = (data: T, message: Message<T>) => void | Promise<void>;

/**
 * @category Types
 * Complete message definition created by `defineMessage()`.
 * Contains the message ID, data validation schema, and complete message validation schema.
 * 
 * @template T - The TypeScript type inferred from the Zod schema
 * 
 * @example
 * ```typescript
 * const userMessage: MessageDefinition<{name: string}> = defineMessage(
 *   'user-message',
 *   z.object({ name: z.string() })
 * );
 * 
 * // Access the components
 * console.log(userMessage.id); // 'user-message'
 * userMessage.schema.parse({ name: 'Alice' }); // Validates just the data
 * userMessage.messageSchema.parse({
 *   id: 'user-message',
 *   data: { name: 'Alice' },
 *   timestamp: Date.now()
 * }); // Validates complete message
 * ```
 */
export interface MessageDefinition<T> {
  /** The unique message type identifier */
  readonly id: MessageId;
  /** Zod schema for validating message data */
  readonly schema: z.ZodSchema<T>;
  /** Zod schema for validating the complete message structure */
  readonly messageSchema: z.ZodObject<{
    id: z.ZodLiteral<MessageId>;
    data: z.ZodSchema<T>;
    timestamp: z.ZodOptional<z.ZodNumber>;
  }>;
}

/**
 * @category Types
 * Utility type to extract the data type from a MessageDefinition.
 * Useful for creating handlers and working with message data types.
 * 
 * @template T - A MessageDefinition type
 * 
 * @example
 * ```typescript
 * const userMessage = defineMessage('user', z.object({
 *   name: z.string(),
 *   age: z.number()
 * }));
 * 
 * // Extract the data type
 * type UserData = InferMessageData<typeof userMessage>;
 * // UserData is { name: string; age: number }
 * 
 * const userData: UserData = { name: 'Alice', age: 30 };
 * ```
 */
export type InferMessageData<T> = T extends MessageDefinition<infer U> ? U : never;