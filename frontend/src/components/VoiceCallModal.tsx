import React, { useState, useEffect, useRef } from 'react';
import { Modal } from 'react-bootstrap';
import VoiceCallService from '../services/voiceCallService';

interface VoiceCallModalProps {
  show: boolean;
  onHide: () => void;
  call: {
    _id: string;
    callerId: {
      _id: string;
      firstName: string;
      lastName: string;
      avatar?: string;
    };
    receiverId: {
      _id: string;
      firstName: string;
      lastName: string;
      avatar?: string;
    };
    status: 'initiated' | 'ringing' | 'accepted' | 'rejected' | 'ended' | 'missed';
    callType: 'voice' | 'video';
    startedAt: string;
  };
  currentUserId: string;
  onAccept: (callId: string) => void;
  onReject: (callId: string) => void;
  onEnd: (callId: string) => void;
}

const VoiceCallModal: React.FC<VoiceCallModalProps> = ({
  show,
  onHide,
  call,
  currentUserId,
  onAccept,
  onReject,
  onEnd
}) => {
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [callQuality, setCallQuality] = useState<'excellent' | 'good' | 'fair' | 'poor'>('good');
  
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Try to get currentUserId from localStorage if not provided
  const getCurrentUserId = () => {
    if (currentUserId && currentUserId.trim() !== '') {
      return currentUserId;
    }
    
    // Fallback: try to get from localStorage
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.userId || payload._id || payload.id;
      } catch (e) {
        console.error('Error parsing token:', e);
      }
    }
    
    return null;
  };

  const actualCurrentUserId = getCurrentUserId();
  const isCaller = call.callerId._id === actualCurrentUserId;
  const isReceiver = call.receiverId._id === actualCurrentUserId;
  const otherUser = isCaller ? call.receiverId : call.callerId;

  // Debug logging
  console.log('VoiceCallModal Debug:', {
    callId: call._id,
    callStatus: call.status,
    originalCurrentUserId: currentUserId,
    actualCurrentUserId: actualCurrentUserId,
    callerId: call.callerId._id,
    receiverId: call.receiverId._id,
    isCaller,
    isReceiver,
    shouldShowAcceptButton: isReceiver && (call.status === 'initiated' || call.status === 'ringing')
  });

  useEffect(() => {
    if (call.status === 'accepted' && durationInterval.current === null) {
      const startTime = new Date(call.startedAt).getTime();
      durationInterval.current = setInterval(() => {
        const now = new Date().getTime();
        setCallDuration(Math.floor((now - startTime) / 1000));
      }, 1000);
      
      // Initialize audio when call is accepted
      initializeAudio();
    }

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
    };
  }, [call.status, call.startedAt]);

  // Initialize audio streams
  const initializeAudio = async () => {
    try {
      console.log('Initializing audio for call...');
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      });
      
      console.log('Microphone access granted');
      
      // Set up local audio
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
        localAudioRef.current.muted = true; // Mute local audio to prevent echo
        console.log('Local audio stream set up');
      }
      
      // Set up remote audio (will be set when remote stream is received)
      if (remoteAudioRef.current) {
        remoteAudioRef.current.muted = false;
        console.log('Remote audio element ready');
      }
      
    } catch (error) {
      console.error('Error initializing audio:', error);
      // Show error in console - the parent component can handle user notification
      console.error('Microphone access denied. Please check browser permissions.');
    }
  };

  useEffect(() => {
    if (call.status === 'ended' || call.status === 'rejected') {
      // Clean up audio streams
      cleanupAudio();
      onHide();
    }
  }, [call.status, onHide]);

  // Clean up audio streams
  const cleanupAudio = () => {
    if (localAudioRef.current && localAudioRef.current.srcObject) {
      const stream = localAudioRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      localAudioRef.current.srcObject = null;
    }
    
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    
    console.log('Audio streams cleaned up');
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAccept = () => {
    console.log('VoiceCallModal: handleAccept called');
    onAccept(call._id);
  };

  const handleReject = () => {
    console.log('VoiceCallModal: handleReject called');
    onReject(call._id);
    // Close modal immediately when rejecting
    onHide();
  };

  const handleEnd = () => {
    onEnd(call._id);
    // Close the modal immediately for better UX
    onHide();
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    // Implement actual mute functionality
    if (localAudioRef.current) {
      localAudioRef.current.muted = newMutedState;
    }
    
    // Also use VoiceCallService mute functionality
    try {
      VoiceCallService.toggleMute();
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
    
    console.log('Microphone muted:', newMutedState);
  };


  const getStatusText = () => {
    switch (call.status) {
      case 'initiated':
        return isCaller ? 'Appel en cours...' : 'Appel entrant';
      case 'ringing':
        return isCaller ? 'Sonnerie...' : 'Appel entrant';
      case 'accepted':
        return 'Connecté';
      case 'rejected':
        return 'Appel refusé';
      case 'ended':
        return 'Appel terminé';
      case 'missed':
        return 'Appel manqué';
      default:
        return `Statut: ${call.status}`;
    }
  };

  const getStatusColor = () => {
    switch (call.status) {
      case 'initiated':
      case 'ringing':
        return 'text-warning';
      case 'accepted':
        return 'text-success';
      case 'rejected':
      case 'ended':
      case 'missed':
        return 'text-danger';
      default:
        return 'text-muted';
    }
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      backdrop="static"
      keyboard={false}
      className="voice-call-modal"
    >
      <Modal.Body className="text-center p-4">

        {/* User Name */}
        <h4 className="mb-2">
          {otherUser.firstName} {otherUser.lastName}
        </h4>

        {/* Call Status */}
        <p className={`mb-3 ${getStatusColor()}`}>
          {getStatusText()}
        </p>

        {/* Debug Info - Uncomment for debugging */}
        {/* <div className="debug-info mb-3" style={{ fontSize: '0.8rem', color: '#666' }}>
          <div>Status: {call.status}</div>
          <div>isReceiver: {isReceiver ? 'true' : 'false'}</div>
          <div>isCaller: {isCaller ? 'true' : 'false'}</div>
          <div>originalCurrentUserId: {currentUserId || 'EMPTY'}</div>
          <div>actualCurrentUserId: {actualCurrentUserId || 'EMPTY'}</div>
          <div>callerId: {call.callerId._id}</div>
          <div>receiverId: {call.receiverId._id}</div>
        </div> */}

        {/* Call Duration */}
        {call.status === 'accepted' && (
          <p className="text-muted mb-4">
            {formatDuration(callDuration)}
          </p>
        )}

        {/* Call Quality Indicator */}
        {call.status === 'accepted' && (
          <div className="call-quality mb-4">
            <small className="text-muted">
              Quality: <span className={`text-${callQuality === 'excellent' ? 'success' : callQuality === 'good' ? 'primary' : callQuality === 'fair' ? 'warning' : 'danger'}`}>
                {callQuality}
              </span>
            </small>
          </div>
        )}

        {/* Call Controls - SIMPLIFIED LOGIC */}
        <div className="call-controls">
          {/* No circular buttons - only fallback buttons below */}

          {/* FALLBACK BUTTONS - Show for receiver when call is not accepted */}
          {isReceiver && call.status !== 'accepted' && (
            <div className="d-flex justify-content-center gap-3 mt-3">
              <button
                className="btn btn-success btn-lg"
                onClick={handleAccept}
                style={{ 
                  width: '120px', 
                  height: '50px', 
                  fontSize: '1rem',
                  borderRadius: '25px'
                }}
                title="ACCEPTER L'APPEL"
              >
                <i className="ti ti-phone me-2"></i>
                ACCEPTER
              </button>
              <button
                className="btn btn-danger btn-lg"
                onClick={handleReject}
                style={{ 
                  width: '120px', 
                  height: '50px', 
                  fontSize: '1rem',
                  borderRadius: '25px'
                }}
                title="REFUSER L'APPEL"
              >
                <i className="ti ti-phone-off me-2"></i>
                REFUSER
              </button>
            </div>
          )}

          {/* BUTTONS FOR CALLER WHEN CALL IS NOT ACCEPTED */}
          {isCaller && call.status !== 'accepted' && (
            <div className="d-flex justify-content-center gap-3 mt-3">
              <button
                className="btn btn-danger btn-lg"
                onClick={handleEnd}
                style={{ 
                  width: '120px', 
                  height: '50px', 
                  fontSize: '1rem',
                  borderRadius: '25px'
                }}
                title="ANNULER L'APPEL"
              >
                <i className="ti ti-phone-off me-2"></i>
                ANNULER
              </button>
            </div>
          )}

          {/* BUTTONS FOR ACCEPTED CALLS */}
          {call.status === 'accepted' && (
            <div className="d-flex justify-content-center gap-3 mt-3">
              <button
                className={`btn btn-outline-secondary btn-lg ${isMuted ? 'active' : ''}`}
                onClick={toggleMute}
                style={{ 
                  width: '120px', 
                  height: '50px', 
                  fontSize: '1rem',
                  borderRadius: '25px'
                }}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                <i className={`ti ${isMuted ? 'ti-microphone-off' : 'ti-microphone'} me-2`}></i>
                {isMuted ? 'UNMUTE' : 'MUTE'}
              </button>
              <button
                className="btn btn-danger btn-lg"
                onClick={handleEnd}
                style={{ 
                  width: '120px', 
                  height: '50px', 
                  fontSize: '1rem',
                  borderRadius: '25px'
                }}
                title="End Call"
              >
                <i className="ti ti-phone-off me-2"></i>
                END CALL
              </button>
            </div>
          )}
        </div>

        {/* Audio Elements */}
        <audio 
          ref={localAudioRef} 
          autoPlay 
          muted 
          data-local
          style={{ display: 'none' }}
        />
        <audio 
          ref={remoteAudioRef} 
          autoPlay 
          data-remote
          style={{ display: 'none' }}
        />
      </Modal.Body>

      <style>{`
        .voice-call-modal .modal-content {
          border: none;
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }


        .call-controls .btn {
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
          transition: all 0.3s ease;
          border: 2px solid transparent;
          font-size: 1.2rem;
        }

        .call-controls .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
        }

        .call-controls .btn.active {
          background-color: #007bff !important;
          border-color: #007bff !important;
          color: white !important;
        }

        .call-controls .btn-success {
          background-color: #28a745 !important;
          border-color: #28a745 !important;
        }

        .call-controls .btn-danger {
          background-color: #dc3545 !important;
          border-color: #dc3545 !important;
        }

        .call-controls {
          margin-top: 20px;
          padding: 10px;
        }

        .call-quality {
          font-size: 0.9rem;
        }
      `}</style>
    </Modal>
  );
};

export default VoiceCallModal;
