import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<string[]>([])
  const [socket, setSocket] = useState<WebSocket | null>(null)

  useEffect(() => {
    // Create WebSocket connection
    const ws = new WebSocket('ws://localhost:8080')

    ws.onopen = () => {
      console.log('Connected to WebSocket')
    }

    ws.onmessage = (event) => {
      setMessages(prev => [...prev, event.data])
    }

    ws.onclose = () => {
      console.log('Disconnected from WebSocket')
    }

    setSocket(ws)

    return () => {
      ws.close()
    }
  }, [])

  const sendMessage = () => {
    if (socket && message) {
      socket.send(message)
      setMessage('')
    }
  }

  return (
    <div className="container">
      <h1>WebSocket Chat</h1>
      <div className="chat-box">
        {messages.map((msg, index) => (
          <div key={index} className="message" style={{color:"black"}}>
            {msg}
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
  )
}

export default App
