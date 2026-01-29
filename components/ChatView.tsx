
import React, { useRef, useEffect, useMemo, useState } from 'react';
import { ChatNode, Message } from '../types';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { vs } from 'react-syntax-highlighter/dist/esm/styles/hljs';

interface ChatViewProps {
  history: ChatNode[]; 
  onSendMessage: (text: string, files: File[]) => void;
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
  const [files, setFiles] = useState<File[]>([]); // New state for files
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // New ref for file input

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isGenerating]);


  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  console.log('🔍 handleFileSelect called!', e.target.files?.length, 'files');
  if (e.target.files && e.target.files.length > 0) {
    const newFiles = Array.from(e.target.files); // ✅ Capture files FIRST
    setFiles((prev) => {
      console.log('📦 Previous files:', prev.length, 'Adding:', newFiles.length);
      return [...prev, ...newFiles];
    });
    // Reset AFTER, with setTimeout
    setTimeout(() => {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }, 0);
  }
};

  // ADD THIS FUNCTION:
  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() && files.length === 0 || isGenerating) return;
    onSendMessage(input, files);
    setInput('');
    setFiles([]);

    setTimeout(() => {
    const textarea = document.querySelector('textarea');
    if (textarea) {
      textarea.style.height = 'auto';
    }
  }, 0);
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
        <div className={`max-w-[85%] px-5 py-3 rounded-3xl relative transition-all duration-300 ${msg.role === 'user' ? 'bg-zinc-800/60 text-white rounded-tr-none border border-zinc-700/30' : 'bg-transparent text-zinc-200 rounded-tl-none border-none pl-0'}`}>                <ReactMarkdown components={{
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
                  p: ({node, ...props}) => <p className=" text-zinc-300 leading-relaxed" {...props} />,
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
              <svg className="w-6 h-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
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

          <div className={`flex flex-col gap-0 bg-zinc-800/40 border rounded-3xl p-0.7 transition-all shadow-inner ${isBranching ? 'border-blue-500/50 rounded-t-none ring-2 ring-blue-500/10' : 'border-zinc-700/50 focus-within:border-zinc-500 focus-within:bg-zinc-800/60'}`}>
           
           {files.length > 0 && (
            <div className="w-full flex gap-2 px-4 pt-4 overflow-x-auto custom-scrollbar">
              {files.map((file, i) => (
                <div key={i} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 border border-zinc-700 shrink-0">
                  <span className="truncate max-w-[150px]">{file.name}</span>
                  <button 
                    type="button"
                    onClick={() => removeFile(i)}
                    className="hover:text-red-400 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
           
           <form onSubmit={handleSubmit} className="w-full flex-1 flex items-center gap-3 px-2 py-2">
              
              <input 
                type="file" 
                multiple 
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileSelect}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isGenerating}
                className="p-4 text-zinc-400 hover:text-blue-400 hover:bg-zinc-800/50 rounded-full transition-all disabled:opacity-50"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder={isBranching ? "What happens in this new timeline?" : "Continue the conversation..."}
                className="flex-1 bg-transparent border-none px-0 py-4 text-base font-medium focus:outline-none placeholder:text-zinc-600 text-white resize-none overflow-y-auto custom-scrollbar"
                style={{
                  minHeight: '56px',
                  maxHeight: 'calc(1.5em * 7 + 2rem)',
                  height: 'auto'
                }}
                rows={1}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, parseFloat(getComputedStyle(target).maxHeight)) + 'px';
                }}
              />
              <button 
                type="submit" 
                disabled={(!input.trim() && files.length === 0) || isGenerating} 
                className={`p-4 rounded-full transition-all shadow-lg${(!input.trim() && files.length === 0) || isGenerating ? 'bg-zinc-700 text-zinc-500 opacity-50' : (isBranching ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-[#0084ff] hover:bg-[#0073e6] text-white')} hover:scale-[1.02] active:scale-[0.98]`}
              >
                {isGenerating ? (
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  /* Fatter Icon */
                  <svg className="w-5 h-5 " viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );

};