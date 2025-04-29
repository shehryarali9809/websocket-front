import { useEffect, useRef, useState } from 'react';
import './App.css';

interface Message {
  text: string;
  sender: string;
  timestamp?: Date;
}

interface Room {
  _id: string;
  name: string;
  createdBy: string;
  createdAt: Date;
}

interface TypingUser {
  username: string;
  timestamp: number;
}

function App() {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [username, setUsername] = useState('')
  const [room, setRoom] = useState('')
  const [newRoomName, setNewRoomName] = useState('')
  const [isJoined, setIsJoined] = useState(false)
  const [isUsernameEntered, setIsUsernameEntered] = useState(false)
  const [activeUsers, setActiveUsers] = useState<string[]>([])
  const [availableRooms, setAvailableRooms] = useState<Room[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  const chatBoxRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<number | null>(null)

  // Check URL for room and username on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const usernameParam = params.get('username');

    if (usernameParam) {
      setUsername(usernameParam);
      setIsUsernameEntered(true);

      if (roomParam) {
        setRoom(roomParam);
        setIsJoined(true);
      }
    }
  }, []);

  // Update URL when room or username changes
  useEffect(() => {
    if (isJoined && room && username) {
      const url = new URL(window.location.href);
      url.searchParams.set('room', room);
      url.searchParams.set('username', username);
      window.history.pushState({}, '', url.toString());
    }
  }, [isJoined, room, username]);

  // Cleanup typing users who have stopped typing
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => prev.filter(user => now - user.timestamp < 3000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight
    }
  }, [messages, typingUsers])

  // Fetch available rooms when username is entered
  useEffect(() => {
    if (isUsernameEntered) {
      fetchRooms()
    }
  }, [isUsernameEntered])

  const fetchRooms = async () => {
    try {
      setLoading(true)
      const response = await fetch('https://fatal-rozella-sherysdsdasd-1e3911d3.koyeb.app/api/rooms')

      const data = await response.json()
      setAvailableRooms(data)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching rooms:', err)
      setError('Failed to load rooms. Please try again.')
      setLoading(false)
    }
  }

  const createRoom = async () => {
    if (!newRoomName.trim()) {
      setError('Room name cannot be empty')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('https://fatal-rozella-sherysdsdasd-1e3911d3.koyeb.app/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newRoomName,
          username
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create room')
      }

      const data = await response.json()
      setRoom(data.name)
      setNewRoomName('')
      setError('')
      await fetchRooms()
      joinRoom(data.name)
      setLoading(false)
    } catch (err: any) {
      console.error('Error creating room:', err)
      setError(err.message || 'Failed to create room. Please try again.')
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isJoined) return;

    // Close previous connection if exists
    if (socket) {
      socket.close();
    }

    const ws = new WebSocket('https://fatal-rozella-sherysdsdasd-1e3911d3.koyeb.app')

    ws.onopen = () => {
      console.log('Connected to WebSocket')
      ws.send(JSON.stringify({
        type: 'join',
        room,
        username
      }))
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'userList') {
        setActiveUsers(data.users)
      } else if (data.type === 'message') {
        setMessages(prev => [...prev, {
          text: data.message,
          sender: data.username,
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
        }])
      } else if (data.type === 'previousMessages') {
        // Handle previous messages from the server
        if (data.messages && Array.isArray(data.messages)) {
          const formattedMessages = data.messages.map((msg: any) => ({
            text: msg.text,
            sender: msg.sender,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined
          }));
          setMessages(formattedMessages);
        }
      } else if (data.type === 'typing') {
        if (data.username !== username) {
          setTypingUsers(prev => {
            // Remove the user if they're already in the list
            const filtered = prev.filter(user => user.username !== data.username);
            // Add them with the new timestamp
            return [...filtered, { username: data.username, timestamp: Date.now() }];
          });
        }
      } else if (data.type === 'error') {
        setError(data.message)
        setIsJoined(false)
      }
    }

    ws.onclose = () => {
      console.log('Disconnected from WebSocket')
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Connection error. Please try again.');
    }

    setSocket(ws)

    return () => {
      ws.close()
    }
  }, [isJoined, room, username])

  const submitUsername = () => {
    if (username.trim()) {
      setIsUsernameEntered(true)
      setError('')
    } else {
      setError('Username cannot be empty')
    }
  }

  const joinRoom = (roomName: string) => {
    if (username && roomName) {
      setRoom(roomName)
      setIsJoined(true)
      setError('')
    }
  }

  const handleTyping = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      // Only send typing event if we haven't sent one recently
      if (typingTimeoutRef.current === null) {
        socket.send(JSON.stringify({
          type: 'typing',
          room,
          username
        }));

        // Set a timeout to prevent sending too many typing events
        typingTimeoutRef.current = window.setTimeout(() => {
          typingTimeoutRef.current = null;
        }, 2000);
      }
    }
  };

  const sendMessage = () => {
    if (socket && message) {
      const messageData = {
        type: 'message',
        room,
        username,
        message
      }
      socket.send(JSON.stringify(messageData))
      setMessage('')
    }
  }

  // Handle leaving the room
  const leaveRoom = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      // Send leave message to server
      socket.send(JSON.stringify({
        type: 'leave',
        room,
        username
      }));
      socket.close();
    }
    setIsJoined(false);
    setMessages([]);
    setActiveUsers([]);

    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.pushState({}, '', url.toString());
  };

  // Format time to display in messages
  const formatTime = (timestamp?: Date) => {
    if (!timestamp) return '';
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(timestamp);
  }

  // Initial username screen
  if (!isUsernameEntered) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>Welcome to Chat</h1>
            <p>Enter your username to start</p>
          </div>
          <div className="login-form">
            <div className="input-group">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                onKeyPress={(e) => e.key === 'Enter' && submitUsername()}
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            <button
              className="join-button"
              onClick={submitUsername}
              disabled={!username}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Room selection screen
  if (!isJoined) {
    return (
      <div className="login-container">
        <div className="login-card room-selection">
          <div className="login-header">
            <h1>Welcome, {username}</h1>
            <p>Create a new room or join an existing one</p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="room-creation">
            <h2>Create New Room</h2>
            <div className="input-group">
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Enter room name"
                onKeyPress={(e) => e.key === 'Enter' && createRoom()}
              />
              <button
                className="create-room-button"
                onClick={createRoom}
                disabled={!newRoomName || loading}
              >
                {loading ? 'Creating...' : 'Create Room'}
              </button>
            </div>
          </div>

          <div className="room-list-container">
            <div className="room-list-header">
              <h2>Available Rooms</h2>
              <button
                className="refresh-button"
                onClick={fetchRooms}
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {loading ? (
              <div className="loading">Loading rooms...</div>
            ) : availableRooms.length > 0 ? (
              <div className="room-list">
                {availableRooms.map((room) => (
                  <div key={room._id} className="room-item" onClick={() => joinRoom(room.name)}>
                    <div className="room-info">
                      <span className="room-name">{room.name}</span>
                      <span className="room-creator">Created by: {room.createdBy}</span>
                    </div>
                    <button className="join-room-button">Join</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-rooms">
                No rooms available. Create one to get started!
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Chat screen
  return (
    <div className="chat-container">
      <div className="chat-main">
        <div className="chat-header">
          <h1>Room: {room}</h1>
          <button className="leave-room-button" onClick={leaveRoom}>Leave Room</button>
        </div>
        <div className="chat-box" ref={chatBoxRef}>
          {messages.length === 0 ? (
            <div className="no-messages">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`message-wrapper ${msg.sender === username ? 'sent' : 'received'}`}
              >
                <div className="message-content">
                  <div className="sender-avatar">
                    {msg.sender[0].toUpperCase()}
                  </div>
                  <div className="message-bubble">
                    <div className="message-sender">{msg.sender}</div>
                    <div className="message-text">{msg.text}</div>
                    {msg.timestamp && (
                      <div className="message-timestamp">{formatTime(msg.timestamp)}</div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {typingUsers.length > 0 && (
            <div className="typing-indicator">
              {typingUsers.length === 1 ? (
                <p>{typingUsers[0].username} is typing...</p>
              ) : (
                <p>Multiple people are typing...</p>
              )}
            </div>
          )}
        </div>
        <div className="input-area">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleTyping}
            placeholder="Type a message..."
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
      <div className="active-users">
        <h2>Active Users</h2>
        <div className="users-list">
          {activeUsers.map((user, index) => (
            <div key={index} className="user-item">
              <div className="user-avatar">{user[0].toUpperCase()}</div>
              <span>{user}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App