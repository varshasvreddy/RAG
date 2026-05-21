import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { documentsAPI, chatAPI, websitesAPI } from '../services/api';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Trash2, MessageSquare, LogOut, Clock, BookOpen, Sparkles, CheckCircle2, AlertCircle, Loader2, File, ChevronRight, Zap, Search, Globe, Link } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [docs, setDocs] = useState([]);
  const [webs, setWebs] = useState([]);
  const [convos, setConvos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selDocs, setSelDocs] = useState([]);
  const [selWebs, setSelWebs] = useState([]);
  const [urlInput, setUrlInput] = useState('');
  const [submittingUrl, setSubmittingUrl] = useState(false);
  const [polls, setPolls] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const [d, c, w] = await Promise.all([documentsAPI.list(), chatAPI.listConversations(), websitesAPI.list()]);
      setDocs(Array.isArray(d.data) ? d.data : d.data.results || []);
      setConvos(Array.isArray(c.data) ? c.data : c.data.results || []);
      setWebs(Array.isArray(w.data) ? w.data : w.data.results || []);
    } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const pD = docs.filter(d => !d.is_processed && !d.processing_error);
    const pW = webs.filter(w => !['ready', 'failed'].includes(w.status));
    if ((!pD.length && !pW.length) || polls > 60) return;
    const t = setInterval(async () => {
      try {
        if (pD.length) {
          const { data } = await documentsAPI.list();
          const arr = Array.isArray(data) ? data : data.results || [];
          setDocs(arr);
          if (!arr.some(d => !d.is_processed && !d.processing_error)) toast.success('Documents processed!');
        }
        if (pW.length) {
          const { data } = await websitesAPI.list();
          const arr = Array.isArray(data) ? data : data.results || [];
          setWebs(arr);
          if (!arr.some(w => !['ready', 'failed'].includes(w.status))) toast.success('Websites processed!');
        }
        setPolls(n => n + 1);
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [docs, webs, polls]);

  const onDrop = useCallback(async (files) => {
    setUploading(true); setPolls(0);
    for (const f of files) {
      const fd = new FormData(); fd.append('file', f); fd.append('title', f.name);
      try { await documentsAPI.upload(fd); toast.success(`Uploaded: ${f.name}`); } catch { toast.error(`Failed: ${f.name}`); }
    }
    setUploading(false); fetchData();
  }, [fetchData]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'], 'text/plain': ['.txt'] }, multiple: true });

  const delDoc = async (e, id) => { e.stopPropagation(); if (!confirm('Delete document?')) return; try { await documentsAPI.delete(id); setSelDocs(p => p.filter(d => d !== id)); toast.success('Deleted'); fetchData(); } catch { toast.error('Failed'); } };
  const toggleDoc = (id) => setSelDocs(p => p.includes(id) ? p.filter(d => d !== id) : [...p, id]);

  const submitUrl = async (e) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setSubmittingUrl(true); setPolls(0);
    try {
      await websitesAPI.submit({ url: urlInput });
      toast.success('URL submitted for scraping');
      setUrlInput('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.url?.[0] || 'Failed to submit URL');
    } finally {
      setSubmittingUrl(false);
    }
  };

  const delWeb = async (e, id) => { e.stopPropagation(); if (!confirm('Delete website?')) return; try { await websitesAPI.delete(id); setSelWebs(p => p.filter(w => w !== id)); toast.success('Deleted'); fetchData(); } catch { toast.error('Failed'); } };
  const toggleWeb = (id) => setSelWebs(p => p.includes(id) ? p.filter(w => w !== id) : [...p, id]);

  const startChat = async () => {
    const vD = docs.filter(d => d.is_processed && selDocs.includes(d.id));
    const vW = webs.filter(w => w.status === 'ready' && selWebs.includes(w.id));
    if (!vD.length && !vW.length) return toast.error('Select processed documents or websites');
    try { 
      const { data } = await chatAPI.createConversation({ 
        title: 'New Conversation', 
        document_ids: vD.map(d => d.id),
        website_ids: vW.map(w => w.id)
      }); 
      nav(`/chat/${data.id}`); 
    } catch { toast.error('Failed'); }
  };

  const fmtSz = b => b < 1024 ? b+' B' : b < 1048576 ? (b/1024).toFixed(1)+' KB' : (b/1048576).toFixed(1)+' MB';
  const fmtDt = d => new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  const ts = { pdf:{bg:'rgba(239,68,68,0.08)',fg:'#ef4444'}, docx:{bg:'rgba(96,165,250,0.08)',fg:'#60a5fa'}, txt:{bg:'rgba(52,211,153,0.08)',fg:'#34d399'} };

  if (loading) return (<div className="min-h-screen flex items-center justify-center" style={{background:'var(--bg-void)'}}><div className="text-center anim-fade-scale"><div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{background:'var(--grad-vivid)',boxShadow:'var(--glow-lg)'}}><BookOpen size={28} className="text-white"/></div><p className="text-lg font-semibold text-gradient-vivid">Loading...</p></div></div>);

  const totalSources = selDocs.length + selWebs.length;

  return (
    <div className="min-h-screen relative" style={{background:'var(--bg-void)'}}>
      <div className="ambient-bg"><div className="orb orb-a"/><div className="orb orb-b"/><div className="orb orb-c"/></div>
      <div className="grid-bg"/>
      <header className="sticky top-0 z-50" style={{background:'rgba(2,1,8,0.75)',backdropFilter:'blur(30px)',borderBottom:'1px solid var(--border-dim)'}}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:'var(--grad-vivid)'}}><BookOpen size={17} className="text-white"/></div><span className="text-base font-bold text-gradient-vivid">ResearchAI</span></div>
          <div className="flex items-center gap-3"><div className="pill pill-violet"><Sparkles size={10}/>{user?.username}</div><button onClick={logout} className="btn-ghost text-xs py-2 px-3"><LogOut size={14}/> Sign Out</button></div>
        </div>
      </header>
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            {icon:FileText,label:'Documents',val:docs.length,color:'var(--violet)'},
            {icon:Globe,label:'Websites',val:webs.length,color:'var(--emerald)'},
            {icon:MessageSquare,label:'Conversations',val:convos.length,color:'var(--blue)'},
            {icon:Zap,label:'Chunks Indexed',val:docs.reduce((a,d)=>a+(d.num_chunks||0),0)+webs.reduce((a,w)=>a+(w.num_chunks||0),0),color:'var(--cyan)'}
          ].map((s,i)=>(
            <div key={i} className="card-static p-5 anim-fade-up" style={{animationDelay:`${i*100}ms`}}>
              <div className="flex items-center gap-4"><div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{background:`${s.color}10`}}><s.icon size={20} style={{color:s.color}}/></div><div><p className="text-2xl font-bold" style={{color:'var(--text-white)'}}>{s.val}</p><p className="text-xs font-medium" style={{color:'var(--text-dim)'}}>{s.label}</p></div></div>
            </div>
          ))}
        </div>
        
        {totalSources > 0 && (
          <div className="sticky top-20 z-40 p-4 card-glow flex items-center justify-between anim-fade-up">
            <p className="font-semibold" style={{color:'var(--text-white)'}}>
              {totalSources} Source{totalSources > 1 ? 's' : ''} Selected
            </p>
            <button onClick={startChat} className="btn-primary py-2 px-6">
              <MessageSquare size={16} /> Start Chat
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div {...getRootProps()} className="relative rounded-2xl cursor-pointer transition-all group overflow-hidden flex flex-col justify-center" style={{border:`2px dashed ${isDragActive?'var(--violet)':'var(--border-default)'}`,background:isDragActive?'rgba(167,139,250,0.03)':'var(--bg-card)',padding:'2rem 1.5rem', minHeight: '180px'}}>
                <input {...getInputProps()}/>
                <div className="text-center relative">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3 ${isDragActive?'':'anim-float'}`} style={{background:isDragActive?'var(--grad-vivid)':'rgba(167,139,250,0.06)'}}><Upload size={22} style={{color:isDragActive?'white':'var(--violet)'}}/></div>
                  {uploading?<div className="flex items-center justify-center gap-2"><Loader2 className="anim-spin" size={16} style={{color:'var(--violet)'}}/><span className="text-sm" style={{color:'var(--text-light)'}}>Processing...</span></div>:<><p className="font-semibold" style={{color:isDragActive?'var(--violet)':'var(--text-white)'}}>{isDragActive?'Release to upload':'Drop files'}</p><p className="text-xs mt-1" style={{color:'var(--text-dim)'}}>PDF, DOCX, TXT</p></>}
                </div>
              </div>

              <div className="relative rounded-2xl overflow-hidden card-static p-6 flex flex-col justify-center" style={{minHeight: '180px'}}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'rgba(52,211,153,0.1)'}}><Globe size={20} style={{color:'var(--emerald)'}}/></div>
                  <div><p className="font-semibold" style={{color:'var(--text-white)'}}>Scrape Website</p><p className="text-xs" style={{color:'var(--text-dim)'}}>Extract knowledge from a URL</p></div>
                </div>
                <form onSubmit={submitUrl} className="flex gap-2">
                  <input type="url" required placeholder="https://example.com" value={urlInput} onChange={e=>setUrlInput(e.target.value)} className="input-field flex-1 text-sm py-2 px-3" disabled={submittingUrl} />
                  <button type="submit" className="btn-primary py-2 px-4 rounded-xl" disabled={submittingUrl || !urlInput.trim()}>
                    {submittingUrl ? <Loader2 className="anim-spin" size={16}/> : <Link size={16}/>}
                  </button>
                </form>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4" style={{color:'var(--text-white)'}}><FileText size={17} style={{color:'var(--violet)'}}/> Documents & Websites</h2>
              
              {docs.length === 0 && webs.length === 0 ? (
                <div className="card-static p-14 text-center">
                  <File size={44} className="mx-auto mb-3" style={{color:'var(--text-faint)',opacity:0.4}}/>
                  <p className="font-medium" style={{color:'var(--text-light)'}}>No knowledge sources yet</p>
                  <p className="text-sm mt-1" style={{color:'var(--text-dim)'}}>Upload a document or scrape a website above</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {docs.map((doc,i) => {
                    const sel = selDocs.includes(doc.id);
                    const t = ts[doc.file_type] || ts.txt;
                    return (
                      <div key={doc.id} onClick={() => doc.is_processed && toggleDoc(doc.id)} className="card-static p-4 flex items-center gap-4 anim-fade-up cursor-pointer transition-all" style={{animationDelay:`${i*30}ms`,borderColor:sel?'var(--border-glow)':undefined,boxShadow:sel?'var(--glow-sm)':undefined,background:sel?'rgba(167,139,250,0.04)':undefined}}>
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[10px] font-bold uppercase tracking-widest shrink-0" style={{background:t.bg,color:t.fg}}>{doc.file_type}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate" style={{color:'var(--text-white)'}}>{doc.title}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="pill pill-indigo">{fmtSz(doc.file_size)}</span>
                            {doc.is_processed && <span className="pill pill-emerald">{doc.num_chunks} chunks</span>}
                            {!doc.is_processed && !doc.processing_error && <span className="pill pill-amber">Processing...</span>}
                            {doc.processing_error && <span className="pill pill-rose">Error</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {doc.is_processed ? <CheckCircle2 size={18} style={{color:'var(--emerald)'}}/> : doc.processing_error ? <AlertCircle size={18} style={{color:'var(--rose)'}}/> : <Loader2 className="anim-spin" size={18} style={{color:'var(--amber)'}}/>}
                          <button onClick={e => delDoc(e,doc.id)} className="btn-icon"><Trash2 size={15}/></button>
                        </div>
                      </div>
                    );
                  })}
                  
                  {webs.map((web,i) => {
                    const sel = selWebs.includes(web.id);
                    return (
                      <div key={web.id} onClick={() => web.status === 'ready' && toggleWeb(web.id)} className="card-static p-4 flex items-center gap-4 anim-fade-up cursor-pointer transition-all" style={{animationDelay:`${(docs.length+i)*30}ms`,borderColor:sel?'rgba(52,211,153,0.4)':undefined,boxShadow:sel?'0 0 20px rgba(52,211,153,0.08)':undefined,background:sel?'rgba(52,211,153,0.04)':undefined}}>
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(52,211,153,0.1)',color:'var(--emerald)'}}><Globe size={18}/></div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate" style={{color:'var(--text-white)'}}>{web.title || web.url}</p>
                          <p className="text-xs truncate mb-1.5 mt-0.5" style={{color:'var(--text-dim)'}}>{web.url}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="pill pill-indigo">{web.pages_scraped} pages</span>
                            {web.status === 'ready' && <span className="pill pill-emerald">{web.num_chunks} chunks</span>}
                            {['pending', 'scraping', 'processing'].includes(web.status) && <span className="pill pill-amber">{web.status}...</span>}
                            {web.status === 'failed' && <span className="pill pill-rose">Error</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {web.status === 'ready' ? <CheckCircle2 size={18} style={{color:'var(--emerald)'}}/> : web.status === 'failed' ? <AlertCircle size={18} style={{color:'var(--rose)'}}/> : <Loader2 className="anim-spin" size={18} style={{color:'var(--amber)'}}/>}
                          <button onClick={e => delWeb(e,web.id)} className="btn-icon"><Trash2 size={15}/></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4" style={{color:'var(--text-white)'}}><MessageSquare size={17} style={{color:'var(--blue)'}}/> Chat History</h2>
            {convos.length===0?<div className="card-static p-10 text-center"><Search size={36} className="mx-auto mb-3" style={{color:'var(--text-faint)',opacity:0.3}}/><p className="text-sm font-medium" style={{color:'var(--text-light)'}}>No chats yet</p></div>:
            <div className="space-y-2">{convos.map((c,i)=>(
              <div key={c.id} onClick={()=>nav(`/chat/${c.id}`)} className="card p-4 cursor-pointer anim-fade-up group" style={{animationDelay:`${i*60}ms`}}>
                <p className="font-medium text-sm truncate mb-2" style={{color:'var(--text-white)'}}>{c.title}</p>
                <div className="flex items-center gap-2 text-[11px]" style={{color:'var(--text-dim)'}}><Clock size={11}/><span>{fmtDt(c.updated_at)}</span><span className="opacity-40">|</span><span>{c.message_count} msg{c.message_count!==1?'s':''}</span><ChevronRight size={13} className="ml-auto transition-transform group-hover:translate-x-1" style={{color:'var(--violet)'}}/></div>
              </div>))}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
