import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ text: string; sender: string }>>([])
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [username, setUsername] = useState('')
  const [room, setRoom] = useState('')
  const [isJoined, setIsJoined] = useState(false)
  const [activeUsers, setActiveUsers] = useState<string[]>([])

  useEffect(() => {
    if (!isJoined) return;

    const ws = new WebSocket('http://localhost:8080')

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
        setMessages(prev => [...prev, { text: data.message, sender: data.username }])
      }
    }

    ws.onclose = () => {
      console.log('Disconnected from WebSocket')
    }

    setSocket(ws)

    return () => {
      ws.close()
    }
  }, [isJoined, room, username])

  const joinRoom = () => {
    if (username && room) {
      setIsJoined(true)
    }
  }

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

  if (!isJoined) {
    return (
      <div className="container">
        <h1>Join Chat Room</h1>
        <div className="join-form">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
          />
          <input
            type="text"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="Enter room number"
          />
          <button onClick={joinRoom}>Join Room</button>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-container">
      <div className="chat-main">
        <div className="chat-header">
          <h1>Room: {room}</h1>
        </div>
        <div className="chat-box">
          {messages.map((msg, index) => (
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
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="input-area">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
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