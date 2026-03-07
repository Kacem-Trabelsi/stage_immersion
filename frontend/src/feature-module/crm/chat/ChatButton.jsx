import React from 'react';

const ChatButton = ({ user, currentUser, token, onChatOpen }) => {
  const handleChatClick = () => {
    if (onChatOpen) {
      onChatOpen(user);
    }
  };

  // Don't show chat button for self
  if (!user || !currentUser || user._id === currentUser._id) {
    return null;
  }

  return (
    <button
      className="btn btn-outline-primary btn-sm d-flex align-items-center"
      onClick={handleChatClick}
      title={`Start chat with ${user.firstName} ${user.lastName}`}
    >
      <i className="ti ti-message-circle me-1"></i>
      Chat
    </button>
  );
};

export default ChatButton;
