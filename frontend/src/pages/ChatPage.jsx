import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { chatAPI } from '../services/api';
import ReactMarkdown from 'react-markdown';
import { Send, ArrowLeft, Loader2, Bot, User, BookOpen, ChevronDown, ChevronUp, FileText, Sparkles, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

function SourceCard({ source, idx }) {
  const [open, setOpen] = useState(false);
  const pct = Math.round((source.relevance_score||0)*100);
  return (
    <div className="card-static p-3 cursor-pointer text-sm transition-all" onClick={()=>setOpen(!open)} style={{borderColor:open?'rgba(34,211,238,0.25)':undefined}}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0" style={{background:'rgba(34,211,238,0.08)',color:'var(--cyan)'}}>{idx+1}</div>
          <span className="text-xs" style={{color:'var(--text-light)'}}>Source {idx+1}</span>
          <span className="pill pill-emerald">{pct}%</span>
        </div>
        {open?<ChevronUp size={12} style={{color:'var(--text-dim)'}}/>:<ChevronDown size={12} style={{color:'var(--text-dim)'}}/>}
      </div>
      {open&&<p className="mt-2 text-xs leading-relaxed p-2.5 rounded-lg" style={{color:'var(--text-dim)',background:'rgba(0,0,0,0.3)'}}>{source.chunk_content}</p>}
    </div>
  );
}

export default function ChatPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [conv, setConv] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(()=>{(async()=>{try{const{data}=await chatAPI.getConversation(id);setConv(data);setMsgs(data.messages||[]);}catch{toast.error('Not found');nav('/');}finally{setLoading(false);}})();},[id,nav]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'});},[msgs]);

  const handleSend = async (e) => {
    e.preventDefault();
    const txt = input.trim();
    if (!txt||sending) return;
    setInput(''); setSending(true);
    const tmp = {id:'tmp-'+Date.now(),role:'user',content:txt,created_at:new Date().toISOString()};
    setMsgs(p=>[...p,tmp]);
    try {
      const{data}=await chatAPI.ask(id,{message:txt});
      setMsgs(p=>{const f=p.filter(m=>m.id!==tmp.id);return[...f,data.user_message,data.assistant_message];});
      if(conv?.title==='New Conversation') setConv(p=>({...p,title:txt.slice(0,80)}));
    } catch(err) {
      toast.error(err.response?.data?.error||'Failed to get answer',{duration:5000});
      setMsgs(p=>p.filter(m=>m.id!==tmp.id)); setInput(txt);
    } finally { setSending(false); inputRef.current?.focus(); }
  };

  const suggestions = ["Summarize the key points","What are the main findings?","Explain the methodology","List important definitions","What conclusions were drawn?","Compare different approaches"];

  if (loading) return (<div className="min-h-screen flex items-center justify-center" style={{background:'var(--bg-void)'}}><div className="text-center anim-fade-scale"><div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{background:'var(--grad-vivid)'}}><Sparkles size={24} className="text-white"/></div><p className="text-gradient-vivid font-medium">Loading...</p></div></div>);

  return (
    <div className="h-screen flex flex-col relative" style={{background:'var(--bg-void)'}}>
      <div className="ambient-bg"><div className="orb orb-a"/><div className="orb orb-b"/></div>
      <div className="grid-bg"/>

      {/* Header */}
      <header className="shrink-0 h-14 px-4 md:px-6 flex items-center gap-3 relative z-10" style={{background:'rgba(2,1,8,0.85)',backdropFilter:'blur(30px)',borderBottom:'1px solid var(--border-dim)'}}>
        <button onClick={()=>nav('/')} className="btn-icon" style={{color:'var(--text-light)'}}><ArrowLeft size={18}/></button>
        <div className="w-px h-6" style={{background:'var(--border-dim)'}}/>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate" style={{color:'var(--text-white)'}}>{conv?.title||'Chat'}</h1>
          <p className="text-[11px] flex items-center gap-1" style={{color:'var(--text-dim)'}}><FileText size={10}/>{(conv?.documents?.length||0) + (conv?.websites?.length||0)} source{((conv?.documents?.length||0) + (conv?.websites?.length||0)) !== 1 ? 's' : ''}</p>
        </div>
        <div className="pill pill-violet"><Zap size={9}/> RAG</div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 relative z-10">
        <div className="max-w-3xl mx-auto space-y-5">
          {msgs.length===0&&(
            <div className="text-center py-14 anim-fade-up">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-6" style={{background:'var(--grad-vivid)',boxShadow:'var(--glow-lg)'}}><Sparkles size={32} className="text-white"/></div>
              <h2 className="text-xl font-bold mb-2 text-gradient">Ask anything about your sources</h2>
              <p className="text-sm mb-8 max-w-md mx-auto" style={{color:'var(--text-dim)'}}>I'll search your documents and websites to give accurate answers with source citations.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-lg mx-auto">
                {suggestions.map((q,i)=>(<button key={i} onClick={()=>{setInput(q);inputRef.current?.focus();}} className="card-static p-3 text-left text-xs hover:border-[var(--border-glow)] transition-all" style={{color:'var(--text-light)'}}><span style={{color:'var(--violet)'}}>&#8594; </span>{q}</button>))}
              </div>
            </div>
          )}

          {msgs.map((m,i)=>(
            <div key={m.id} className={`flex gap-3 anim-fade-up ${m.role==='user'?'justify-end':'justify-start'}`} style={{animationDelay:`${Math.min(i*30,300)}ms`}}>
              {m.role==='assistant'&&<div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-0.5" style={{background:'var(--grad-vivid)'}}><Bot size={14} className="text-white"/></div>}
              <div className="max-w-[80%]">
                <div className="rounded-2xl px-4 py-3" style={m.role==='user'?{background:'var(--grad-vivid)',color:'white',borderBottomRightRadius:'6px'}:{background:'var(--bg-elevated)',border:'1px solid var(--border-default)',borderBottomLeftRadius:'6px'}}>
                  {m.role==='assistant'?<div className="md"><ReactMarkdown>{m.content}</ReactMarkdown></div>:<p className="text-sm leading-relaxed">{m.content}</p>}
                </div>
                {m.sources&&m.sources.length>0&&(
                  <div className="mt-2 space-y-1.5">
                    <p className="text-[11px] font-semibold flex items-center gap-1 ml-1 uppercase tracking-wider" style={{color:'var(--cyan)'}}><BookOpen size={11}/> {m.sources.length} Source{m.sources.length>1?'s':''}</p>
                    {m.sources.map((s,j)=><SourceCard key={j} source={s} idx={j}/>)}
                  </div>
                )}
                <p className="text-[10px] mt-1.5 ml-1" style={{color:'var(--text-faint)'}}>{new Date(m.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</p>
              </div>
              {m.role==='user'&&<div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-0.5" style={{background:'var(--bg-elevated)',border:'1px solid var(--border-dim)'}}><User size={14} style={{color:'var(--text-light)'}}/></div>}
            </div>
          ))}

          {sending&&(
            <div className="flex gap-3 items-start anim-fade-up">
              <div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center" style={{background:'var(--grad-vivid)'}}><Bot size={14} className="text-white"/></div>
              <div className="card-static px-5 py-3.5 flex items-center gap-3"><div className="flex gap-1.5"><span className="dot"/><span className="dot"/><span className="dot"/></div><span className="text-xs" style={{color:'var(--text-dim)'}}>Searching & analyzing...</span></div>
            </div>
          )}
          <div ref={endRef}/>
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 md:px-6 py-3 relative z-10" style={{borderTop:'1px solid var(--border-dim)',background:'rgba(2,1,8,0.85)',backdropFilter:'blur(30px)'}}>
        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex gap-2">
          <input ref={inputRef} type="text" className="input-field flex-1 text-sm" placeholder="Ask about your documents and websites..." value={input} onChange={e=>setInput(e.target.value)} disabled={sending} autoFocus autoComplete="off"/>
          <button type="submit" disabled={!input.trim()||sending} className="btn-primary px-4 rounded-xl">{sending?<Loader2 className="anim-spin" size={18}/>:<Send size={18}/>}</button>
        </form>
        <p className="text-center text-[10px] mt-2" style={{color:'var(--text-faint)'}}>Powered by RAG &middot; Answers sourced from your knowledge base</p>
      </div>
    </div>
  );
}
