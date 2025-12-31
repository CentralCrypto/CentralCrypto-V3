
import React, { useState, useEffect, useRef } from 'react';
import { User, CreditCard, Lock, Loader2, Save, Camera, Mail, X } from './Icons';
import { userService } from '../services/user';
import { authService, UserData } from '../services/auth';

const UserProfile: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'sub' | 'security'>('profile');
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  
  // Avatar Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchLatestData();
  }, []);

  const fetchLatestData = async () => {
    const localUser: UserData | null = authService.getCurrentUser();

    if (!localUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // BUSCA DIRETO DO WP – SEM INVENTAR NADA
      const freshData = await userService.getProfile();
      console.log('FRESH PROFILE FROM WP:', freshData);

      // Usa EXATAMENTE o que vier do WP
      setUserData(freshData);
      setFirstName(freshData.first_name || '');
      setLastName(freshData.last_name || '');
      setBio(freshData.description || '');

      // Atualiza localStorage SÓ com nome/avatar se mudou (pra header ficar em sync)
      if (
        freshData.name !== localUser.user_display_name ||
        freshData.avatar_url !== localUser.avatar_url
      ) {
        const updatedUser: UserData = {
          ...localUser,
          user_display_name: freshData.name || localUser.user_display_name,
          avatar_url: freshData.avatar_url || localUser.avatar_url,
        };
        localStorage.setItem('central_user', JSON.stringify(updatedUser));
      }
    } catch (e) {
      console.error('Erro ao sincronizar perfil com WP:', e);
      setMsg({
        type: 'error',
        text: 'Não foi possível carregar os dados do WordPress. Tente novamente diretamente no site principal.',
      });

      // Mostra pelo menos o básico vindo do login, SEM inventar nome/sobrenome/role
      const lu = authService.getCurrentUser();
      if (lu) {
        setUserData({
          id: (lu as any).user_id || 0,
          username: lu.user_nicename,
          name: lu.user_display_name,
          email: lu.user_email,
          description: '',
          roles: [],
          avatar_url: lu.avatar_url,
        });
        setFirstName('');
        setLastName('');
        setBio('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setAvatarPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    const localUser: any = authService.getCurrentUser();
    if (!localUser) return;

    if (!userData || !userData.id || userData.id === 0) {
      setMsg({ type: 'error', text: 'Não foi possível sincronizar com o WordPress neste ambiente. Salve direto no site principal.' });
      setTimeout(() => setMsg({ type: '', text: '' }), 4000);
      return;
    }

    setSaving(true);
    try {
        let avatarId = null;
        if (selectedFile) {
            // Fix: Property 'uploadMedia' does not exist on userService. Changed to 'uploadAvatar'.
            // The result from uploadAvatar contains 'attachment_id', which is used below.
            const media = await userService.uploadAvatar(selectedFile);
            avatarId = media.attachment_id;
        }

        const updateData: any = {
            first_name: firstName,
            last_name: lastName,
            description: bio,
            name: `${firstName} ${lastName}`.trim()
        };
        
        if (avatarId) {
            updateData.meta = { simple_local_avatar: { media_id: avatarId } }; 
        }

        // The comment below appears to be a leftover from previous code. The call is correct.
        // Fix: userService.updateProfile expects only one argument.
        await userService.updateProfile(updateData);
        
        setMsg({ type: 'success', text: 'Perfil atualizado com sucesso!' });
        fetchLatestData();
        setAvatarPreview(null);
        setSelectedFile(null);

    } catch (e) {
        console.error('Erro ao salvar perfil:', e);
        setMsg({ type: 'error', text: 'Erro ao salvar.' });
    } finally {
        setSaving(false);
        setTimeout(() => setMsg({ type: '', text: '' }), 3000);
    }
  };

  // ROLE: mostra exatamente o que vier do WP (primeiro role), sem inventar "free", "pro", nada
  const getRoleDisplay = () => {
      if (!userData?.roles || userData.roles.length === 0) return '';
      return userData.roles[0]; // ex: "administrator", "pmpro_role_10"
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#dd9933]">
        <Loader2 className="animate-spin" size={32}/>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Nenhum usuário logado.
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-screen">
       <div className="max-w-4xl mx-auto">
           
           <div className="flex flex-col md:flex-row gap-8 items-start mb-8">
               {/* HEADER CARD */}
               <div className="bg-tech-900 border border-tech-800 rounded-2xl p-6 flex items-center gap-6 w-full shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-[#dd9933]/10 blur-3xl rounded-full pointer-events-none"></div>
                   
                   <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                       <div className="w-24 h-24 rounded-full bg-tech-950 border-2 border-[#dd9933] flex items-center justify-center text-3xl font-bold text-[#dd9933] overflow-hidden">
                           {avatarPreview ? (
                               <img src={avatarPreview} className="w-full h-full object-cover" />
                           ) : userData?.avatar_url ? (
                               <img src={userData.avatar_url} className="w-full h-full object-cover" />
                           ) : (
                               (userData?.name?.substring(0,2).toUpperCase() || 'US')
                           )}
                       </div>
                       <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                           <Camera className="text-white" size={24} />
                       </div>
                       <input 
                           type="file" 
                           ref={fileInputRef} 
                           className="hidden" 
                           accept="image/*"
                           onChange={handleFileSelect}
                       />
                   </div>
                   
                   <div>
                       <h2 className="text-2xl font-bold text-white mb-1">{userData?.name || userData?.username}</h2>
                       <p className="text-gray-400 text-sm flex items-center gap-2 mb-2">
                         <Mail size={12}/> {userData?.email}
                       </p>
                       {getRoleDisplay() && (
                         <span className="bg-[#dd9933]/20 text-[#dd9933] text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider border border-[#dd9933]/30">
                             {getRoleDisplay()}
                         </span>
                       )}
                   </div>
               </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
               {/* SIDEBAR MENU */}
               <div className="md:col-span-1">
                   <div className="bg-tech-900 border border-tech-800 rounded-xl overflow-hidden shadow-lg sticky top-32">
                       <button 
                         onClick={() => setActiveTab('profile')} 
                         className={`w-full text-left px-6 py-4 flex items-center gap-3 text-sm font-bold border-l-4 transition-all ${
                           activeTab === 'profile' 
                             ? 'bg-tech-800 border-[#dd9933] text-white' 
                             : 'border-transparent text-gray-400 hover:bg-tech-800/50 hover:text-gray-200'
                         }`}
                       >
                           <User size={18}/> Perfil
                       </button>
                       <button 
                         onClick={() => setActiveTab('sub')} 
                         className={`w-full text-left px-6 py-4 flex items-center gap-3 text-sm font-bold border-l-4 transition-all ${
                           activeTab === 'sub' 
                             ? 'bg-tech-800 border-[#dd9933] text-white' 
                             : 'border-transparent text-gray-400 hover:bg-tech-800/50 hover:text-gray-200'
                         }`}
                       >
                           <CreditCard size={18}/> Assinatura
                       </button>
                       <button 
                         onClick={() => setActiveTab('security')} 
                         className={`w-full text-left px-6 py-4 flex items-center gap-3 text-sm font-bold border-l-4 transition-all ${
                           activeTab === 'security' 
                             ? 'bg-tech-800 border-[#dd9933] text-white' 
                             : 'border-transparent text-gray-400 hover:bg-tech-800/50 hover:text-gray-200'
                         }`}
                       >
                           <Lock size={18}/> Segurança
                       </button>
                   </div>
               </div>

               {/* CONTENT AREA */}
               <div className="md:col-span-3">
                   <div className="bg-tech-900 border border-tech-800 rounded-xl p-8 shadow-xl min-h-[400px]">
                       
                       {activeTab === 'profile' && (
                           <div className="animate-in fade-in">
                               <h3 className="text-xl font-bold text-white mb-6 border-b border-tech-800 pb-4">Dados Pessoais</h3>
                               
                               {selectedFile && (
                                   <div className="mb-6 p-4 bg-[#dd9933]/10 border border-[#dd9933]/30 rounded flex items-center justify-between">
                                       <span className="text-[#dd9933] text-xs font-bold uppercase">
                                         Nova foto selecionada - Salve para aplicar
                                       </span>
                                       <button 
                                         onClick={() => { setSelectedFile(null); setAvatarPreview(null); }} 
                                         className="text-red-400 hover:text-white"
                                       >
                                         <X size={16}/>
                                       </button>
                                   </div>
                               )}

                               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                   <div className="space-y-2">
                                       <label className="text-xs font-bold text-gray-500 uppercase">Nome</label>
                                       <input 
                                          type="text" 
                                          value={firstName} 
                                          onChange={e => setFirstName(e.target.value)} 
                                          className="w-full bg-tech-950 border border-tech-700 rounded p-3 text-gray-200 focus:border-[#dd9933] outline-none transition-colors" 
                                       />
                                   </div>
                                   <div className="space-y-2">
                                       <label className="text-xs font-bold text-gray-500 uppercase">Sobrenome</label>
                                       <input 
                                          type="text" 
                                          value={lastName} 
                                          onChange={e => setLastName(e.target.value)} 
                                          className="w-full bg-tech-950 border border-tech-700 rounded p-3 text-gray-200 focus:border-[#dd9933] outline-none transition-colors" 
                                       />
                                   </div>
                               </div>
                               <div className="space-y-2 mb-8">
                                   <label className="text-xs font-bold text-gray-500 uppercase">Biografia</label>
                                   <textarea 
                                      value={bio} 
                                      onChange={e => setBio(e.target.value)} 
                                      rows={4} 
                                      className="w-full bg-tech-950 border border-tech-700 rounded p-3 text-gray-200 focus:border-[#dd9933] outline-none transition-colors" 
                                      placeholder="Fale um pouco sobre você..."
                                   ></textarea>
                               </div>
                               <div className="flex items-center justify-between">
                                   {msg.text && (
                                     <span className={`text-sm font-bold ${msg.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                                       {msg.text}
                                     </span>
                                   )}
                                   <button 
                                      onClick={handleSave} 
                                      disabled={saving} 
                                      className="bg-[#dd9933] hover:bg-[#eeb04e] text-black font-bold uppercase text-xs px-6 py-3 rounded shadow-lg flex items-center gap-2 ml-auto"
                                   >
                                       {saving ? <Loader2 className="animate-spin" size={16}/> : <><Save size={16}/> Salvar Alterações</>}
                                   </button>
                               </div>
                           </div>
                       )}

                       {activeTab === 'sub' && (
                           <div className="animate-in fade-in">
                               <h3 className="text-xl font-bold text-white mb-6 border-b border-tech-800 pb-4">Minha Assinatura</h3>
                               <div className="bg-tech-950 border border-tech-700 rounded-xl p-6 flex flex-col items-center text-center">
                                   <div className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Plano Atual</div>
                                   <div className="text-3xl font-black text-white mb-4">
                                     {getRoleDisplay() || '—'}
                                   </div>
                                   <p className="text-gray-400 text-sm mb-6 max-w-md">
                                     Você tem acesso limitado aos indicadores e análises. Faça o upgrade para desbloquear todo o potencial.
                                   </p>
                                   <button className="bg-tech-800 border border-[#dd9933] text-[#dd9933] hover:bg-[#dd9933] hover:text-black font-bold uppercase text-xs px-8 py-3 rounded shadow-lg transition-all transform hover:scale-105">
                                       Upgrade
                                   </button>
                               </div>
                           </div>
                       )}

                       {activeTab === 'security' && (
                           <div className="animate-in fade-in">
                               <h3 className="text-xl font-bold text-white mb-6 border-b border-tech-800 pb-4">Segurança</h3>
                               <div className="space-y-6 max-w-md">
                                   <div className="space-y-2">
                                       <label className="text-xs font-bold text-gray-500 uppercase">Senha Atual</label>
                                       <input 
                                         type="password" 
                                         className="w-full bg-tech-950 border border-tech-700 rounded p-3 text-gray-200 focus:border-[#dd9933] outline-none transition-colors" 
                                       />
                                   </div>
                                   <div className="space-y-2">
                                       <label className="text-xs font-bold text-gray-500 uppercase">Nova Senha</label>
                                       <input 
                                         type="password" 
                                         className="w-full bg-tech-950 border border-tech-700 rounded p-3 text-gray-200 focus:border-[#dd9933] outline-none transition-colors" 
                                       />
                                   </div>
                                   <div className="space-y-2">
                                       <label className="text-xs font-bold text-gray-500 uppercase">Confirmar Nova Senha</label>
                                       <input 
                                         type="password" 
                                         className="w-full bg-tech-950 border border-tech-700 rounded p-3 text-gray-200 focus:border-[#dd9933] outline-none transition-colors" 
                                       />
                                   </div>
                                   <button className="bg-tech-800 hover:bg-tech-700 text-white font-bold uppercase text-xs px-6 py-3 rounded shadow-lg">
                                       Alterar Senha
                                   </button>
                               </div>
                           </div>
                       )}

                   </div>
               </div>
           </div>
       </div>
    </div>
  );
};

export default UserProfile;
