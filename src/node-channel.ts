import WebSocket from 'ws';
import { BaseChannel } from './base-channel.js';
import { MessageId } from './types.js';

/**
 * @category Channels
 * WebSocket channel implementation optimized for Node.js environments.
 * 
 * Provides reliable WebSocket communication for server-side applications,
 * with automatic reconnection, robust error handling, and full type-safety.
 * Uses the popular 'ws' library for enhanced Node.js WebSocket support.
 * 
 * ## Key Differences from BrowserChannel
 * 
 * - **Server Optimized**: Better performance and memory usage for Node.js
 * - **Enhanced Error Handling**: More detailed error information and callbacks
 * - **Callback-based Sending**: Uses Node.js callback pattern for send operations
 * - **Buffer Support**: Can handle Node.js Buffer objects efficiently
 * - **Process Integration**: Works well with Node.js process lifecycle
 * 
 * ## Use Cases
 * 
 * - **Microservice Communication**: Connect services via WebSocket
 * - **Bot Implementations**: Build chat bots, game bots, etc.
 * - **Server-to-Server**: Real-time communication between servers
 * - **CLI Applications**: Interactive command-line tools with live updates
 * - **Backend Workers**: Background processes that need real-time updates
 * - **API Gateways**: Proxy and transform WebSocket connections
 * 
 * ## Reconnection Behavior
 * 
 * Identical exponential backoff strategy as BrowserChannel but optimized
 * for server environments with better error reporting and resource cleanup.
 * 
 * @example
 * Basic server usage:
 * ```typescript
 * import { NodeChannel, defineMessage, z } from '@xtr-dev/zodiac';
 * 
 * const channel = new NodeChannel();
 * await channel.connect('ws://management-server:8080');
 * ```
 * 
 * @example
 * Microservice communication:
 * ```typescript
 * const channel = new NodeChannel();
 * channel.setReconnectOptions(50, 1000); // Very resilient
 * await channel.connect('ws://user-service:3001/events');
 * ```
 */
export class NodeChannel extends BaseChannel {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  /**
   * Establishes a WebSocket connection using the Node.js 'ws' library.
   * 
   * Optimized for server environments with enhanced error reporting
   * and automatic reconnection handling.
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
   * // Connect to internal microservice
   * await channel.connect('ws://user-service:3001/websocket');
   * 
   * // Connect with authentication in URL
   * await channel.connect('wss://api.example.com/ws?token=abc123');
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

        this.ws.on('open', () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          resolve();
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          this.isConnected = false;
          
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => {
              this.reconnectAttempts++;
              this.connect(url).catch(() => {});
            }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
          }
        });

        this.ws.on('error', (error: Error) => {
          reject(error);
        });

        this.ws.on('message', (data: WebSocket.RawData) => {
          this.handleMessage(data.toString());
        });
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
        this.ws!.removeListener('close', handleClose);
        resolve();
      };

      this.ws!.on('close', handleClose);
      this.ws!.close();
    });
  }

  async send<T>(id: MessageId, data: T): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const serialized = this.validateAndSerialize(id, data);
    
    return new Promise((resolve, reject) => {
      this.ws!.send(serialized, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Configures automatic reconnection behavior for Node.js environments.
   * 
   * Particularly useful for microservices and server applications that
   * need high reliability and resilience to network issues.
   * 
   * @param maxAttempts - Maximum number of reconnection attempts (default: 5)
   * @param baseDelay - Initial delay in milliseconds (default: 1000)
   * 
   * @example
   * ```typescript
   * // High-reliability microservice configuration
   * channel.setReconnectOptions(100, 500);
   * 
   * // Development environment (quick failure)
   * channel.setReconnectOptions(3, 1000);
   * 
   * // Critical service (very persistent)
   * channel.setReconnectOptions(1000, 2000);
   * ```
   */
  setReconnectOptions(maxAttempts: number, baseDelay: number): void {
    this.maxReconnectAttempts = maxAttempts;
    this.reconnectDelay = baseDelay;
  }
}