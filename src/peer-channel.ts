import { BaseChannel } from './base-channel.js';
import { MessageId } from './types.js';

/**
 * @category Configuration
 * Configuration options for WebRTC peer channels.
 */
export interface PeerChannelConfig {
  /** ICE servers for NAT traversal (STUN/TURN servers) */
  iceServers?: RTCIceServer[];
  /** Configuration for the WebRTC data channel */
  dataChannelConfig?: RTCDataChannelInit;
  /** Timeout in milliseconds for establishing connection (default: 30000) */
  connectionTimeout?: number;
}

/**
 * @category Configuration
 * Message structure for WebRTC signaling between peers.
 * These messages need to be exchanged through your signaling mechanism.
 */
export interface SignalingMessage {
  /** Type of signaling message */
  type: 'offer' | 'answer' | 'ice-candidate';
  /** The WebRTC signaling data (offer, answer, or ICE candidate) */
  data: RTCSessionDescriptionInit | RTCIceCandidate;
  /** ID of the peer sending this message */
  from: string;
  /** ID of the peer that should receive this message */
  to: string;
}

/**
 * @category Channels
 * WebRTC peer-to-peer data channel implementation for direct browser-to-browser communication.
 * 
 * Enables direct messaging between browsers without requiring a server after the initial
 * connection setup. Uses WebRTC data channels for reliable, ordered messaging with the
 * same type-safe API as WebSocket channels.
 * 
 * ## Overview
 * 
 * WebRTC requires a "signaling" phase where peers exchange connection information before
 * they can communicate directly. This class handles the WebRTC connection management,
 * but you need to provide the signaling transport (WebSocket, Socket.IO, Firebase, etc.).
 * 
 * ```mermaid
 * sequenceDiagram
 *     participant A as Peer A
 *     participant S as Signaling Server
 *     participant B as Peer B
 *     
 *     A->>S: Offer
 *     S->>B: Offer
 *     B->>S: Answer
 *     S->>A: Answer
 *     A->>S: ICE Candidate
 *     S->>B: ICE Candidate
 *     B->>S: ICE Candidate
 *     S->>A: ICE Candidate
 *     
 *     Note over A,B: Direct P2P Connection Established
 *     A->>B: Type-safe messages
 *     B->>A: Type-safe messages
 * ```
 * 
 * @example
 * Basic peer-to-peer setup:
 * ```typescript
 * import { PeerChannel, defineMessage, z } from '@xtr-dev/zodiac';
 * 
 * // Define message types
 * const chatMessage = defineMessage('chat', z.object({
 *   text: z.string(),
 *   sender: z.string()
 * }));
 * 
 * // Create peer channel
 * const channel = new PeerChannel('peer-1', {
 *   iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
 * });
 * 
 * // Set up signaling (you provide this transport)
 * channel.setSignalingHandler((message) => {
 *   signalingSocket.emit('webrtc-signal', message);
 * });
 * 
 * // Listen for messages
 * channel.on(chatMessage, (data) => {
 *   console.log(`${data.sender}: ${data.text}`);
 * });
 * 
 * // Create offer to connect to another peer
 * const offer = await channel.createOffer('peer-2');
 * signalingSocket.emit('webrtc-signal', { 
 *   ...offer, 
 *   type: 'offer', 
 *   to: 'peer-2' 
 * });
 * ```
 * 
 * @example
 * Handle incoming signaling messages:
 * ```typescript
 * signalingSocket.on('webrtc-signal', async (message) => {
 *   if (message.type === 'offer') {
 *     const answer = await channel.handleOffer(message.data, message.from);
 *     signalingSocket.emit('webrtc-signal', {
 *       ...answer,
 *       type: 'answer',
 *       to: message.from
 *     });
 *   } else if (message.type === 'answer') {
 *     await channel.handleAnswer(message.data);
 *   } else if (message.type === 'ice-candidate') {
 *     await channel.handleIceCandidate(message.data);
 *   }
 * });
 * ```
 * 
 * ## Benefits of WebRTC P2P
 * - **Lower Latency**: Direct connection eliminates server round-trip
 * - **Reduced Server Load**: No message forwarding through servers
 * - **Privacy**: Messages don't pass through third-party servers
 * - **Scalability**: Server only handles initial signaling
 * - **Offline Capability**: Works on local networks without internet
 */
export class PeerChannel extends BaseChannel {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private config: PeerChannelConfig;
  private peerId: string;
  private remotePeerId: string | null = null;
  private signalingHandler: ((message: SignalingMessage) => void) | null = null;
  private connectionTimeout?: NodeJS.Timeout;
  private pendingIceCandidates: RTCIceCandidate[] = [];

