
import React, { useRef, useEffect, useMemo } from 'react';
import { ChatNode, Message } from '../types';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { vs } from 'react-syntax-highlighter/dist/esm/styles/hljs';

interface ChatViewProps {
  history: ChatNode[]; 
  onSendMessage: (text: string) => void;
  onBranch: (nodeId: string) => void;
  isGenerating: boolean;
  isBranching?: boolean;
  onCancelBranch?: () => void;
  currentNodeId: string | null;
  currentTitle?: string;
}

export const ChatView: React.FC<ChatViewProps> = ({ 
  history, 
  onSendMessage, 
  onBranch, 
  isGenerating,
  isBranching,
  onCancelBranch,
  currentNodeId,
  currentTitle,
}) => {
  const [input, setInput] = React.useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isGenerating]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    onSendMessage(input);
    setInput('');
  };

  const currentHierarchicalId = useMemo(() => {
    if (history.length === 0) return null;
    return history[history.length - 1].hierarchicalID;
  }, [history]);

  // Flatten messages from the history nodes
  const allMessages: { msg: Message, nodeId: string, isLastInNode: boolean }[] = [];
  history.forEach((node) => {
    node.messages.forEach((msg, idx) => {
      allMessages.push({ 
        msg, 
        nodeId: node.id, 
        isLastInNode: idx === node.messages.length - 1 
      });
    });
  });

  return (
    <div className="w-full h-full flex flex-col bg-transparent overflow-hidden pt-20 relative">
      
      {/* CENTERED EMPTY STATE */}
      {allMessages.length === 0 && !isGenerating && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700 gap-4 pointer-events-none z-0">
          <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800">
            <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-lg font-medium tracking-wide">Enter a prompt to start this chat.</p>
        </div>
      )}

      {/* SCROLLABLE MESSAGE AREA */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
        <div className="max-w-3xl mx-auto px-6 pt-8 pb-12 space-y-8">
          {allMessages.map(({ msg, nodeId }, idx) => (
            <div key={`${nodeId}-${idx}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-2 duration-500`}>
              <div className={`max-w-[85%] p-6 rounded-3xl relative transition-all duration-300 ${msg.role === 'user' ? 'bg-zinc-800/60 text-white rounded-tr-none border border-zinc-700/30' : 'bg-transparent text-zinc-200 rounded-tl-none border-none pl-0'}`}>
                <ReactMarkdown components={{
                  code: ({node, inline, className, children, ...props}: any) => {
                    const match = /language-(\w+)/.exec(className || '');
                    if (inline) return <code className="bg-zinc-800 text-blue-400 px-2 py-1 rounded text-sm font-mono" {...props}>{children}</code>;
                    return match ? (
                      <div className="bg-blue-5000/12 rounded-lg my-4 p-4 border border-blue-90/50">
                        <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" className="rounded-lg my-4" {...props}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter>
                      </div>
                    ) : (
                      <code className="block bg-zinc-900 text-zinc-100 p-4 rounded-lg overflow-x-auto font-mono text-sm mb-4 border border-zinc-800" {...props}>{children}</code>
                    );
                  },
                  h1: ({node, ...props}) => <h1 className="text-2xl font-bold mb-4 text-white" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-xl font-bold mb-3 text-white" {...props} />,
                  p: ({node, ...props}) => <p className="mb-4 text-zinc-300 leading-relaxed" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc list-inside mb-4 space-y-2 text-zinc-300" {...props} />,
                  li: ({node, ...props}) => <li className="text-zinc-300" {...props} />,
                  strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />,
                  a: ({node, ...props}) => <a className="text-blue-400 hover:text-blue-300 underline" {...props} />,
                }}>
                  {msg.content}
                </ReactMarkdown>
                {msg.role === 'model' && (
                  <div className="absolute -right-14 top-4 opacity-0 group-hover:opacity-100 transition-all flex flex-col gap-2">
                    <button onClick={() => onBranch(nodeId)} className="p-2.5 bg-zinc-800 hover:bg-blue-600 rounded-xl border border-zinc-700 shadow-xl active:scale-90 group/btn" title="Branch from here">
                      <svg className="w-4 h-4 text-white group-hover/btn:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isGenerating && (
            <div className="flex justify-start pl-8 py-2">
              <div className="flex gap-1.5 items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full bg-gradient-to-t from-black via-black/80 to-transparent pb-10 pt-6">
        <div className="max-w-3xl mx-auto px-6">
          {isBranching && (
            <div className="flex items-center justify-between px-6 py-3 bg-blue-600/10 border border-blue-500/30 text-blue-400 rounded-t-2xl mb-[-1px] mx-2 animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">Creating new branch</span>
              </div>
              <button onClick={onCancelBranch} className="text-[9px] font-black uppercase hover:text-white transition-colors flex items-center gap-1">
                Dismiss
              </button>
            </div>
          )}

          <div className={`flex items-center gap-3 bg-zinc-800/40 border rounded-2xl p-2 transition-all shadow-inner ${isBranching ? 'border-blue-500/50 rounded-t-none ring-2 ring-blue-500/10' : 'border-zinc-700/50 focus-within:border-zinc-500 focus-within:bg-zinc-800/60'}`}>
            <form onSubmit={handleSubmit} className="flex-1 flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isBranching ? "What happens in this new timeline?" : "Continue the conversation..."}
                className="flex-1 bg-transparent border-none px-5 py-4 text-base font-medium focus:outline-none placeholder:text-zinc-600 text-white"
              />
              <button type="submit" disabled={!input.trim() || isGenerating} className={`px-8 py-4 rounded-xl transition-all font-black text-xs uppercase tracking-widest shadow-lg ${!input.trim() || isGenerating ? 'bg-zinc-700 text-zinc-500 opacity-50' : (isBranching ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-[#0084ff] hover:bg-[#0073e6] text-white')} hover:scale-[1.02] active:scale-[0.98]`}>
                {isGenerating ? 'Thinking' : (isBranching ? 'Branch' : 'Send')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );

};