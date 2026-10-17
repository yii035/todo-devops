import { useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import api from '../services/api';
import './ChatbotWidget.css';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: string[];
}

interface ChatResponse {
  success: boolean;
  data: {
    answer: string;
    sources: string[];
  };
}

const suggestions = [
  'Tôi có thể quản lý những gì trên FinTrack?',
  'Ngân sách được tính như thế nào?',
  'Làm sao để xuất báo cáo?',
];
const maxMessages = 40;

function readHistory(storageKey: string): ChatMessage[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is ChatMessage =>
      typeof item === 'object' && item !== null &&
      (item.role === 'user' || item.role === 'assistant') &&
      typeof item.text === 'string',
    ).slice(-maxMessages);
  } catch {
    return [];
  }
}

export default function ChatbotWidget({ sessionId }: { sessionId: string }) {
  const storageKey = `fintrack-chat-${sessionId}`;
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => readHistory(storageKey));
  const [question, setQuestion] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEnd = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-maxMessages)));
  }, [messages, storageKey]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSending]);

  useEffect(() => {
    if (isOpen) input.current?.focus();
  }, [isOpen]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setQuestion('');
    setError('');
    setMessages((current) => [...current, { role: 'user', text: trimmed }].slice(-maxMessages));
    setIsSending(true);
    try {
      const response = await api.post<ChatResponse>('/chat', { message: trimmed });
      setMessages((current) => [
        ...current,
        { role: 'assistant', text: response.data.data.answer, sources: response.data.data.sources },
      ].slice(-maxMessages));
    } catch (requestError) {
      const responseMessage = typeof requestError === 'object' && requestError !== null &&
        'response' in requestError && typeof requestError.response === 'object' && requestError.response !== null &&
        'data' in requestError.response && typeof requestError.response.data === 'object' &&
        requestError.response.data !== null && 'message' in requestError.response.data &&
        typeof requestError.response.data.message === 'string'
        ? requestError.response.data.message
        : 'Không thể kết nối chatbot. Vui lòng kiểm tra mạng và thử lại.';
      setError(responseMessage);
    } finally {
      setIsSending(false);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setError('');
    sessionStorage.removeItem(storageKey);
  };

  return (
    <div className="fintrack-chatbot">
      <section
        className={`fintrack-chat-panel${isOpen ? ' is-open' : ''}`}
        aria-label="Chatbot FinTrack"
        aria-hidden={!isOpen}
      >
        <header className="fintrack-chat-header">
          <div className="fintrack-chat-avatar"><Bot size={20} /></div>
          <div className="fintrack-chat-heading">
            <strong>Trợ lý FinTrack</strong>
            <span><i /> Hỗ trợ tính năng dự án</span>
          </div>
          <button className="fintrack-chat-icon-button" type="button" aria-label="Xóa lịch sử chat" title="Xóa cuộc trò chuyện" onClick={clearConversation} disabled={isSending}>
            <RotateCcw size={17} />
          </button>
          <button className="fintrack-chat-icon-button" type="button" aria-label="Đóng chatbot" onClick={() => setIsOpen(false)}>
            <X size={19} />
          </button>
        </header>

        <div className="fintrack-chat-messages" aria-live="polite" aria-relevant="additions text">
          {messages.length === 0 ? (
            <div className="fintrack-chat-welcome">
              <div className="fintrack-chat-welcome-icon"><Sparkles size={20} /></div>
              <h2>Xin chào! Mình có thể giúp gì?</h2>
              <p>Mình chỉ trả lời dựa trên chức năng và tài liệu đã xác minh của FinTrack.</p>
              <div className="fintrack-chat-suggestions">
                {suggestions.map((suggestion) => (
                  <button key={suggestion} type="button" disabled={isSending} onClick={() => void sendMessage(suggestion)}>
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="fintrack-chat-thread">
              {messages.map((message, index) => (
                <div key={`${index}-${message.role}`} className={`fintrack-chat-row ${message.role}`}>
                  {message.role === 'assistant' && <span className="fintrack-chat-mini-avatar"><Bot size={14} /></span>}
                  <div className={`fintrack-chat-bubble ${message.role}`}>
                    <p>{message.text}</p>
                    {message.sources && message.sources.length > 0 && (
                      <span className="fintrack-chat-sources">Nguồn: {message.sources.join(', ')}</span>
                    )}
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="fintrack-chat-row assistant">
                  <span className="fintrack-chat-mini-avatar"><Bot size={14} /></span>
                  <div className="fintrack-chat-bubble assistant fintrack-chat-typing" aria-label="Đang trả lời">
                    <span /><span /><span />
                  </div>
                </div>
              )}
              <div ref={messagesEnd} />
            </div>
          )}
        </div>

        {error && <p className="fintrack-chat-error" role="alert">{error}</p>}
        <form
          className="fintrack-chat-form"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(question);
          }}
        >
          <input
            ref={input}
            aria-label="Nhập câu hỏi"
            placeholder="Hỏi về FinTrack..."
            maxLength={1000}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={isSending}
          />
          <button type="submit" aria-label="Gửi câu hỏi" disabled={!question.trim() || isSending}>
            <Send size={17} />
          </button>
        </form>
        <p className="fintrack-chat-disclaimer">Không nhập mật khẩu, token hoặc thông tin bí mật.</p>
      </section>

      {!isOpen && (
        <button className="fintrack-chat-launcher" type="button" aria-label="Mở chatbot FinTrack" onClick={() => setIsOpen(true)}>
          <MessageCircle size={25} />
          <span className="fintrack-chat-launcher-dot" />
        </button>
      )}
    </div>
  );
}
