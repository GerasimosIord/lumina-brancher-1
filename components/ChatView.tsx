
import React, { useRef, useEffect } from 'react';
import { ChatNode, Message } from '../types';

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
  currentTitle
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
    <div className="w-full max-w-4xl h-[85vh] flex flex-col bg-[#1e1e1e] rounded-[2rem] border border-zinc-800/50 shadow-[0_32px_128px_-12px_rgba(0,0,0,0.8)] overflow-hidden">
      {/* Header */}
      <div className="px-10 py-8 flex items-end justify-between border-b border-zinc-800/50">
        <h2 className="text-4xl font-extrabold text-white tracking-tight leading-none truncate max-w-[70%]">
          {history.length === 0 ? "New Chat" : currentTitle}
        </h2>
        {currentNodeId && (
          <div className="flex flex-col items-end">
             <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1">Current Branch</span>
             <span className="text-xs font-mono text-zinc-400 bg-zinc-900 px-2 py-1 rounded-md">{currentNodeId}</span>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-10 pt-8 pb-12 space-y-8">
        {allMessages.length === 0 && !isGenerating && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-4">
             <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800">
               <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
               </svg>
             </div>
             <p className="text-lg font-medium tracking-wide">Enter a prompt to start this thread.</p>
          </div>
        )}

        {allMessages.map(({ msg, nodeId, isLastInNode }, idx) => (
          <div key={`${nodeId}-${idx}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-2 duration-500`}>
            <div className={`
              max-w-[85%] p-6 rounded-3xl relative transition-all duration-300
              ${msg.role === 'user' 
                ? 'bg-zinc-800/60 text-white rounded-tr-none border border-zinc-700/30' 
                : 'bg-transparent text-zinc-200 rounded-tl-none border-l-2 border-zinc-800 pl-8 hover:border-zinc-600'}
            `}>
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap font-medium">{msg.content}</p>
              
              {msg.role === 'model' && (
                <div className="absolute -right-14 top-4 opacity-0 group-hover:opacity-100 transition-all flex flex-col gap-2">
                  <button
                    onClick={() => onBranch(nodeId)}
                    className="p-2.5 bg-zinc-800 hover:bg-blue-600 rounded-xl border border-zinc-700 shadow-xl active:scale-90 group/btn"
                    title="Branch from here"
                  >
                    <svg className="w-4 h-4 text-white group-hover/btn:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              )}

              {msg.role === 'user' && (
                <div className="absolute -left-8 bottom-2">
                   <div className={`w-1 h-1 rounded-full ${nodeId === currentNodeId ? 'bg-blue-500' : 'bg-zinc-800'}`} />
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isGenerating && (
           <div className="flex justify-start">
            <div className="bg-transparent border-l-2 border-blue-500/30 pl-8 py-2">
              <div className="flex gap-1.5 items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-8 bg-[#1e1e1e] border-t border-zinc-800/30">
        {isBranching && (
          <div className="flex items-center justify-between px-6 py-3 bg-blue-600/10 border border-blue-500/30 text-blue-400 rounded-t-2xl mb-[-1px] mx-2 animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-widest">Branching Protocol Initialized</span>
               <span className="text-[9px] opacity-60 font-mono">Forking from {currentNodeId}</span>
            </div>
            <button onClick={onCancelBranch} className="text-[9px] font-black uppercase hover:text-white transition-colors flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3} /></svg>
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
            <button
              type="submit"
              disabled={!input.trim() || isGenerating}
              className={`
                px-8 py-4 rounded-xl transition-all font-black text-xs uppercase tracking-widest shadow-lg
                ${!input.trim() || isGenerating 
                  ? 'bg-zinc-700 text-zinc-500 opacity-50' 
                  : (isBranching ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-[#0084ff] hover:bg-[#0073e6] text-white')}
                hover:scale-[1.02] active:scale-[0.98] ring-4 ring-blue-500/10
              `}
            >
              {isGenerating ? 'Thinking' : (isBranching ? 'Branch' : 'Send')}
            </button>
          </form>
        </div>
        <div className="mt-4 flex justify-center">
           <button 
             onClick={() => onBranch(currentNodeId!)} 
             disabled={isBranching || !currentNodeId}
             className="text-[9px] font-black text-zinc-600 hover:text-blue-500 uppercase tracking-[0.2em] transition-all flex items-center gap-2 disabled:opacity-0"
           >
             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
             Create New Branch From Current Path
           </button>
        </div>
      </div>
    </div>
  );
};