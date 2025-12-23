
import React, { useState, useEffect, useRef } from 'react';
import {
  X, Save, Wand2, Copy, Code, Loader2,
  Bold, Italic, Underline, Link as LinkIcon,
  Heading, List, AlignCenter, WrapText, Database, Image as ImageIcon, Eye, Type, Languages, Check, AlertTriangle
} from 'lucide-react';
import { Indicator, Language } from '../../../types';
import { WP_SCRAPE_URL } from '../constants';

interface AdminPanelProps {
  onSave: (indicator: Indicator) => Promise<void>;
  onCancel: () => void;
  initialData?: Indicator;
}

// --- VISUAL / CODE EDITOR COMPONENT ---
const TagEditor: React.FC<{
  value: string;
  onChange: (val: string) => void;
  label: string;
}> = ({ value, onChange, label }) => {
  const [mode, setMode] = useState<'visual' | 'code'>('visual');
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (mode === 'visual' && editorRef.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
  }, [value, mode]);

  const handleVisualInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const executeCommand = (command: string, arg?: string) => {
    if (mode !== 'visual') return;
    document.execCommand(command, false, arg);
    handleVisualInput();
    editorRef.current?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (mode === 'visual') {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          const blob = items[i].getAsFile();
          if (!blob) continue;
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            if (base64) {
              document.execCommand('insertImage', false, base64);
              handleVisualInput();
            }
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-end">
        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{label}</label>
        <div className="flex bg-gray-200 dark:bg-tech-800 rounded p-0.5 gap-1">
            <button 
                type="button"
                onClick={() => setMode('visual')} 
                className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1 ${mode === 'visual' ? 'bg-white dark:bg-tech-950 text-tech-accent shadow' : 'text-gray-500'}`}
            >
                <Eye size={10} /> Visual
            </button>
            <button 
                type="button"
                onClick={() => setMode('code')} 
                className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1 ${mode === 'code' ? 'bg-white dark:bg-tech-950 text-tech-accent shadow' : 'text-gray-500'}`}
            >
                <Code size={10} /> HTML
            </button>
        </div>
      </div>
      
      <div className="border border-gray-300 dark:border-tech-700 rounded-lg overflow-hidden bg-white dark:bg-tech-950 transition-colors">
        <div className="flex flex-wrap gap-1 p-1 bg-gray-100 dark:bg-tech-800 border-b border-gray-300 dark:border-tech-700">
          {mode === 'visual' ? (
              <>
                <button type="button" onClick={() => executeCommand('bold')} className="p-1.5 hover:bg-white dark:hover:bg-tech-700 rounded text-gray-700 dark:text-gray-300" title="Negrito"><Bold className="w-3 h-3"/></button>
                <button type="button" onClick={() => executeCommand('italic')} className="p-1.5 hover:bg-white dark:hover:bg-tech-700 rounded text-gray-700 dark:text-gray-300" title="Itálico"><Italic className="w-3 h-3"/></button>
                <button type="button" onClick={() => executeCommand('underline')} className="p-1.5 hover:bg-white dark:hover:bg-tech-700 rounded text-gray-700 dark:text-gray-300" title="Sublinhado"><Underline className="w-3 h-3"/></button>
                <div className="w-px bg-gray-300 dark:bg-tech-600 mx-1"></div>
                <button type="button" onClick={() => executeCommand('formatBlock', 'H3')} className="p-1.5 hover:bg-white dark:hover:bg-tech-700 rounded text-gray-700 dark:text-gray-300" title="Título H3"><Heading className="w-3 h-3"/></button>
                <button type="button" onClick={() => executeCommand('insertUnorderedList')} className="p-1.5 hover:bg-white dark:hover:bg-tech-700 rounded text-gray-700 dark:text-gray-300" title="Lista"><List className="w-3 h-3"/></button>
                <button type="button" onClick={() => executeCommand('justifyCenter')} className="p-1.5 hover:bg-white dark:hover:bg-tech-700 rounded text-gray-700 dark:text-gray-300" title="Centralizar"><AlignCenter className="w-3 h-3"/></button>
                <div className="w-px bg-gray-300 dark:bg-tech-600 mx-1"></div>
                <button type="button" onClick={() => {
                    const url = prompt('URL do Link:');
                    if(url) executeCommand('createLink', url);
                }} className="p-1.5 hover:bg-white dark:hover:bg-tech-700 rounded text-gray-700 dark:text-gray-300" title="Link"><LinkIcon className="w-3 h-3"/></button>
              </>
          ) : (
              <span className="text-[10px] text-gray-500 p-1.5 font-mono">Modo Código Fonte (HTML Puro)</span>
          )}
        </div>

        {mode === 'visual' ? (
            <div
                ref={editorRef}
                contentEditable
                onInput={handleVisualInput}
                onPaste={handlePaste}
                className="w-full p-4 min-h-[300px] max-h-[500px] overflow-y-auto outline-none prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200"
                style={{ whiteSpace: 'pre-wrap' }}
            />
        ) : (
            <textarea
                ref={textareaRef}
                rows={15}
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                className="w-full p-3 bg-tech-950 text-green-400 outline-none font-mono text-xs leading-5 resize-y"
                placeholder="HTML Code..."
            />
        )}
      </div>
      <p className="text-[10px] text-gray-500 flex justify-between">
          <span>{mode === 'visual' ? 'Cole imagens (Ctrl+V) diretamente.' : 'Edite as tags HTML manualmente.'}</span>
      </p>
    </div>
  );
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ onSave, onCancel, initialData }) => {
  const [formData, setFormData] = useState<Partial<Indicator>>({
    price: 'Script Protegido',
    type: 'Indicator',
    tags: [],
    likes: 0,
    comments: 0,
    features: ['Alta Performance', 'Não Repinta']
  });

  const [currentTag, setCurrentTag] = useState('');
  const [tvUrl, setTvUrl] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [isScraping, setIsScraping] = useState(false);
  const [activeTab, setActiveTab] = useState<Language>('pt');

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setTvUrl(initialData.originalUrl || '');
    }
  }, [initialData]);

  const handleAutoFill = async () => {
    if (!tvUrl) return;
    setIsScraping(true);

    try {
      const regex = /\/script\/([a-zA-Z0-9]+)-([a-zA-Z0-9-]+)\/?/;
      const match = tvUrl.match(regex);
      const localId = match ? match[1] : (initialData?.id || '');
      
      let scrapedData: any = {};
      let fullTextHTML = "";

      const [backendRes, proxyRes] = await Promise.allSettled([
          fetch(`${WP_SCRAPE_URL}?url=${encodeURIComponent(tvUrl)}`),
          fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(tvUrl)}`)
      ]);

      if (backendRes.status === 'fulfilled' && backendRes.value.ok) {
          try { scrapedData = await backendRes.value.json(); } catch(e) {}
      }

      if (proxyRes.status === 'fulfilled' && proxyRes.value.ok) {
          try {
              const proxyJson = await proxyRes.value.json();
              if (proxyJson.contents) {
                  const parser = new DOMParser();
                  const doc = parser.parseFromString(proxyJson.contents, 'text/html');
                  const descContainer = doc.querySelector('.js-script-description') || doc.querySelector('.tv-chart-view__description-wrap');
                  
                  const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
                  let jsonDesc = "";
                  
                  jsonLdScripts.forEach(script => {
                      try {
                          const json = JSON.parse(script.textContent || '{}');
                          if (json.articleBody) jsonDesc = json.articleBody;
                          else if (json.description && json.description.length > 200) jsonDesc = json.description;
                      } catch (e) {}
                  });

                  if (jsonDesc) {
                      fullTextHTML = jsonDesc.replace(/\n/g, '<br/>');
                  } else if (descContainer) {
                      descContainer.querySelectorAll('script, style, .tv-chart-view__disclaimer').forEach(el => el.remove());
                      fullTextHTML = descContainer.innerHTML.trim();
                  }

                  if (!scrapedData.title) scrapedData.title = doc.querySelector('h1')?.textContent?.trim();
                  if (!scrapedData.image) {
                      const imgMeta = doc.querySelector('meta[property="og:image"]');
                      if (imgMeta) scrapedData.image = imgMeta.getAttribute('content');
                  }
              }
          } catch(e) { console.warn("Proxy parse error", e); }
      }

      let finalImage = scrapedData.image || scrapedData.imageUrl || '';
      if (!finalImage && localId) {
          finalImage = `https://s3.tradingview.com/g/${localId}_mid.webp`;
      } else if (finalImage.includes('/b/')) {
          finalImage = finalImage.replace('/b/', '/g/');
      }

      setFormData(prev => ({
        ...prev,
        id: localId || prev.id,
        title: scrapedData.title || prev.title,
        description: scrapedData.description || prev.description,
        fullDescription: fullTextHTML || prev.fullDescription,
        originalUrl: tvUrl,
        imageUrl: finalImage || prev.imageUrl
      }));

    } catch (error) {
      console.error(error);
      alert("Erro ao buscar dados. Tente preencher manualmente.");
    } finally {
      setIsScraping(false);
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const addTag = () => {
    const val = currentTag.replace(/#/g, '').trim();
    if (val && formData.tags && !formData.tags.includes(val)) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), val]
      }));
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove)
    }));
  };

  const generatePermanentCode = () => {
    if (!formData.title) {
      alert("Preencha pelo menos o título para gerar o código.");
      return;
    }
    const finalId = formData.id || Math.random().toString(36).substr(2, 8);
    const codeString = JSON.stringify({ ...formData, id: finalId }, null, 2);
    setGeneratedCode(codeString);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedCode);
    alert("JSON copiado!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveStatus !== 'idle') return;

    setSaveStatus('saving');
    
    let finalTags = formData.tags || [];
    const pendingTag = currentTag.replace(/#/g, '').trim();
    if (pendingTag && !finalTags.includes(pendingTag)) finalTags = [...finalTags, pendingTag];

    const newIndicator: Indicator = {
      ...(formData as Indicator),
      id: formData.id || Math.random().toString(36).substr(2, 9),
      tags: finalTags,
      originalUrl: formData.originalUrl || tvUrl
    };

    try {
        await onSave(newIndicator);
        setSaveStatus('success');
        
        // Wait 1.5s then close
        setTimeout(() => {
            onCancel();
        }, 1500);
    } catch (e) {
        setSaveStatus('error');
        // Reset to idle after 3s to allow retry
        setTimeout(() => {
            setSaveStatus('idle');
        }, 3000);
    }
  };

  return (
    <div className="pt-24 pb-12 px-4 max-w-4xl mx-auto">
      <div className="bg-white dark:bg-tech-900 border border-gray-200 dark:border-tech-700 rounded-xl shadow-2xl overflow-hidden transition-colors">
        <div className="p-6 border-b border-gray-200 dark:border-tech-700 flex justify-between items-center bg-gray-100 dark:bg-tech-950 transition-colors">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-tech-accent rounded text-white"><Wand2 className="w-5 h-5" /></div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Editor de Indicador</h2>
          </div>
          <button onClick={onCancel}><X className="w-6 h-6 text-gray-500 hover:text-red-500" /></button>
        </div>

        <div className="p-6">
            <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-200 flex gap-2 items-start">
                <Database className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="font-bold">Banco de Dados Conectado:</p>
                    <p>Dados enviados para a tabela <code className="bg-white dark:bg-black px-1 rounded font-mono font-bold">cct2_indicators</code>.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">1. Cole a URL do TradingView</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tvUrl}
                    onChange={(e) => setTvUrl(e.target.value)}
                    placeholder="https://www.tradingview.com/script/..."
                    className="flex-1 bg-white dark:bg-tech-950 border border-gray-300 dark:border-tech-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-tech-accent outline-none text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAutoFill}
                    disabled={isScraping}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition-colors text-sm flex items-center gap-2 disabled:opacity-70"
                  >
                    {isScraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} {isScraping ? 'Buscando...' : 'Auto'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Título *</label>
                <input
                  type="text"
                  required
                  value={formData.title || ''}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-white dark:bg-tech-950 border border-gray-300 dark:border-tech-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white outline-none focus:border-tech-accent"
                />
              </div>

              <div className="pt-2">
                <div className="flex items-center gap-2 mb-2">
                    <Languages className="w-4 h-4 text-tech-accent" />
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Traduções</label>
                </div>
                <div className="flex gap-1 bg-gray-100 dark:bg-tech-800 p-1 rounded-lg mb-4 border border-gray-200 dark:border-tech-700">
                  {(['pt', 'en', 'es'] as const).map(lang => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setActiveTab(lang)}
                      className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === lang ? 'bg-tech-accent text-white shadow-lg transform scale-105' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 hover:bg-white dark:hover:bg-tech-700'}`}
                    >
                      {lang === 'pt' ? '🇧🇷 PT-BR' : lang === 'en' ? '🇺🇸 EN-US' : '🇪🇸 ES'}
                    </button>
                  ))}
                </div>

                <div className="animate-fade-in">
                    {activeTab === 'pt' && (
                    <>
                        <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Resumo (PT)</label>
                        <textarea
                            rows={2}
                            value={formData.description || ''}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full bg-white dark:bg-tech-950 border border-gray-300 dark:border-tech-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white"
                        />
                        </div>
                        <TagEditor 
                        label="Texto Completo (PT) - Cole imagens aqui" 
                        value={formData.fullDescription || ''} 
                        onChange={(val) => setFormData(prev => ({...prev, fullDescription: val}))} 
                        />
                    </>
                    )}

                    {activeTab === 'en' && (
                    <>
                        <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Summary (EN)</label>
                        <textarea
                            rows={2}
                            value={formData.description_en || ''}
                            onChange={e => setFormData({ ...formData, description_en: e.target.value })}
                            className="w-full bg-white dark:bg-tech-950 border border-gray-300 dark:border-tech-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white"
                        />
                        </div>
                        <TagEditor 
                        label="Full Text (EN)" 
                        value={formData.fullDescription_en || ''} 
                        onChange={(val) => setFormData(prev => ({...prev, fullDescription_en: val}))} 
                        />
                    </>
                    )}

                    {activeTab === 'es' && (
                    <>
                        <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Resumen (ES)</label>
                        <textarea
                            rows={2}
                            value={formData.description_es || ''}
                            onChange={e => setFormData({ ...formData, description_es: e.target.value })}
                            className="w-full bg-white dark:bg-tech-950 border border-gray-300 dark:border-tech-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white"
                        />
                        </div>
                        <TagEditor 
                        label="Texto Completo (ES)" 
                        value={formData.fullDescription_es || ''} 
                        onChange={(val) => setFormData(prev => ({...prev, fullDescription_es: val}))} 
                        />
                    </>
                    )}
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Tags</label>
                <div className="w-full bg-white dark:bg-tech-950 border border-gray-300 dark:border-tech-700 rounded-lg px-2 py-2 flex flex-wrap gap-2 items-center">
                  {formData.tags?.map((tag, i) => (
                    <span key={i} className="bg-tech-accent text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                      #{tag} <button type="button" onClick={() => removeTag(tag)}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={currentTag}
                    onChange={e => setCurrentTag(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    onBlur={addTag}
                    className="bg-transparent outline-none flex-1 min-w-[100px] text-sm text-gray-900 dark:text-white"
                    placeholder="Digite tag..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Tipo</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full mt-1 bg-white dark:bg-tech-950 border border-gray-300 dark:border-tech-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-tech-accent"
                  >
                    <option value="Indicator">Indicador</option>
                    <option value="Strategy">Estratégia</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Acesso</label>
                  <select
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                    className="w-full mt-1 bg-white dark:bg-tech-950 border border-gray-300 dark:border-tech-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-tech-accent"
                  >
                    <option value="Script Protegido">Protegido</option>
                    <option value="Script Aberto">Aberto</option>
                    <option value="Grátis">Grátis</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Badge (Destaque)</label>
                <select
                  value={formData.badge || ''}
                  onChange={e => setFormData({ ...formData, badge: e.target.value as any })}
                  className="w-full bg-white dark:bg-tech-950 border border-gray-300 dark:border-tech-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white outline-none focus:border-tech-accent text-sm"
                >
                  <option value="">Nenhum</option>
                  <option value="VIP">VIP (Coroa Amarela)</option>
                  <option value="Editor's Pick">Editor's Pick (Estrela Laranja)</option>
                  <option value="New">New (Verde)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">URL Imagem</label>
                <input
                  type="text"
                  value={formData.imageUrl || ''}
                  onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full mt-1 bg-white dark:bg-tech-950 border border-gray-300 dark:border-tech-700 rounded-lg px-4 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-tech-accent"
                />
                {formData.imageUrl && <img src={formData.imageUrl} className="mt-2 h-20 rounded border border-gray-600" alt="preview" />}
              </div>

              {generatedCode && (
                  <div className="mt-6 mb-6 animate-fade-in p-4 bg-gray-100 dark:bg-black/30 rounded-lg border border-gray-300 dark:border-tech-800">
                      <div className="flex justify-between items-center mb-2">
                          <label className="block text-xs font-bold text-gray-500 uppercase">JSON Gerado (Backup)</label>
                          <button onClick={() => setGeneratedCode('')} className="text-xs text-red-500 hover:underline">Fechar</button>
                      </div>
                      <div className="relative">
                          <textarea readOnly value={generatedCode} className="w-full h-32 bg-tech-950 text-green-400 font-mono text-xs p-4 rounded-lg border border-tech-700 outline-none resize-none" />
                          <button onClick={copyToClipboard} className="absolute top-2 right-2 bg-white text-black p-2 rounded hover:bg-gray-200 transition-colors" title="Copiar"><Copy className="w-4 h-4" /></button>
                      </div>
                  </div>
              )}

              <div className="flex justify-between items-center pt-6 border-t border-gray-200 dark:border-tech-700 mt-8">
                <button
                  type="button"
                  onClick={generatePermanentCode}
                  className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-tech-800 text-gray-700 dark:text-gray-300 font-bold text-sm flex items-center gap-2 hover:bg-gray-300 dark:hover:bg-tech-700 transition-colors"
                >
                  <Code className="w-4 h-4" /> Gerar JSON
                </button>

                <div className="flex gap-3">
                    <button type="button" onClick={onCancel} className="px-6 py-2 rounded-lg border border-gray-300 dark:border-tech-600 text-gray-700 dark:text-gray-300 font-bold text-sm hover:bg-gray-100 dark:hover:bg-tech-800 transition-colors">Cancelar</button>
                    
                    <button 
                        type="submit" 
                        disabled={saveStatus !== 'idle'} 
                        className={`px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all shadow-lg transform active:scale-95 disabled:opacity-80 disabled:cursor-not-allowed min-w-[120px] justify-center ${
                            saveStatus === 'success' ? 'bg-green-600 hover:bg-green-500 text-white' : 
                            saveStatus === 'error' ? 'bg-red-600 hover:bg-red-500 text-white' :
                            'bg-tech-accent hover:bg-amber-600 text-white'
                        }`}
                    >
                        {saveStatus === 'saving' ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                        ) : saveStatus === 'success' ? (
                            <><Check className="w-4 h-4" /> Salvo!</>
                        ) : saveStatus === 'error' ? (
                            <><AlertTriangle className="w-4 h-4" /> Erro!</>
                        ) : (
                            <><Save className="w-4 h-4" /> Salvar</>
                        )}
                    </button>
                </div>
              </div>
            </form>
        </div>
      </div>
    </div>
  );
};
