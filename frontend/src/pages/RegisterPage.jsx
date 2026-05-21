import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, ArrowRight, BookOpen, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '', password2: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Object.values(form).some(v => !v)) return toast.error('Please fill all fields');
    if (form.password !== form.password2) return toast.error('Passwords do not match');
    if (form.password.length < 6) return toast.error('Min 6 characters');
    setLoading(true);
    try {
      await register(form.username, form.email, form.password, form.password2);
      toast.success('Account created!');
      navigate('/');
    } catch (err) {
      const errors = err.response?.data;
      toast.error(errors ? Object.values(errors).flat().join('. ') : 'Registration failed');
    } finally { setLoading(false); }
  };

  const fields = [
    { name: 'username', type: 'text', label: 'Username', ph: 'Choose a username' },
    { name: 'email', type: 'email', label: 'Email', ph: 'you@email.com' },
    { name: 'password', type: showPw ? 'text' : 'password', label: 'Password', ph: 'Min 6 characters', toggle: true },
    { name: 'password2', type: 'password', label: 'Confirm', ph: 'Repeat password' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative" style={{ background: 'var(--bg-void)' }}>
      <div className="ambient-bg"><div className="orb orb-b" /><div className="orb orb-c" /></div>
      <div className="grid-bg" />

      <div className="w-full max-w-[420px] relative z-10 anim-fade-scale">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: 'var(--grad-vivid)', boxShadow: 'var(--glow-lg)' }}>
            <BookOpen size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gradient-vivid">ResearchAI</h1>
          <p className="text-sm mt-1 flex items-center justify-center gap-1.5" style={{ color: 'var(--text-dim)' }}>
            <UserPlus size={13} style={{ color: 'var(--violet)' }} /> Create your account
          </p>
        </div>

        <div className="card-static p-8" style={{ boxShadow: 'var(--glow-md)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map((f) => (
              <div key={f.name}>
                <label className="block text-[11px] font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{f.label}</label>
                <div className="relative">
                  <input name={f.name} type={f.type} className={`input-field ${f.toggle ? 'pr-12' : ''}`}
                    placeholder={f.ph} value={form[f.name]} onChange={handleChange} />
                  {f.toggle && (
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/5"
                      style={{ color: 'var(--text-faint)' }}>
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 mt-2">
              {loading ? <span className="anim-spin inline-block w-5 h-5 border-2 border-white/20 border-t-white rounded-full" /> : <>Create Account <ArrowRight size={16} /></>}
            </button>
          </form>
          <div className="mt-6 pt-5 text-center" style={{ borderTop: '1px solid var(--border-dim)' }}>
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
              Already have an account? <Link to="/login" className="font-semibold hover:underline" style={{ color: 'var(--violet)' }}>Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
