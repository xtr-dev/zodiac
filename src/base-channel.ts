import { Message, MessageId, MessageHandler, MessageDefinition, InferMessageData } from './types.js';

/**
 * @category Channels
 * Abstract base class for all channel implementations in Zodiac.
 * 
 * Provides common functionality for message handling, validation, and type-safe
 * communication across different transport mechanisms (WebSocket, WebRTC, etc.).
 * 
 * This class handles:
 * - Message handler registration and management
 * - Type-safe message sending with validation
 * - Incoming message parsing and routing
 * - Connection state management
 * 
 * ## Design Pattern
 * 
 * The BaseChannel uses the Template Method pattern where concrete implementations
 * (BrowserChannel, NodeChannel, PeerChannel) provide the transport-specific logic
 * while this base class handles the common message handling concerns.
 * 
 * ```mermaid
 * classDiagram
 *     class BaseChannel {
 *         <<abstract>>
 *         +sendMessage(definition, data)
 *         +on(definition, handler)
 *         +off(definition, handler)
 *         +isOpen() boolean
 *         #handleMessage(rawMessage)*
 *         #validateAndSerialize(id, data)*
 *     }
 *     class BrowserChannel {
 *         +connect(url)
 *         +disconnect()
 *         +send(id, data)
 *         +setReconnectOptions(max, delay)
 *     }
 *     class NodeChannel {
 *         +connect(url)
 *         +disconnect() 
 *         +send(id, data)
 *         +setReconnectOptions(max, delay)
 *     }
 *     class PeerChannel {
 *         +createOffer(peerId)
 *         +handleOffer(offer, fromPeer)
 *         +handleAnswer(answer)
 *         +handleIceCandidate(candidate)
 *     }
 *     
 *     BaseChannel <|-- BrowserChannel
 *     BaseChannel <|-- NodeChannel
 *     BaseChannel <|-- PeerChannel
 * ```
 * 
 * @example
 * Using any channel implementation:
 * ```typescript
 * import { defineMessage, BrowserChannel, z } from '@xtr-dev/zodiac';
 * 
 * // Define message type
 * const userMessage = defineMessage('user-msg', z.object({
 *   name: z.string(),
 *   message: z.string()
 * }));
 * 
 * // Create channel (could be any implementation)
 * const channel = new BrowserChannel();
 * 
 * // Type-safe message handling - same API across all channels
 * channel.on(userMessage, (data) => {
 *   console.log(`${data.name}: ${data.message}`); // Fully typed!
 * });
 * 
 * // Type-safe message sending - same API across all channels  
 * await channel.sendMessage(userMessage, {
 *   name: 'Alice',
 *   message: 'Hello world!'
 * });
 * ```
 */
export abstract class BaseChannel {
  protected messageHandlers = new Map<MessageId, Set<MessageHandler>>();
  protected isConnected = false;

  /**
   * Establishes connection to the specified endpoint.
   * Implementation varies by transport (WebSocket URL, WebRTC signaling, etc.)
   * 
   * @param url - Connection endpoint (format depends on channel type)
   */
  abstract connect(url: string): Promise<void>;
  
  /**
   * Closes the connection and cleans up resources.
   */
  abstract disconnect(): Promise<void>;
  
  /**
   * Sends raw data over the channel.
   * Use sendMessage() for type-safe validated sending instead.
   * 
   * @param id - Message type identifier
   * @param data - Raw message data
   */
  abstract send<T>(id: MessageId, data: T): Promise<void>;

  /**
   * Sends a type-safe, validated message using a message definition.
   * 
   * This is the preferred way to send messages as it provides:
   * - Compile-time type checking
   * - Runtime validation with Zod
   * - Automatic message ID handling
   * 
   * @template T - The message definition type
   * @param definition - Message definition created with defineMessage()
   * @param data - Message data that matches the definition's schema
   * 
   * @throws {ZodError} When data doesn't match the schema
   * 
   * @example
   * ```typescript
   * const userMsg = defineMessage('user', z.object({
   *   name: z.string(),
   *   age: z.number().min(0)
   * }));
   * 
   * // Type-safe and validated
   * await channel.sendMessage(userMsg, {
   *   name: 'Alice',
   *   age: 25
   * });
   * 
   * // TypeScript error: missing required field
   * await channel.sendMessage(userMsg, { name: 'Bob' }); // Error!
   * 
   * // Runtime error: validation fails
   * await channel.sendMessage(userMsg, { name: 'Charlie', age: -1 }); // Throws!
   * ```
   */
  async sendMessage<T extends MessageDefinition<any>>(
    definition: T,
    data: InferMessageData<T>
  ): Promise<void> {
    const validatedData = definition.schema.parse(data);
    return this.send(definition.id, validatedData);
  }

