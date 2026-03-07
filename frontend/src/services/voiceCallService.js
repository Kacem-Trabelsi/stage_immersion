class VoiceCallService {
  constructor() {
    const apiHost = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');
    this.baseURL = `${apiHost}/api`;
    this.socket = null;
    this.localStream = null;
    this.remoteStream = null;
    this.peerConnection = null;
    this.currentCall = null;
    this.callHandlers = {
      onIncomingCall: null,
      onCallInitiated: null,
      onCallAccepted: null,
      onCallRejected: null,
      onCallEnded: null,
      onCallError: null
    };
  }

  getCurrentUserId() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return '';
      const payload = JSON.parse(atob(token.split('.')[1]));
      return String(payload?.userId || payload?._id || payload?.id || '');
    } catch {
      return '';
    }
  }

  resolveUserId(user) {
    if (!user) return '';
    if (typeof user === 'string') return user;
    return String(user._id || user.id || user.userId || '');
  }

  getRemoteUserIdFromCurrentCall() {
    if (!this.currentCall) return '';
    const myId = this.getCurrentUserId();
    const callerId = this.resolveUserId(this.currentCall.callerId);
    const receiverId = this.resolveUserId(this.currentCall.receiverId);
    if (myId && myId === callerId) return receiverId;
    if (myId && myId === receiverId) return callerId;
    return receiverId || callerId || '';
  }

  // Initialize socket connection
  initializeSocket(socket) {
    this.socket = socket;
    this.setupSocketListeners();
  }

  // Setup socket event listeners
  setupSocketListeners() {
    if (!this.socket) return;

    // Avoid duplicate listeners when reconnecting/re-initializing
    this.socket.off('incoming_call');
    this.socket.off('call_initiated');
    this.socket.off('call_accepted');
    this.socket.off('call_rejected');
    this.socket.off('call_ended');
    this.socket.off('call_error');
    this.socket.off('call_offer');
    this.socket.off('call_answer');
    this.socket.off('ice_candidate');

    this.socket.on('incoming_call', (data) => {
      console.log('Incoming call received:', data);
      this.currentCall = data.call;
      if (this.callHandlers.onIncomingCall) {
        this.callHandlers.onIncomingCall(data.call);
      }
    });

    this.socket.on('call_initiated', (data) => {
      console.log('Call initiated:', data);
      this.currentCall = data.call;
      if (this.callHandlers.onCallInitiated) {
        this.callHandlers.onCallInitiated(data.call);
      }
    });

    this.socket.on('call_accepted', (data) => {
      this.currentCall = data.call;
      const myId = this.getCurrentUserId();
      const callerId = this.resolveUserId(data?.call?.callerId);
      // Only caller should create offer after call is accepted
      if (myId && callerId && myId === callerId) {
        this.setupWebRTC()
          .then(() => this.createOffer())
          .catch((e) => {
            console.error('Error starting WebRTC as caller:', e);
            if (this.callHandlers.onCallError) {
              this.callHandlers.onCallError('Failed to start audio stream');
            }
          });
      }
      if (this.callHandlers.onCallAccepted) {
        this.callHandlers.onCallAccepted(data.call);
      }
    });

    this.socket.on('call_rejected', (data) => {
      this.currentCall = null;
      if (this.callHandlers.onCallRejected) {
        this.callHandlers.onCallRejected(data.call);
      }
    });

    this.socket.on('call_ended', (data) => {
      this.currentCall = null;
      this.cleanupCall();
      if (this.callHandlers.onCallEnded) {
        this.callHandlers.onCallEnded(data.call);
      }
    });

    this.socket.on('call_error', (data) => {
      if (this.callHandlers.onCallError) {
        this.callHandlers.onCallError(data.error);
      }
    });

    // WebRTC signaling events
    this.socket.on('call_offer', (data) => {
      this.handleCallOffer(data);
    });

    this.socket.on('call_answer', (data) => {
      this.handleCallAnswer(data);
    });

    this.socket.on('ice_candidate', (data) => {
      this.handleIceCandidate(data);
    });
  }

  // Set event handlers
  setCallHandlers(handlers) {
    this.callHandlers = { ...this.callHandlers, ...handlers };
  }

  // Initiate a voice call
  async initiateCall(conversationId, receiverId, callType = 'voice') {
    try {
      if (!this.socket) {
        throw new Error('Socket not connected');
      }

      // Check if user is already in a call
      if (this.currentCall) {
        throw new Error('You are already in a call');
      }

      // Clean up any stale calls before initiating new one
      try {
        await this.cleanupStaleCalls();
      } catch (cleanupError) {
        console.warn('Failed to cleanup stale calls:', cleanupError);
        // Continue with call initiation even if cleanup fails
      }

      // Emit call initiation event
      this.socket.emit('initiate_call', {
        conversationId,
        receiverId,
        callType
      });

      return true;
    } catch (error) {
      console.error('Error initiating call:', error);
      throw error;
    }
  }

  // Accept a call
  async acceptCall(callId) {
    try {
      console.log('Accepting call with ID:', callId);
      
      if (!this.socket) {
        throw new Error('Socket not connected');
      }

      this.socket.emit('accept_call', { callId });
      console.log('Accept call event emitted');
      
      // Start WebRTC setup
      await this.setupWebRTC();
      
      return true;
    } catch (error) {
      console.error('Error accepting call:', error);
      throw error;
    }
  }

  // Reject a call
  async rejectCall(callId) {
    try {
      if (!this.socket) {
        throw new Error('Socket not connected');
      }

      this.socket.emit('reject_call', { callId });
      this.currentCall = null;
      
      return true;
    } catch (error) {
      console.error('Error rejecting call:', error);
      throw error;
    }
  }

  // End a call
  async endCall(callId, reason = 'normal') {
    try {
      if (!this.socket) {
        throw new Error('Socket not connected');
      }

      this.socket.emit('end_call', { callId, reason });
      
      // Don't clean up immediately - wait for call_ended event from server
      // This ensures both parties get notified properly
      
      return true;
    } catch (error) {
      console.error('Error ending call:', error);
      throw error;
    }
  }

  // Setup WebRTC connection
  async setupWebRTC() {
    try {
      console.log('Setting up WebRTC connection...');
      
      // Get user media with better error handling
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      console.log('Local stream obtained:', this.localStream);

      // Create peer connection with better configuration
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
      };

      this.peerConnection = new RTCPeerConnection(configuration);

      // Add local stream to peer connection
      this.localStream.getTracks().forEach(track => {
        console.log('Adding track to peer connection:', track.kind);
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Handle remote stream
      this.peerConnection.ontrack = (event) => {
        console.log('Remote stream received:', event.streams[0]);
        this.remoteStream = event.streams[0];
        
        // Notify handlers about remote stream
        if (this.callHandlers.onRemoteStream) {
          this.callHandlers.onRemoteStream(this.remoteStream);
        }
        
        // Auto-play remote audio
        if (this.remoteStream) {
          const audioElement = document.querySelector('audio[data-remote]');
          if (audioElement) {
            audioElement.srcObject = this.remoteStream;
            audioElement.play().catch(e => console.error('Error playing remote audio:', e));
          }
        }
      };

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.socket) {
          const targetUserId = this.getRemoteUserIdFromCurrentCall();
          if (!targetUserId) return;
          console.log('Sending ICE candidate');
          this.socket.emit('ice_candidate', {
            callId: this.currentCall._id,
            candidate: event.candidate,
            targetUserId
          });
        }
      };

      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        console.log('WebRTC Connection state:', this.peerConnection.connectionState);
        if (this.callHandlers.onConnectionStateChange) {
          this.callHandlers.onConnectionStateChange(this.peerConnection.connectionState);
        }
      };

      // Handle ICE connection state changes
      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE Connection state:', this.peerConnection.iceConnectionState);
      };

      console.log('WebRTC setup completed successfully');

    } catch (error) {
      console.error('Error setting up WebRTC:', error);
      throw error;
    }
  }

  // Handle incoming call offer
  async handleCallOffer(data) {
    try {
      if (!this.peerConnection) {
        await this.setupWebRTC();
      }

      await this.peerConnection.setRemoteDescription(data.offer);
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // Send answer back to caller
      this.socket.emit('call_answer', {
        callId: data.callId,
        answer: answer,
        callerId: data.callerId
      });

    } catch (error) {
      console.error('Error handling call offer:', error);
    }
  }

  // Handle call answer
  async handleCallAnswer(data) {
    try {
      if (this.peerConnection) {
        await this.peerConnection.setRemoteDescription(data.answer);
      }
    } catch (error) {
      console.error('Error handling call answer:', error);
    }
  }

  // Handle ICE candidate
  async handleIceCandidate(data) {
    try {
      if (this.peerConnection && data.candidate) {
        await this.peerConnection.addIceCandidate(data.candidate);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  // Create offer for outgoing call
  async createOffer() {
    try {
      if (!this.peerConnection) {
        await this.setupWebRTC();
      }

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Send offer to receiver
      this.socket.emit('call_offer', {
        callId: this.currentCall._id,
        offer: offer,
        receiverId: this.getRemoteUserIdFromCurrentCall()
      });

    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  // Mute/unmute microphone
  toggleMute() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return !audioTrack.enabled;
      }
    }
    return false;
  }

  // Toggle speaker
  toggleSpeaker() {
    // This would typically involve changing audio output device
    // Implementation depends on browser support
    console.log('Speaker toggle not implemented');
  }

  // Get call history
  async getCallHistory(page = 1, limit = 20, conversationId = null) {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      
      if (conversationId) {
        params.append('conversationId', conversationId);
      }

      const response = await fetch(`${this.baseURL}/voice-calls/history?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch call history');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching call history:', error);
      throw error;
    }
  }

  // Get active calls
  async getActiveCalls() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${this.baseURL}/voice-calls/active`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch active calls');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching active calls:', error);
      throw error;
    }
  }

  // Cleanup call resources
  cleanupCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }

  // Check if user is in a call
  isInCall() {
    return this.currentCall !== null;
  }

  // Get current call
  getCurrentCall() {
    return this.currentCall;
  }

  // Clean up stale calls
  async cleanupStaleCalls() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${this.baseURL}/voice-calls/cleanup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to cleanup stale calls');
      }

      const result = await response.json();
      console.log('Cleaned up stale calls:', result.data.modifiedCount);
      return result.data;
    } catch (error) {
      console.error('Error cleaning up stale calls:', error);
      throw error;
    }
  }

  // Disconnect and cleanup
  disconnect() {
    this.cleanupCall();
    this.currentCall = null;
    this.socket = null;
  }
}

export default new VoiceCallService();
