import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, Loader2, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, Language } from '../../../types';
import { getConstants } from '../constants';
import { getTranslations } from '../../../locales';

interface AIChatbotProps {
  currentLang: Language;
}

export const AIChatbot: React.FC<AIChatbotProps> = ({ currentLang }) => {
  const [isOpen, setIsOpen] = useState(false);
  const t = getTranslations(currentLang).indicators.chat;
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      role: 'model',
      text: t.welcome,
      timestamp: new Date()
    }
  ]);
  
  useEffect(() => {
      if (messages.length === 1 && messages[0].id === 'init') {
          setMessages([{
              id: 'init',
              role: 'model',
              text: t.welcome,
              timestamp: new Date()
          }]);
      }
  }, [currentLang, t.welcome]);

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const N8N_WEBHOOK_URL = 'https://n8n.centralcrypto.com.br/webhook/chat'; 
  const MAX_QUESTIONS = 3;
  const BOT_AVATAR_URL = 'https://centralcrypto.com.br/scripts/avatarbitcoio.png';

  const { indicators } = getConstants(currentLang);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    if (questionCount >= MAX_QUESTIONS) {
        setTimeout(() => {
            const limitMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: 'Para maiores informações entre em contato diretamente pelo TradingView, na página do indicador: https://www.tradingview.com/u/Central_CryptoTraders/#published-scripts',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, limitMsg]);
            setIsLoading(false);
        }, 800);
        return;
    }

    setQuestionCount(prev => prev + 1);

    try {
      const productContext = indicators.map(i => 
        `Indicador: ${i.title}, Tipo: ${i.price}, Tags: ${i.tags.join(', ')}, Descrição: ${i.description}`
      ).join('\n');

      const langInstruction = currentLang === 'pt' ? 'Português do Brasil' : currentLang === 'en' ? 'English' : 'Español';

      const systemInstruction = `
        Você é o "Bitcóio AI", um assistente técnico especializado em trading e Pine Script para a "Central Crypto".
        
        IDIOMA DA RESPOSTA: ${langInstruction}
        
        Dados dos Scripts Disponíveis:
        ${productContext}
        
        Diretrizes:
        1. Seja técnico mas amigável.
        2. Se o usuário quiser baixar, mande clicar em "Abrir no TradingView".
        3. Responda APENAS no idioma solicitado (${langInstruction}).
        4. Responda de forma curta e direta (máximo 3 frases).
      `;

      const response = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({
              message: inputText,
              systemContext: systemInstruction
          })
      });

      if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
      }

      const data = await response.json();
      const botResponseText = data.output || data.text || data.message || JSON.stringify(data);

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: typeof botResponseText === 'string' ? botResponseText : "Recebi uma resposta em formato desconhecido.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMsg]);

    } catch (error) {
      console.error("Erro ao chamar N8N:", error);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: t.error,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSendMessage();
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 bg-tv-accent hover:bg-amber-600 text-white p-0 rounded-full shadow-lg shadow-amber-900/20 transition-transform transform hover:scale-110 overflow-hidden ${isOpen ? 'hidden' : 'flex'}`}
        aria-label="Chat de Suporte"
      >
        <img src={BOT_AVATAR_URL} alt="Bitcóio AI" className="w-16 h-16 object-cover bg-white" />
      </button>

      <div className={`fixed bottom-6 right-6 z-50 w-full max-w-sm bg-white dark:bg-tv-card border border-gray-300 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`} style={{ height: '500px' }}>
        
        <div className="bg-tv-light-bg dark:bg-tv-bg p-4 border-b border-gray-300 dark:border-gray-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center overflow-hidden border border-tv-accent/20">
              <img src={BOT_AVATAR_URL} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">Bitcóio AI</h3>
              <span className="text-xs text-green-600 dark:text-green-400 flex items-center">
                <span className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full mr-1 animate-pulse"></span>
                Online
              </span>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900/50">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                msg.role === 'user' 
                  ? 'bg-tv-accent text-white rounded-br-none' 
                  : 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-bl-none'
              }`}>
                <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                    <ReactMarkdown
                        components={{
                            a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="underline font-bold hover:opacity-80 text-inherit" />
                        }}
                    >
                        {msg.text}
                    </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
             <div className="flex justify-start">
               <div className="bg-gray-200 dark:bg-gray-800 p-3 rounded-2xl rounded-bl-none flex items-center gap-2">
                 <Loader2 className="w-4 h-4 animate-spin text-gray-500 dark:text-gray-400" />
                 <span className="text-xs text-gray-500 dark:text-gray-400">{t.typing}</span>
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-tv-light-bg dark:bg-tv-bg border-t border-gray-300 dark:border-gray-700">
          {questionCount >= MAX_QUESTIONS ? (
              <div className="text-center text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded border border-yellow-500/20">
                 <div className="flex items-center justify-center gap-1 text-yellow-600 dark:text-yellow-500 mb-1 font-bold">
                    <AlertTriangle className="w-3 h-3" />
                    {t.limitTitle}
                 </div>
                 {t.limit}
              </div>
          ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={t.placeholder}
                  className="flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-tv-accent"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={isLoading}
                  className="bg-tv-accent hover:bg-amber-600 text-white p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
          )}
        </div>
      </div>
    </>
  );
};