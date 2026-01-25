
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ChatState, ChatNode, Message } from './types';
import { ChatView } from './components/ChatView';
import { NodeView } from './components/NodeView';
import { generateResponse, generateTitle } from './services/geminiService';
import { dbService } from './services/dbService';

interface Conversation {
  id: string;
  nodes: Record<string, ChatNode>;
  rootNodeId: string | null;
  currentNodeId: string | null;
  title: string;
  timestamp: number;
}

const STORAGE_KEY = 'lumina_conversations_v2'; // Bumped version for logic change

const App: React.FC = () => {
  const [conversations, setConversations] = useState<any[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  
  const [workspace, setWorkspace] = useState<ChatState & { branchingFromId: string | null }>({
    nodes: {},
    rootNodeId: null,
    currentNodeId: null,
    viewMode: 'chat',
    branchingFromId: null,
  });

  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const loadSidebar = async () => {
      try {
        const data = await dbService.fetchConversations();
        setConversations(data);
      } catch (err) {
        console.error("Sidebar load failed:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadSidebar();
  }, []);

  const getFullHistoryPath = useCallback((nodeId: string | null): ChatNode[] => {
    if (!nodeId) return [];
    const path: ChatNode[] = [];
    let currentId: string | null = nodeId;
    
    while (currentId && workspace.nodes[currentId]) {
      path.unshift(workspace.nodes[currentId]);
      currentId = workspace.nodes[currentId].parentId;
    }
    return path;
  }, [workspace.nodes]);

  const activeMessages = useMemo(() => {
    // History is the full set of messages in nodes leading up to current
    const path = getFullHistoryPath(workspace.currentNodeId);
    return path.flatMap(node => 
      [...node.messages].sort((a, b) => a.ordinal - b.ordinal)
    );
  }, [workspace.currentNodeId, getFullHistoryPath]);

    const generateHierarchicalLabel = (parentId: string | null, nodes: Record<string, ChatNode>): string => {
    if (!parentId) return "1";
    const parent = nodes[parentId];
    const siblingsCount = parent.childrenIds.length;
    const endsWithLetter = /[a-z]$/.test(parent.hierarchicalID);
    return endsWithLetter ? `${parent.hierarchicalID}.${siblingsCount + 1}` : `${parent.hierarchicalID}.${String.fromCharCode(97 + siblingsCount)}`;
  };

  const generateCoolId = (parentId: string | null, nodes: Record<string, ChatNode>): string => {
    if (!parentId) return "1";
    const parent = nodes[parentId];
    const siblingsCount = parent.childrenIds.length;
    const endsWithLetter = /[a-z]$/.test(parentId);
    return endsWithLetter ? `${parentId}.${siblingsCount + 1}` : `${parentId}.${String.fromCharCode(97 + siblingsCount)}`;
  };

  const handleSelectConversation = async (id: string | null) => {
    setActiveConvId(id);
    setIsSwitching(true);
    // If id is null, we are starting a NEW thread. Reset workspace.
    if (!id) {
      setWorkspace({
        nodes: {},
        rootNodeId: null,
        currentNodeId: null,
        viewMode: 'chat',
        branchingFromId: null,
      });
      setIsSwitching(false);
      return;
    }

    try {
      const nodesMap = await dbService.fetchConversationDetail(id);
      const header = conversations.find(c => c.id === id);

      setWorkspace({
        nodes: nodesMap,
        rootNodeId: header?.root_node_id || null, 
        currentNodeId: header?.current_node_id || null,
        viewMode: 'chat',
        branchingFromId: null,
      });
    } catch (err) {
      console.error("Hydration failed:", err);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (isGenerating || !text.trim()) return;

    setIsGenerating(true);
    let currentConvId = activeConvId;
    let targetNodeId: string;
    
    const isNewConversation = !currentConvId;
    const isBranching = !!workspace.branchingFromId;

    try {
      // --- STEP 1: CONVERSATION LAYER ---
      if (isNewConversation) {
        const newConv = await dbService.createConversation("New Discussion");
        currentConvId = newConv.id;
        setActiveConvId(currentConvId);
      }

      // --- STEP 2: NODE LAYER ---
      if (isNewConversation || isBranching) {
      const parentId = isBranching ? workspace.branchingFromId : (isNewConversation ? null : workspace.currentNodeId);
      const hLabel = generateHierarchicalLabel(parentId, workspace.nodes);

      // A. Create the Node in the DB
      const newNodePromise = dbService.createNode({
        conversations_id: currentConvId!,
        parent_id: parentId,
        hierarchical_id: hLabel,
        is_branch: isBranching,
        title: '...'
      });

      // B. OPTIMISTIC UPDATE: Add the node to the UI immediately
      // We use a temporary ID or a predicted one so the Map shows it NOW
      const tempNodeId = `temp_${Date.now()}`; 
      
      setWorkspace(prev => ({
        ...prev,
        nodes: {
          ...prev.nodes,
          [tempNodeId]: {
            id: tempNodeId,
            hierarchicalID: hLabel,
            parentId: parentId,
            messages: [{ role: 'user', content: text, timestamp: Date.now(), ordinal: 0 }],
            title: '...',
            timestamp: Date.now(),
            childrenIds: [],
            isBranch: isBranching
          }
        },
        currentNodeId: tempNodeId,
        branchingFromId: null // Clear the branching state so the UI resets
      }));

      const newNode = await newNodePromise;
      targetNodeId = newNode.id;
      // After the await, the "Final Step" at the end of the function 
      // will replace the temp node with the real DB node.
    } else {
      targetNodeId = workspace.currentNodeId!;
    }

      // --- STEP 3: USER MESSAGE ---
      const currentMessages = workspace.nodes[targetNodeId]?.messages || [];
      const userMsg: Message = { 
        role: 'user', 
        content: text, 
        timestamp: Date.now(), 
        ordinal: currentMessages.length 
      };

      await dbService.createMessage({
        nodes_id: targetNodeId,
        role: 'user',
        content: text,
        ordinal: userMsg.ordinal
      });

      // --- STEP 3.5: OPTIMISTIC UI UPDATE (See message immediately) ---
      setWorkspace(prev => {
        const updatedNode = {
          ...(prev.nodes[targetNodeId] || {
            id: targetNodeId,
            hierarchicalID: generateHierarchicalLabel(isBranching ? workspace.branchingFromId : null, prev.nodes),
            parentId: isBranching ? workspace.branchingFromId : (isNewConversation ? null : prev.currentNodeId),
            title: '...',
            timestamp: Date.now(),
            childrenIds: [],
            isBranch: isBranching,
          }),
          messages: [...(prev.nodes[targetNodeId]?.messages || []), userMsg]
        };

        return {
          ...prev,
          nodes: { ...prev.nodes, [targetNodeId]: updatedNode },
          currentNodeId: targetNodeId,
          rootNodeId: prev.rootNodeId || targetNodeId,
          branchingFromId: null
        };
      });

      // --- STEP 4: DB STATE SYNC (Pointers) ---
      if (isNewConversation) {
        await dbService.updateConversationState(currentConvId!, {
          root_node_id: targetNodeId,
          current_node_id: targetNodeId
        });
      } else if (isBranching) {
        await dbService.updateConversationState(currentConvId!, {
          current_node_id: targetNodeId
        });
      }

      // --- STEP 5: AI GENERATION ---
      const historyPath = getFullHistoryPath(targetNodeId);
      const aiContext = historyPath.flatMap(n => n.messages).map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      const responseText = await generateResponse(text, aiContext);
      
      const aiMsg: Message = { 
        role: 'model', 
        content: responseText, 
        timestamp: Date.now(), 
        ordinal: userMsg.ordinal + 1 
      };

      await dbService.createMessage({
        nodes_id: targetNodeId,
        role: 'model',
        content: responseText,
        ordinal: aiMsg.ordinal
      });

      // --- STEP 6: TITLE & METADATA ---
      if (isNewConversation || isBranching) {
        const llmTitle = await generateTitle(text, responseText);
        await dbService.updateNodeTitle(targetNodeId, llmTitle);
        if (isNewConversation) {
          await dbService.updateConversationState(currentConvId!, { title: llmTitle });
        }
      }

      // --- FINAL STEP: REFRESH ALL ---
      const sidebarData = await dbService.fetchConversations();
      setConversations(sidebarData);
      
      const finalNodes = await dbService.fetchConversationDetail(currentConvId!);
      setWorkspace(prev => ({
        ...prev,
        nodes: finalNodes,
      }));

    } catch (err) {
      console.error("Critical Message Failure:", err);
      alert("Database connection lost.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearAll = () => {
    if (confirm("Purge all topological data from local storage?")) {
      setConversations([]);
      setActiveConvId(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const currentTitle = useMemo(() => {
    const node = workspace.currentNodeId ? workspace.nodes[workspace.currentNodeId] : null;
    return node?.title && node.title !== '...' ? node.title : "Lumina Session";
  }, [workspace.nodes, workspace.currentNodeId]);

  return (
    <div className="flex h-screen w-screen bg-[#020203] text-zinc-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[300px] bg-[#050505] border-r border-zinc-900 flex flex-col z-[110] shadow-2xl">
        <div className="p-6">
          <button 
            onClick={() => handleSelectConversation(null)}
            className="w-full flex items-center justify-center gap-3 py-4 bg-zinc-900 border border-zinc-800 hover:border-blue-500 hover:bg-zinc-800 rounded-2xl transition-all group active:scale-95 shadow-lg"
          >
            <div className="p-1 bg-blue-600/20 rounded-md">
              <svg className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-300">New Thread</span>
          </button>
        </div>

        <div className="px-6 mb-4 flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Archived Nodes</p>
          {conversations.length > 0 && (
            <button onClick={handleClearAll} className="text-[9px] font-bold text-zinc-700 hover:text-red-500 transition-colors uppercase tracking-widest">Wipe Memory</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-2">
          {conversations.length === 0 && (
            <div className="px-3 py-20 text-center opacity-10">
              <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              <p className="text-[10px] font-bold uppercase tracking-widest">No active protocols</p>
            </div>
          )}
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => handleSelectConversation(conv.id)}
              className={`w-full text-left px-5 py-5 rounded-2xl transition-all border group relative ${activeConvId === conv.id ? 'bg-blue-600/10 border-blue-500/30 text-white shadow-inner ring-1 ring-blue-500/20' : 'bg-transparent border-transparent text-zinc-200 hover:bg-zinc-900 hover:text-zinc-300'}`}
            >
              <h3 className="text-[13px] font-bold truncate pr-4 leading-tight mb-1.5">{conv.title}</h3>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-mono opacity-40 uppercase tracking-tighter bg-zinc-800 px-1 rounded">V-{conv.id.substring(0, 4)}</span>
                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                <span className="text-[8px] font-mono opacity-40 uppercase tracking-tighter">{new Date(conv.created_at).toLocaleDateString()}</span>
              </div>
              {activeConvId === conv.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,1)]" />
              )}
            </button>
          ))}
        </div>

        <div className="p-6 border-t border-zinc-900 bg-zinc-950/50">
           <div className="flex items-center gap-3 opacity-40 grayscale group hover:grayscale-0 transition-all cursor-default">
              
           </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-black">
        <header className="z-[100] h-20 bg-transparent px-10 flex items-center justify-between absolute top-0 left-0 right-0 pointer-events-none">
          <div className="flex items-center gap-4 pointer-events-auto">
            <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center shadow-2xl">
               <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-[13px] font-black tracking-[0.4em] uppercase text-white">LUMINA</h1>
              <p className="text-[8px] font-bold tracking-[0.2em] uppercase text-zinc-600">Topological Brancher v2.0</p>
            </div>
          </div>

          <div className="flex items-center gap-4 pointer-events-auto">
            <button
              onClick={() => setWorkspace(p => ({ ...p, viewMode: p.viewMode === 'chat' ? 'node' : 'chat' }))}
              className={`flex items-center gap-3 px-8 py-3.5 rounded-2xl transition-all duration-500 border shadow-2xl backdrop-blur-md ${workspace.viewMode === 'chat' ? 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-white' : 'bg-blue-600 border-blue-500 text-white shadow-[0_0_40px_rgba(37,99,235,0.4)]'}`}
            >
              <div className={`w-2 h-2 rounded-full ${workspace.viewMode === 'chat' ? 'bg-zinc-700' : 'bg-white animate-pulse'}`} />
              <span className="text-[11px] font-black uppercase tracking-[0.2em]">
                {workspace.viewMode === 'chat' ? 'Map Overview' : 'Chat View'}
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 relative overflow-hidden flex items-center justify-center">
  {isSwitching && (
    <div className="absolute inset-0 z-[150] bg-black/20 backdrop-blur-xl flex flex-col items-center justify-center transition-all duration-500">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-t-2 border-blue-500 animate-spin" />
        <div className="absolute inset-0 m-auto w-8 h-8 bg-blue-500/20 rounded-full animate-pulse flex items-center justify-center">
           <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,1)]" />
        </div>
      </div>
      
    </div>
  )}
          <div className={`absolute inset-0 transition-all duration-170 ease-in-out ${workspace.viewMode === 'chat' ? 'blur-3xl grayscale opacity-10 scale-105 pointer-events-none' : 'opacity-100 scale-100'}`}>
            <NodeView 
              nodes={workspace.nodes} 
              rootNodeId={workspace.rootNodeId} 
              currentNodeId={workspace.currentNodeId} 
              viewMode={workspace.viewMode}
              onSelectNode={(id) => setWorkspace(prev => ({ ...prev, currentNodeId: id, branchingFromId: null, viewMode: 'chat' }))}
              onBranchNode={(id) => setWorkspace(p => ({ ...p, branchingFromId: id, currentNodeId: id, viewMode: 'chat' }))}
            />
          </div>

          <div 
            className={`relative z-50 w-full h-full flex items-center justify-center transition-all duration-[850ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${workspace.viewMode === 'chat' ? 'chat-layer-enter scale-100 opacity-100 translate-y-0' : 'chat-layer-exit scale-[0.95] opacity-0 translate-y-24 pointer-events-none'}`}
          >
            <ChatView 
              history={getFullHistoryPath(workspace.currentNodeId)} 
              onSendMessage={handleSendMessage} 
              onBranch={(id) => setWorkspace(p => ({ ...p, branchingFromId: id, viewMode: 'chat' }))}
              isGenerating={isGenerating}
              isBranching={!!workspace.branchingFromId}
              onCancelBranch={() => setWorkspace(prev => ({ ...prev, branchingFromId: null }))}
              currentNodeId={workspace.currentNodeId}
              currentTitle={currentTitle}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;