import { BaseChannel } from './base-channel.js';
import { MessageId } from './types.js';

/**
 * @category Channels
 * WebSocket channel implementation optimized for browser environments.
 * 
 * Provides reliable WebSocket communication with automatic reconnection,
 * exponential backoff, and full type-safety. Designed specifically for
 * browser JavaScript environments using the standard WebSocket API.
 * 
 * ## Features
 * 
 * - **Automatic Reconnection**: Configurable retry attempts with exponential backoff
 * - **Type Safety**: Full TypeScript support with Zod validation
 * - **Error Resilience**: Graceful handling of connection failures
 * - **Browser Optimized**: Uses native WebSocket API for best performance
 * - **Memory Efficient**: Proper cleanup and resource management
 * 
 * ## Reconnection Behavior
 * 
 * The channel automatically attempts to reconnect when connections are lost:
 * 
 * ```mermaid
 * graph TD
 *     A[Connection Lost] --> B[Wait Delay]
 *     B --> C[Attempt Reconnect]
 *     C --> D{Success?}
 *     D -->|Yes| E[Reset Counter]
 *     D -->|No| F[Increment Counter]
 *     F --> G{Max Attempts?}
 *     G -->|No| H[Double Delay]
 *     H --> B
 *     G -->|Yes| I[Give Up]
 * ```
 * 
 * Default retry schedule:
 * - Attempt 1: 1 second delay
 * - Attempt 2: 2 second delay  
 * - Attempt 3: 4 second delay
 * - Attempt 4: 8 second delay
 * - Attempt 5: 16 second delay
 * - After 5 attempts: Stop trying
 * 
 * @example
 * Basic usage:
 * ```typescript
 * import { BrowserChannel, defineMessage, z } from '@xtr-dev/zodiac';
 * 
 * // Create channel
 * const channel = new BrowserChannel();
 * 
 * // Configure reconnection (optional)
 * channel.setReconnectOptions(10, 500); // 10 attempts, 500ms base delay
 * 
 * // Define message types
 * const statusUpdate = defineMessage('status', z.object({
 *   user: z.string(),
 *   online: z.boolean(),
 *   lastSeen: z.number()
 * }));
 * 
 * // Set up handlers before connecting
 * channel.on(statusUpdate, (data) => {
 *   console.log(`${data.user} is ${data.online ? 'online' : 'offline'}`);
 * });
 * 
 * // Connect to WebSocket server
 * try {
 *   await channel.connect('ws://localhost:8080');
 *   console.log('Connected successfully!');
 *   
 *   // Send messages
 *   await channel.sendMessage(statusUpdate, {
 *     user: 'alice',
 *     online: true,
 *     lastSeen: Date.now()
 *   });
 * } catch (error) {
 *   console.error('Failed to connect:', error);
 * }
 * ```
 * 
 * @example
 * With custom reconnection settings:
 * ```typescript
 * const channel = new BrowserChannel();
 * 
 * // Custom reconnection: 15 attempts, starting at 2 seconds
 * channel.setReconnectOptions(15, 2000);
 * 
 * await channel.connect('wss://api.example.com/ws');
 * 
 * // The channel will automatically reconnect if connection drops
 * // Schedule: 2s, 4s, 8s, 16s, 32s, 64s, ...
 * ```
 * 
 * @example
 * Error handling:
 * ```typescript
 * channel.on('error-event', (data) => {
 *   console.error('Server error:', data.message);
 * });
 * 
 * try {
 *   await channel.sendMessage(someMessage, data);
 * } catch (error) {
 *   if (error.name === 'ZodError') {
 *     console.error('Invalid data:', error.errors);
 *   } else {
 *     console.error('Network error:', error.message);
 *   }
 * }
 * ```
 */
export class BrowserChannel extends BaseChannel {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  /**
   * Establishes a WebSocket connection to the specified server.
   * 
   * Automatically handles connection state validation and sets up
   * reconnection logic for dropped connections.
   * 
   * @param url - WebSocket server URL (ws:// or wss://)
   * @throws {Error} If already connected or connection is in progress
   * @throws {Error} If WebSocket creation fails
   * 
   * @example
   * ```typescript
   * // Connect to local development server
   * await channel.connect('ws://localhost:8080');
   * 
   * // Connect to secure production server
   * await channel.connect('wss://api.myapp.com/websocket');
   * ```
   */
  async connect(url: string): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      throw new Error('Connection already in progress');
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      throw new Error('Already connected');
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onclose = (event) => {
          this.isConnected = false;
          
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => {
              this.reconnectAttempts++;
              this.connect(url).catch(() => {});
            }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
          }
        };

        this.ws.onerror = (event) => {
          const error = new Error('WebSocket error');
          reject(error);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        reject(new Error(`Failed to create WebSocket: ${error}`));
      }
    });
  }

  async disconnect(): Promise<void> {
    if (!this.ws) {
      return;
    }

    return new Promise((resolve) => {
      if (this.ws!.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }

      const handleClose = () => {
        this.ws!.removeEventListener('close', handleClose);
        resolve();
      };

      this.ws!.addEventListener('close', handleClose);
      this.ws!.close();
    });
  }

  async send<T>(id: MessageId, data: T): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const serialized = this.validateAndSerialize(id, data);
    this.ws.send(serialized);
  }

  /**
   * Configures automatic reconnection behavior.
   * 
   * Call this before connecting to customize how the channel handles
   * connection failures. Uses exponential backoff: each retry waits
   * longer than the previous attempt.
   * 
   * @param maxAttempts - Maximum number of reconnection attempts (default: 5)
   * @param baseDelay - Initial delay in milliseconds (default: 1000)
   * 
   * @example
   * ```typescript
   * // More aggressive reconnection
   * channel.setReconnectOptions(20, 500);
   * // Will try: 500ms, 1s, 2s, 4s, 8s, 16s, 32s...
   * 
   * // Less aggressive reconnection  
   * channel.setReconnectOptions(3, 5000);
   * // Will try: 5s, 10s, 20s, then give up
   * 
   * // Disable reconnection
   * channel.setReconnectOptions(0, 1000);
   * ```
   */
  setReconnectOptions(maxAttempts: number, baseDelay: number): void {
    this.maxReconnectAttempts = maxAttempts;
    this.reconnectDelay = baseDelay;
  }
}