  /**
   * Creates a new WebRTC peer channel.
   * 
   * @param peerId - Unique identifier for this peer
   * @param config - Optional configuration for WebRTC connection
   */
  constructor(peerId: string, config: PeerChannelConfig = {}) {
    super();
    this.peerId = peerId;
    this.config = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      dataChannelConfig: { ordered: true },
      connectionTimeout: 30000,
      ...config
    };
  }

  /**
   * Sets the signaling handler for exchanging WebRTC signaling messages.
   * This should connect to your signaling mechanism (WebSocket, Socket.IO, etc.)
   * 
   * The handler will be called whenever this peer needs to send signaling
   * messages to remote peers during connection establishment.
   * 
   * @param handler - Function to handle outgoing signaling messages
   * 
   * @example
   * ```typescript
   * channel.setSignalingHandler((message) => {
   *   // Send via your signaling transport
   *   signalingSocket.emit('webrtc-signal', message);
   * });
   * ```
   */
  setSignalingHandler(handler: (message: SignalingMessage) => void): void {
    this.signalingHandler = handler;
  }

  /**
   * Creates a WebRTC offer to initiate connection with a remote peer.
   * Call this method when you want to start a connection to another peer.
   * 
   * @param remotePeerId - The ID of the peer you want to connect to
   * @returns A WebRTC offer that should be sent to the remote peer via signaling
   * 
   * @example
   * ```typescript
   * const offer = await channel.createOffer('remote-peer-id');
   * signalingSocket.emit('offer', { offer, to: 'remote-peer-id' });
   * ```
   */
  async createOffer(remotePeerId: string): Promise<RTCSessionDescriptionInit> {
    this.remotePeerId = remotePeerId;
    await this.initializePeerConnection();
    
    // Create data channel as offerer
    this.dataChannel = this.peerConnection!.createDataChannel('zodiac-messages', this.config.dataChannelConfig);
    this.setupDataChannelHandlers();

    const offer = await this.peerConnection!.createOffer();
    await this.peerConnection!.setLocalDescription(offer);
    
    this.startConnectionTimeout();
    return offer;
  }

  /**
   * Handles an incoming WebRTC offer and creates an answer.
   * Call this when you receive an offer from another peer via signaling.
   * 
   * @param offer - The WebRTC offer received from remote peer
   * @param fromPeerId - The ID of the peer sending the offer
   * @returns A WebRTC answer that should be sent back to the offering peer
   * 
   * @example
   * ```typescript
   * signalingSocket.on('offer', async ({offer, from}) => {
   *   const answer = await channel.handleOffer(offer, from);
   *   signalingSocket.emit('answer', { answer, to: from });
   * });
   * ```
   */
  async handleOffer(offer: RTCSessionDescriptionInit, fromPeerId: string): Promise<RTCSessionDescriptionInit> {
    this.remotePeerId = fromPeerId;
    await this.initializePeerConnection();
    
    await this.peerConnection!.setRemoteDescription(offer);
    
    // Process any pending ICE candidates
    for (const candidate of this.pendingIceCandidates) {
      await this.peerConnection!.addIceCandidate(candidate);
    }
    this.pendingIceCandidates = [];
    
    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);
    
    this.startConnectionTimeout();
    return answer;
  }

  /**
   * Handles an incoming WebRTC answer from a remote peer.
   * Call this when you receive an answer to your offer via signaling.
   * 
   * @param answer - The WebRTC answer received from remote peer
   * 
   * @example
   * ```typescript
   * signalingSocket.on('answer', async ({answer}) => {
   *   await channel.handleAnswer(answer);
   * });
   * ```
   */
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('No peer connection available to handle answer');
    }
    
    await this.peerConnection.setRemoteDescription(answer);
    
    // Process any pending ICE candidates
    for (const candidate of this.pendingIceCandidates) {
      await this.peerConnection.addIceCandidate(candidate);
    }
    this.pendingIceCandidates = [];
  }

  /**
   * Handles an incoming ICE candidate from a remote peer.
   * ICE candidates are exchanged during connection establishment
   * to find the best network path between peers.
   * 
   * @param candidate - The ICE candidate received from remote peer
   * 
   * @example
   * ```typescript
   * signalingSocket.on('ice-candidate', async ({candidate}) => {
   *   await channel.handleIceCandidate(candidate);
   * });
   * ```
   */
  async handleIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('No peer connection available to handle ICE candidate');
    }
    
    if (this.peerConnection.remoteDescription) {
      await this.peerConnection.addIceCandidate(candidate);
    } else {
      // Queue ICE candidates until remote description is set
      this.pendingIceCandidates.push(candidate);
    }
  }

  async connect(): Promise<void> {
    throw new Error('Use createOffer() or handleOffer() to establish peer connection');
  }

  async disconnect(): Promise<void> {
    this.clearConnectionTimeout();
    
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    this.isConnected = false;
    this.remotePeerId = null;
  }

  async send<T>(id: MessageId, data: T): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel is not open');
    }

    const serialized = this.validateAndSerialize(id, data);
    this.dataChannel.send(serialized);
  }

  private async initializePeerConnection(): Promise<void> {
    if (this.peerConnection) {
      return;
    }

    this.peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers
    });

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.signalingHandler && this.remotePeerId) {
        this.signalingHandler({
          type: 'ice-candidate',
          data: event.candidate,
          from: this.peerId,
          to: this.remotePeerId
        });
      }
    };

    // Handle incoming data channel (for answerer)
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannelHandlers();
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      
      if (state === 'connected') {
        this.clearConnectionTimeout();
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        this.isConnected = false;
        this.clearConnectionTimeout();
      }
    };
  }

  private setupDataChannelHandlers(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      this.isConnected = true;
      this.clearConnectionTimeout();
    };

    this.dataChannel.onclose = () => {
      this.isConnected = false;
    };

    this.dataChannel.onerror = (event) => {
      console.error('Data channel error:', event);
      this.isConnected = false;
    };

    this.dataChannel.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  private startConnectionTimeout(): void {
    if (this.config.connectionTimeout) {
      this.connectionTimeout = setTimeout(() => {
        if (!this.isConnected) {
          this.disconnect();
        }
      }, this.config.connectionTimeout);
    }
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = undefined;
    }
  }

  /**
   * Get the peer ID of this channel
   */
  getPeerId(): string {
    return this.peerId;
  }

  /**
   * Get the peer ID of the remote peer (if connected)
   */
  getRemotePeerId(): string | null {
    return this.remotePeerId;
  }

  /**
   * Get the current WebRTC connection state
   */
  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  /**
   * Get the current data channel state
   */
  getDataChannelState(): RTCDataChannelState | null {
    return this.dataChannel?.readyState || null;
  }
}