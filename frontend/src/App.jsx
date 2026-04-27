import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import DarkVeil from './DarkVeil';
import BorderGlow from './BorderGlow';
import GradientText from './GradientText';
import ShinyText from './ShinyText';
import './App.css';

const generateSessionId = () => {
  return 'session_' + Math.random().toString(36).substr(2, 9);
};

const SUGGESTIONS = [
  "What are the latest clinical trials for Type 1 Diabetes?",
  "Find new research papers on Stage 4 Lung Cancer.",
  "Are there any active Alzheimer's trials in California?",
  "What is the current research on Long COVID?"
];

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(generateSessionId());
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // Detect if it's a mobile screen (less than 768px wide)
  const isMobile = window.innerWidth <= 768;
  // Default to closed on mobile, open on desktop
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleNewChat = () => {
    setSessionId(generateSessionId());
    setMessages([]); 
  };

  const sendQuery = async (text) => {
    if (!text.trim()) return;

    const userMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post('https://medical-research-ai.onrender.com/api/research', { 
        query: text,
        sessionId: sessionId 
      });
      
      const aiMessage = { role: 'ai', content: res.data.result };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error fetching data:", error);
      setMessages((prev) => [
        ...prev, 
        { role: 'ai', content: "❌ **Connection Error:** Could not reach the medical research backend." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendQuery(input);
  };

 return (
    <>
      {/* THE WEBGL BACKGROUND LAYER */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }}>
        <DarkVeil
          hueShift={180}
          noiseIntensity={0.10}
          scanlineIntensity={0.5}
          speed={0.8}
          scanlineFrequency={600}
          warpAmount={0.05}
        />
      </div>

      {/* THE FOREGROUND UI */}
      <div className="app-layout" style={{ background: 'transparent', position: 'relative', zIndex: 1 }}>
        <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: '260px' }}>
            <h2>
              <GradientText colors={["#5227FF","#FF9FFC","#B497CF"]} animationSpeed={8} showBorder={false}>  
                Vynav.atom
              </GradientText>
            </h2>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="mobile-close-btn"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/> 
              </svg>
            </button>
          </div>

          <div style={{ marginTop: '20px', minWidth: '260px' }}>
            <button className="new-chat-btn" onClick={() => { handleNewChat(); setIsSidebarOpen(false); }}>
               New Research
            </button>
            <div className="history-list">
              <p className="history-label" style={{ color: 'var(--text-muted)' }}>Current Session</p>
              <p style={{ fontSize: '10px', color: '#888', marginTop: '5px' }}>{sessionId}</p>
            </div>
          </div>
        </aside>

        <main className="main-content" style={{ width: '100%', overflow: 'hidden' }}>
          
          <header className="mobile-header" style={{ display: isMobile ? 'flex' : 'none', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', zIndex: 10 }}>
            <button 
              onClick={() => setIsSidebarOpen(true)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: '0' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6H20M4 12H20M4 18H20"/> 
              </svg>
            </button>
            <h2 style={{ margin: 0 }}>
              <GradientText colors={["#5227FF","#FF9FFC","#B497CF"]} animationSpeed={8} showBorder={false}>  
                Aynav.atom
              </GradientText>
            </h2>
            <div style={{ width: '28px' }}></div> 
          </header>

          <div className="chat-container">
            {messages.length === 0 ? (
              <div className="welcome-screen">
                <h1>
                  <ShinyText 
                    text="Let's talk about medical research!" 
                    speed={2} 
                    delay={0} 
                    color="#b5b5b5" 
                    shineColor="#ffffff" 
                    spread={120} 
                    direction="left" 
                    yoyo={false} 
                    pauseOnHover={false} 
                    disabled={false}
                  />
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>Ask about clinical trials, latest treatments, or specific conditions.</p>
                
                <div className="suggestions-grid">
                  {SUGGESTIONS.map((text, i) => (
                    <div 
                      key={i} 
                      className="suggestion-glow-wrapper" 
                      style={{ animationDelay: `${0.1 * (i + 1)}s` }}
                      onClick={() => sendQuery(text)}
                    >
                      <BorderGlow
                        className="suggestion-glass-card"
                        backgroundColor="var(--glass-bg)" 
                        glowColor="210 100 80" 
                        colors={['#8ab4f8', '#a8c7fa', '#ffffff']} 
                        borderRadius={12}
                        coneSpread={15}
                        edgeSensitivity={20}
                        fillOpacity={0}
                        animated={true}
                      >
                        <div className="suggestion-content">
                          {text}
                        </div>
                      </BorderGlow>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="messages-list">
                {messages.map((msg, index) => (
                  <div key={index} className={`message-wrapper ${msg.role}`}>
                    <div className="message-bubble">
                      {msg.role === 'ai' && <div className="ai-icon">✨</div>}
                      {msg.role === 'user' ? (
                        <div className="message-content">{msg.content}</div>
                      ) : (
                        <div className="message-content">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {loading && (
                  <div className="message-wrapper ai">
                    <div className="message-bubble" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="ai-icon">✨</div>
                      <div className="message-content" style={{ padding: 0 }}>
                        <ShinyText 
                          text="Thinking..." 
                          speed={1.5} 
                          delay={0} 
                          color="#888888" 
                          shineColor="#ffffff" 
                          spread={90} 
                          direction="left" 
                          yoyo={true} 
                          pauseOnHover={false} 
                          disabled={false}
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="input-container">
            <form onSubmit={handleSubmit} className="input-box">
              <textarea 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Ask a medical question..."
                disabled={loading}
                rows={1}
              />
              <button type="submit" disabled={loading || !input.trim()}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" fill="currentColor"/>
                </svg>
              </button>
            </form>
            <p className="disclaimer">Aynav.atom AI is a research assistant prototype. Always verify medical information.</p>
          </div>
        </main>
      </div>
    </>
  );
}

export default App;