  /**
   * Registers a message handler for a specific message type (by string ID).
   * 
   * @param id - String identifier for the message type
   * @param handler - Function to handle incoming messages
   */
  on<T>(id: MessageId, handler: MessageHandler<T>): void;
  
  /**
   * Registers a type-safe message handler using a message definition.
   * This is the preferred method as it provides full type safety.
   * 
   * @param definition - Message definition created with defineMessage()
   * @param handler - Type-safe handler function
   * 
   * @example
   * ```typescript
   * const chatMsg = defineMessage('chat', z.object({
   *   user: z.string(),
   *   text: z.string()
   * }));
   * 
   * // Fully typed handler - data.user and data.text are known
   * channel.on(chatMsg, (data, message) => {
   *   console.log(`${data.user}: ${data.text}`);
   *   console.log(`Sent at: ${message.timestamp}`);
   * });
   * ```
   */
  on<T extends MessageDefinition<any>>(definition: T, handler: MessageHandler<InferMessageData<T>>): void;
  on<T>(idOrDefinition: MessageId | MessageDefinition<any>, handler: MessageHandler<T | InferMessageData<MessageDefinition<any>>>): void {
    const id = typeof idOrDefinition === 'string' ? idOrDefinition : idOrDefinition.id;
    if (!this.messageHandlers.has(id)) {
      this.messageHandlers.set(id, new Set());
    }
    this.messageHandlers.get(id)!.add(handler as MessageHandler);
  }

  /**
   * Removes a message handler for a specific message type (by string ID).
   * 
   * @param id - String identifier for the message type
   * @param handler - The exact handler function to remove
   */
  off<T>(id: MessageId, handler: MessageHandler<T>): void;
  
  /**
   * Removes a type-safe message handler using a message definition.
   * 
   * @param definition - Message definition created with defineMessage() 
   * @param handler - The exact handler function to remove
   * 
   * @example
   * ```typescript
   * const handler = (data) => console.log(data.text);
   * 
   * // Register handler
   * channel.on(chatMsg, handler);
   * 
   * // Remove the same handler instance
   * channel.off(chatMsg, handler);
   * ```
   */
  off<T extends MessageDefinition<any>>(definition: T, handler: MessageHandler<InferMessageData<T>>): void;
  off<T>(idOrDefinition: MessageId | MessageDefinition<any>, handler: MessageHandler<T | InferMessageData<MessageDefinition<any>>>): void {
    const id = typeof idOrDefinition === 'string' ? idOrDefinition : idOrDefinition.id;
    const handlers = this.messageHandlers.get(id);
    if (handlers) {
      handlers.delete(handler as MessageHandler);
    }
  }

  protected async handleMessage(rawMessage: string): Promise<void> {
    try {
      const parsed = JSON.parse(rawMessage);
      const message: Message = {
        id: parsed.id,
        data: parsed.data,
        timestamp: parsed.timestamp || Date.now()
      };

      const handlers = this.messageHandlers.get(message.id);
      if (handlers) {
        for (const handler of handlers) {
          try {
            await handler(message.data, message);
          } catch (error) {
            console.error(`Message handler error: ${error}`);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to parse message: ${error}`);
    }
  }

  protected validateAndSerialize<T>(id: MessageId, data: T): string {
    const message: Message<T> = {
      id,
      data,
      timestamp: Date.now()
    };

    return JSON.stringify(message);
  }

  /**
   * Checks if the channel is currently connected and ready for communication.
   * 
   * @returns true if connected, false otherwise
   * 
   * @example
   * ```typescript
   * if (channel.isOpen()) {
   *   await channel.sendMessage(someMessage, data);
   * } else {
   *   console.log('Channel is not connected');
   * }
   * ```
   */
  isOpen(): boolean {
    return this.isConnected;
  }
}