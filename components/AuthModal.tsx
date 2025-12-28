import React, { useState, useEffect } from 'react';
import { X, User, Lock, Loader2, Google, Twitter, LogIn, ChevronLeft, Mail, CheckCircle, AlertTriangle, Eye, EyeOff } from './Icons';
import { authService } from '../services/auth';
import TermsContent from './TermsContent';
import PrivacyContent from './PrivacyContent';
import { Language } from '../types';
import { getTranslations } from '../locales';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any) => void;
  validationParams?: { userId: number, key: string } | null;
  language: Language;
}

// Fix: Cast default value 'pt' to Language to prevent type widening to string.
const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess, validationParams, language = 'pt' as Language }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'email_verification' | 'validating'>('login');
  const t = getTranslations(language).authModal;

  // Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  // Visibility States
  const [showPassword, setShowPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false); // NEW for Login tab

  // Password Strength State
  const [passStrength, setPassStrength] = useState(0); 
  const [reqs, setReqs] = useState({
      length: false,
      upper: false,
      number: false,
      symbol: false
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPendingError, setIsPendingError] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [linkSent, setLinkSent] = useState(false);

  // Overlay for terms/privacy
  const [showTermsOverlay, setShowTermsOverlay] = useState<'terms' | 'privacy' | null>(null);

  // Initialize Mode based on params
  useEffect(() => {
      if (validationParams) {
          setMode('validating');
          handleValidation(validationParams.userId, validationParams.key);
      } else {
          setMode('login'); // Default
      }
  }, [validationParams, isOpen]);

  const handleValidation = async (uid: number, key: string) => {
      setLoading(true);
      setError('');
      setSuccessMsg('');
      try {
          await authService.validateEmail(uid, key);
          setSuccessMsg(t.accountActivatedSuccess);
      } catch (err: any) {
          setError(err.message || t.validationFailed);
      } finally {
          setLoading(false);
      }
  };

  if (!isOpen) return null;

  const resetForm = () => {
      setError('');
      setIsPendingError(false);
      setSuccessMsg('');
      setPassword('');
      setConfirmPassword('');
      setLinkSent(false);
      setPassStrength(0);
      setShowPassword(false);
      setShowLoginPassword(false);
      setReqs({ length: false, upper: false, number: false, symbol: false });
  };

  // Password Strength Logic
  const calculateStrength = (pass: string) => {
      const r = {
          length: pass.length >= 8,
          upper: /[A-Z]/.test(pass),
          number: /[0-9]/.test(pass),
          symbol: /[^A-Za-z0-9]/.test(pass)
      };
      setReqs(r);
      
      let score = 0;
      if (r.length) score++;
      if (r.upper) score++;
      if (r.number) score++;
      if (r.symbol) score++;
      
      return score;
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setPassword(val);
      setPassStrength(calculateStrength(val));
  };

  const getStrengthColor = () => {
      if (passStrength <= 1) return 'bg-red-500';
      if (passStrength <= 3) return 'bg-yellow-500';
      return 'bg-green-500';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsPendingError(false);
    if (!email || !password) {
        setError(t.fillAllFields);
        return;
    }
    setLoading(true);
    try {
      const data = await authService.login(email, password);
      onLoginSuccess(data);
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Falha ao conectar.';
      if (msg.toLowerCase().includes('pendente') || msg.toLowerCase().includes('valide')) {
          setIsPendingError(true);
          setError(t.accountNotActivated);
      } else {
          setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsPendingError(false);
      
      const blacklisted = ['tempmail.com', '10minutemail.com', 'guerrillamail.com', 'yopmail.com', 'mailinator.com', 'throwawaymail.com', 'getnada.com', 'dispostable.com'];
      const domain = email.split('@')[1];
      if(domain && blacklisted.includes(domain.toLowerCase())) {
          setError(t.tempEmailsNotAllowed);
          return;
      }
      
      if(!email || !password || !confirmPassword) {
          setError(t.fillRequiredFields);
          return;
      }
      if(password !== confirmPassword) {
          setError(t.passwordsDoNotMatch);
          return;
      }
      if(passStrength < 3) {
          setError(t.passwordNotStrongEnough);
          return;
      }
      if(!termsAccepted) {
          setError(t.acceptTheTerms);
          return;
      }

      setLoading(true);
      try {
          await authService.register(email, password);
          setMode('email_verification');
          resetForm();
      } catch (err: any) {
          setError(err.message || "Erro ao registrar.");
      } finally {
          setLoading(false);
      }
  };

  const handleForgot = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      if(!email) {
          setError("Digite seu e-mail.");
          return;
      }
      setLoading(true);
      try {
          await authService.resetPassword(email);
          setLinkSent(true);
          setSuccessMsg(t.linkSentSuccess);
      } catch(err: any) {
          setError(err.message || "Erro ao enviar link.");
          setLinkSent(false); 
      } finally {
          setLoading(false);
      }
  };

  const handleSocialLogin = (provider: string) => {
    const baseUrl = 'https://centralcrypto.com.br/2/wp-login.php';
    const url = `${baseUrl}?loginSocial=${provider}&redirect=${window.location.origin}`; 
    window.location.href = url;
  };

  const handleManualEmail = () => {
      const subject = encodeURIComponent("Reset de Senha - Central Crypto");
      const body = encodeURIComponent(`Solicito reset de senha para: ${email}`);
      window.location.href = `mailto:contato@centralcrypto.com.br?subject=${subject}&body=${body}`;
  };

  if (mode === 'email_verification') {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative bg-tech-950 border border-tech-700 w-full max-w-md rounded-2xl shadow-2xl p-8 flex flex-col items-center text-center animate-in zoom-in-95">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle size={32} className="text-green-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{t.almostThere}</h3>
                <p className="text-gray-300 text-sm mb-6 leading-relaxed">
                    {t.accountCreated} <strong>{email}</strong>.
                </p>
                <div className="bg-tech-900 border border-tech-800 p-4 rounded-lg mb-6 w-full text-xs text-gray-400">
                    <p className="font-bold text-[#dd9933] mb-1">{t.checkYourEmail}</p>
                    {t.clickToActivate}
                </div>
                <button 
                    onClick={() => setMode('login')} 
                    className="w-full bg-[#dd9933] hover:bg-[#eeb04e] text-black font-bold uppercase py-3 rounded-lg transition-colors shadow-lg"
                >
                    {t.backToLogin}
                </button>
            </div>
        </div>
      );
  }

  if (mode === 'validating') {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
            <div className="relative bg-tech-950 border border-tech-700 w-full max-w-sm rounded-2xl shadow-2xl p-8 flex flex-col items-center text-center">
                {successMsg ? (
                    <>
                        <CheckCircle size={48} className="text-green-500 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">{t.accountActivated}</h3>
                        <p className="text-gray-400 text-sm mb-6">{successMsg}</p>
                        <button onClick={() => setMode('login')} className="w-full bg-[#dd9933] text-black font-bold py-2 rounded uppercase tracking-wider">{t.doLogin}</button>
                    </>
                ) : error ? (
                    <>
                        <AlertTriangle size={48} className="text-red-500 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">{t.error}</h3>
                        <p className="text-gray-400 text-sm mb-6">{error}</p>
                        <button onClick={() => onClose()} className="w-full bg-tech-800 text-white font-bold py-2 rounded">{t.close}</button>
                    </>
                ) : (
                    <>
                        <Loader2 size={48} className="text-[#dd9933] animate-spin mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">{t.validating}</h3>
                        <p className="text-gray-400 text-sm">{t.activatingAccount}</p>
                    </>
                )}
            </div>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      <div className="relative bg-tech-950 border border-tech-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        
        <div className="h-28 bg-gradient-to-br from-tech-900 to-black relative flex items-center justify-center border-b border-tech-800 shrink-0">
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
             <img 
               src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" 
               className="h-12 relative z-10 drop-shadow-lg"
               alt="Logo"
             />
             <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors bg-black/20 p-1 rounded-full z-20">
               <X size={20} />
             </button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar relative">
            
            {showTermsOverlay && (
                <div className="absolute inset-0 bg-tech-950 z-50 p-6 flex flex-col animate-in fade-in">
                    <div className="flex justify-between items-center mb-4 border-b border-tech-800 pb-2">
                        <h3 className="text-[#dd9933] font-bold uppercase">{showTermsOverlay === 'terms' ? t.termsTitle : t.privacyTitle}</h3>
                        <button onClick={() => setShowTermsOverlay(null)} className="text-gray-400 hover:text-white"><X size={20}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                        {showTermsOverlay === 'terms' ? <TermsContent language={language} /> : <PrivacyContent language={language} />}
                    </div>
                    <button onClick={() => setShowTermsOverlay(null)} className="mt-4 w-full bg-tech-800 hover:bg-tech-700 text-white py-2 rounded text-xs font-bold uppercase shrink-0">{t.close}</button>
                </div>
            )}

            {mode === 'forgot' ? (
                <div className="flex flex-col gap-4 animate-in slide-in-from-right">
                    <button onClick={() => { setMode('login'); resetForm(); }} className="flex items-center gap-2 text-gray-500 hover:text-white text-xs mb-2 transition-colors">
                        <ChevronLeft size={14}/> {t.backToLogin}
                    </button>
                    <h3 className="text-xl font-bold text-white mb-1">{t.recoverPassword}</h3>
                    <p className="text-xs text-gray-400 mb-4">{t.recoverPasswordInstruction}</p>
                    
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-xs font-bold mb-2 break-words">
                            ⚠️ {error}
                            <div className="mt-2 pt-2 border-t border-red-500/30">
                                <button onClick={handleManualEmail} className="text-white hover:underline text-[10px] uppercase font-bold">
                                    {t.didNotReceiveRequestManually}
                                </button>
                            </div>
                        </div>
                    )}
                    
                    <form onSubmit={handleForgot} className="flex flex-col gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">{t.registeredEmail}</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 text-gray-500" size={16} />
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-tech-900 border border-tech-700 rounded-lg py-2.5 pl-10 pr-4 text-sm text-gray-200 focus:border-[#dd9933] outline-none transition-all placeholder-gray-600" placeholder="seu@email.com" disabled={linkSent} />
                            </div>
                        </div>
                        
                        {linkSent ? (
                            <div className="space-y-3 animate-in fade-in">
                                <div className="p-3 bg-green-500/10 border border-green-500/50 rounded text-green-400 text-xs font-bold flex items-start gap-2">
                                    <CheckCircle size={14} className="shrink-0 mt-0.5"/> 
                                    <div>
                                        {t.linkSentSuccess}<br/>
                                        <span className="text-[10px] opacity-80 font-normal">{t.checkInboxAndSpam}</span>
                                    </div>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => { setMode('login'); resetForm(); }}
                                    className="w-full bg-gray-200 text-black border border-gray-300 hover:bg-white font-bold uppercase text-xs py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg"
                                >
                                    <ChevronLeft size={14}/> {t.backToLogin}
                                </button>
                            </div>
                        ) : (
                            <button 
                                type="submit" 
                                disabled={loading} 
                                className="mt-2 bg-[#dd9933] text-black font-bold uppercase tracking-widest text-xs py-3 rounded-lg hover:bg-[#eeb04e] transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
                            >
                                {loading ? <Loader2 className="animate-spin" size={16}/> : t.sendLink}
                            </button>
                        )}
                    </form>
                </div>
            ) : (
                <>
                    <div className="flex bg-tech-900 p-1 rounded-lg mb-6 border border-tech-800">
                        <button onClick={() => { setMode('login'); resetForm(); }} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${mode === 'login' ? 'bg-tech-800 text-[#dd9933] shadow' : 'text-gray-500 hover:text-gray-300'}`}>{t.login}</button>
                        <button onClick={() => { setMode('register'); resetForm(); }} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${mode === 'register' ? 'bg-tech-800 text-[#dd9933] shadow' : 'text-gray-500 hover:text-gray-300'}`}>{t.register}</button>
                    </div>

                    {isPendingError && (
                        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/50 rounded flex gap-3 animate-pulse">
                            <AlertTriangle className="text-yellow-500 shrink-0" size={20} />
                            <div className="text-xs">
                                <strong className="text-yellow-500 block mb-1">{t.pendingAccount}</strong>
                                <span className="text-gray-300">{t.pendingAccountDesc}</span>
                            </div>
                        </div>
                    )}

                    {error && !isPendingError && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-xs text-center font-bold animate-pulse">⚠️ {error}</div>}
                    
                    <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="flex flex-col gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">{mode === 'login' ? t.userOrEmail : t.email}</label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 text-gray-500" size={16} />
                                <input type={mode === 'login' ? "text" : "email"} value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-tech-900 border border-tech-700 rounded-lg py-2.5 pl-10 pr-4 text-sm text-gray-200 focus:border-[#dd9933] outline-none transition-all placeholder-gray-600" placeholder={mode === 'login' ? "Digite seu acesso..." : "seu@email.com"} />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">{t.password}</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 text-gray-500" size={16} />
                                
                                {mode === 'login' && (
                                    <>
                                        <input 
                                            type={showLoginPassword ? "text" : "password"} 
                                            value={password} 
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-tech-900 border border-tech-700 rounded-lg py-2.5 pl-10 pr-10 text-sm text-gray-200 focus:border-[#dd9933] outline-none transition-all placeholder-gray-600" 
                                            placeholder="••••••••" 
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setShowLoginPassword(!showLoginPassword)}
                                            className="absolute right-3 top-3 text-gray-500 hover:text-gray-300 transition-colors"
                                        >
                                            {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </>
                                )}

                                {mode === 'register' && (
                                    <>
                                        <input 
                                            type={showPassword ? "text" : "password"} 
                                            value={password} 
                                            onChange={handlePasswordChange}
                                            className="w-full bg-tech-900 border border-tech-700 rounded-lg py-2.5 pl-10 pr-10 text-sm text-gray-200 focus:border-[#dd9933] outline-none transition-all placeholder-gray-600" 
                                            placeholder="••••••••" 
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-3 text-gray-500 hover:text-gray-300 transition-colors"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </>
                                )}
                            </div>
                            
                            {mode === 'register' && (
                                <div className="mt-4 animate-in fade-in bg-white/5 p-4 rounded-lg border border-tech-700">
                                    <div className="flex gap-1 h-1.5 mb-3">
                                        <div className={`flex-1 rounded-full transition-colors duration-300 ${passStrength >= 1 ? getStrengthColor() : 'bg-tech-800'}`}></div>
                                        <div className={`flex-1 rounded-full transition-colors duration-300 ${passStrength >= 2 ? getStrengthColor() : 'bg-tech-800'}`}></div>
                                        <div className={`flex-1 rounded-full transition-colors duration-300 ${passStrength >= 3 ? getStrengthColor() : 'bg-tech-800'}`}></div>
                                        <div className={`flex-1 rounded-full transition-colors duration-300 ${passStrength >= 4 ? getStrengthColor() : 'bg-tech-800'}`}></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 font-medium font-sans" style={{ fontSize: '12px', color: '#eeeeee' }}>
                                        <span className={`transition-all ${reqs.length ? 'text-green-400 line-through decoration-2 opacity-70' : ''}`}>{t.min8Chars}</span>
                                        <span className={`transition-all ${reqs.upper ? 'text-green-400 line-through decoration-2 opacity-70' : ''}`}>{t.oneUppercase}</span>
                                        <span className={`transition-all ${reqs.number ? 'text-green-400 line-through decoration-2 opacity-70' : ''}`}>{t.numbers}</span>
                                        <span className={`transition-all ${reqs.symbol ? 'text-green-400 line-through decoration-2 opacity-70' : ''}`}>{t.symbols}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {mode === 'register' && (
                            <>
                                <div className="space-y-1 animate-in slide-in-from-top-2">
                                    <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">{t.confirmPassword}</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 text-gray-500" size={16} />
                                        <input 
                                            type="password" 
                                            value={confirmPassword} 
                                            onChange={(e) => setConfirmPassword(e.target.value)} 
                                            onPaste={(e) => e.preventDefault()}
                                            onCopy={(e) => e.preventDefault()}
                                            className="w-full bg-tech-900 border border-tech-700 rounded-lg py-2.5 pl-10 pr-4 text-sm text-gray-200 focus:border-[#dd9933] outline-none transition-all placeholder-gray-600" 
                                            placeholder="••••••••" 
                                        />
                                    </div>
                                </div>
                                <div className="flex items-start gap-2 pt-2">
                                    <input type="checkbox" id="terms" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-0.5 accent-[#dd9933] bg-tech-900 border-tech-700 rounded cursor-pointer" />
                                    <label htmlFor="terms" className="text-[10px] text-gray-400 cursor-pointer select-none">
                                        {t.iAgreeToTerms} <span onClick={(e) => {e.preventDefault(); setShowTermsOverlay('terms')}} className="text-[#dd9933] hover:underline">{t.termsOfUse}</span> e <span onClick={(e) => {e.preventDefault(); setShowTermsOverlay('privacy')}} className="text-[#dd9933] hover:underline">{t.privacyPolicy}</span>.
                                    </label>
                                </div>
                            </>
                        )}

                        {mode === 'login' && (
                            <div className="flex justify-end pt-1">
                                <button type="button" onClick={() => { setMode('forgot'); resetForm(); }} className="text-[10px] text-gray-400 hover:text-[#dd9933] transition-colors">{t.forgotPassword}</button>
                            </div>
                        )}

                        <button type="submit" disabled={loading} className="mt-2 bg-[#dd9933] text-black font-bold uppercase tracking-widest text-xs py-3 rounded-lg hover:bg-[#eeb04e] transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
                            {loading ? <Loader2 className="animate-spin" size={16}/> : (mode === 'login' ? t.login : t.register)}
                        </button>
                    </form>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-tech-800"></div></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-tech-950 px-2 text-gray-500 font-bold">{t.orLoginWith}</span></div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => handleSocialLogin('google')} className="flex items-center justify-center py-2.5 bg-white rounded-lg hover:bg-gray-100 transition-colors shadow-lg group">
                            <Google size={20} /> <span className="ml-2 text-xs font-bold text-gray-700 group-hover:text-black">Google</span>
                        </button>
                        <button onClick={() => handleSocialLogin('twitter')} className="flex items-center justify-center py-2.5 bg-black border border-tech-700 rounded-lg hover:bg-gray-900 transition-colors shadow-lg group">
                            <Twitter size={20} className="text-white" /> <span className="ml-2 text-xs font-bold text-gray-300 group-hover:text-white">X / Twitter</span>
                        </button>
                    </div>
                </>
            )}
            
            {mode === 'login' && (
                <p className="text-center text-[10px] text-gray-500 mt-6">
                    {t.byLoggingInYouAgree} <span onClick={() => setShowTermsOverlay('terms')} className="underline hover:text-[#dd9933] cursor-pointer">{t.termsShort}</span> e <span onClick={() => setShowTermsOverlay('privacy')} className="underline hover:text-[#dd9933] cursor-pointer">{t.policyShort}</span>.
                </p>
            )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;