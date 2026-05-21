import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, ArrowRight, Sparkles, Zap, BookOpen, Brain, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return toast.error('Please fill in all fields');
    setLoading(true);
    try {
      await login(username, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative" style={{ background: 'var(--bg-void)' }}>
      {/* Ambient */}
      <div className="ambient-bg"><div className="orb orb-a" /><div className="orb orb-b" /></div>
      <div className="grid-bg" />

      {/* Left side — branding hero */}
      <div className="hidden lg:flex flex-col justify-center flex-1 px-16 relative z-10">
        <div className="max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--grad-vivid)', boxShadow: 'var(--glow-lg)' }}>
              <BookOpen size={24} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-gradient-vivid">ResearchAI</span>
          </div>

          <h2 className="text-4xl font-extrabold leading-tight mb-4" style={{ color: 'var(--text-white)' }}>
            Your documents,<br/>
            <span className="text-gradient">answered instantly.</span>
          </h2>
          <p className="text-base leading-relaxed mb-10" style={{ color: 'var(--text-dim)' }}>
            Upload research papers, notes, and PDFs. Ask questions. Get AI-powered answers with citations — in seconds.
          </p>

          {/* Feature pills */}
          <div className="space-y-3">
            {[
              { icon: Zap, text: 'RAG-powered answers from your documents', color: 'var(--violet)' },
              { icon: Brain, text: 'Semantic search with FAISS embeddings', color: 'var(--cyan)' },
              { icon: MessageSquare, text: 'Chat history with source citations', color: 'var(--emerald)' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 anim-fade-up" style={{ animationDelay: `${i * 150 + 300}ms` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${f.color}12` }}>
                  <f.icon size={15} style={{ color: f.color }} />
                </div>
                <span className="text-sm" style={{ color: 'var(--text-light)' }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side — login form */}
      <div className="flex-1 flex items-center justify-center px-6 relative z-10">
        <div className="w-full max-w-[400px] anim-fade-scale">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: 'var(--grad-vivid)', boxShadow: 'var(--glow-lg)' }}>
              <BookOpen size={26} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gradient-vivid">ResearchAI</h1>
          </div>

          <div className="card-static p-8" style={{ boxShadow: 'var(--glow-md)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={16} style={{ color: 'var(--violet)' }} />
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-white)' }}>Welcome back</h2>
            </div>
            <p className="text-sm mb-7" style={{ color: 'var(--text-dim)' }}>Sign in to your research workspace</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[11px] font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Username</label>
                <input id="login-username" type="text" className="input-field" placeholder="Enter username"
                  value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Password</label>
                <div className="relative">
                  <input id="login-password" type={showPw ? 'text' : 'password'} className="input-field pr-12"
                    placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/5 transition"
                    style={{ color: 'var(--text-faint)' }}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button id="login-submit" type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-[0.92rem]">
                {loading ? <span className="anim-spin inline-block w-5 h-5 border-2 border-white/20 border-t-white rounded-full" /> : <>Sign In <ArrowRight size={16} /></>}
              </button>
            </form>

            <div className="mt-7 pt-5 text-center" style={{ borderTop: '1px solid var(--border-dim)' }}>
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
                New here?{' '}
                <Link to="/register" className="font-semibold hover:underline" style={{ color: 'var(--violet)' }}>Create account</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
