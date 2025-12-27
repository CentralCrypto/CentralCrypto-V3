
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
            <button type="button" onClick={() => setMode('visual')} className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1 ${mode === 'visual' ? 'bg-white dark:bg-tech-950 text-tech-accent shadow' : 'text-gray-500'}`}><Eye size={10} /> Visual</button>
            <button type="button" onClick={() => setMode('code')} className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1 ${mode === 'code' ? 'bg-white dark:bg-tech-950 text-tech-accent shadow' : 'text-gray-500'}`}><Code size={10} /> HTML</button>
        </div>
      </div>
      <div className="border border-gray-300 dark:border-tech-700 rounded-lg overflow-hidden bg-white dark:bg-tech-950">
        <div className="flex flex-wrap gap-1 p-1 bg-gray-100 dark:bg-tech-800 border-b border-gray-300 dark:border-tech-700">
          {mode === 'visual' && (
              <>
                <button type="button" onClick={() => executeCommand('bold')} className="p-1.5 hover:bg-white dark:hover:bg-tech-700 rounded text-gray-700 dark:text-gray-300"><Bold className="w-3 h-3"/></button>
                <button type="button" onClick={() => executeCommand('italic')} className="p-1.5 hover:bg-white dark:hover:bg-tech-700 rounded text-gray-700 dark:text-gray-300"><Italic className="w-3 h-3"/></button>
                <button type="button" onClick={() => executeCommand('underline')} className="p-1.5 hover:bg-white dark:hover:bg-tech-700 rounded text-gray-700 dark:text-gray-300"><Underline className="w-3 h-3"/></button>
                <button type="button" onClick={() => executeCommand('formatBlock', 'H3')} className="p-1.5 hover:bg-white dark:hover:bg-tech-700 rounded text-gray-700 dark:text-gray-300"><Heading className="w-3 h-3"/></button>
                <button type="button" onClick={() => executeCommand('insertUnorderedList')} className="p-1.5 hover:bg-white dark:hover:bg-tech-700 rounded text-gray-700 dark:text-gray-300"><List className="w-3 h-3"/></button>
              </>
          )}
        </div>
        {mode === 'visual' ? (
            <div ref={editorRef} contentEditable onInput={handleVisualInput} onPaste={handlePaste} className="w-full p-4 min-h-[300px] max-h-[500px] overflow-y-auto outline-none prose prose-sm dark:prose-invert max-w-none" />
        ) : (
            <textarea ref={textareaRef} rows={15} value={value || ''} onChange={e => onChange(e.target.value)} className="w-full p-3 bg-tech-950 text-green-400 outline-none font-mono text-xs resize-y" />
        )}
      </div>
    </div>
  );
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ onSave, onCancel, initialData }) => {
  const [formData, setFormData] = useState<Partial<Indicator>>({ price: 'Script Protegido', type: 'Indicator', tags: [], likes: 0, comments: 0, features: ['Alta Performance'] });
  const [currentTag, setCurrentTag] = useState('');
  const [tvUrl, setTvUrl] = useState('');
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
      // Confia apenas no scraper do backend para evitar CORS
      const res = await fetch(`${WP_SCRAPE_URL}?url=${encodeURIComponent(tvUrl)}`);
      if (res.ok) {
          const scraped = await res.json();
          setFormData(prev => ({
            ...prev,
            id: scraped.id || prev.id,
            title: scraped.title || prev.title,
            description: scraped.description || prev.description,
            fullDescription: scraped.fullDescription || prev.fullDescription,
            originalUrl: tvUrl,
            imageUrl: scraped.imageUrl || prev.imageUrl
          }));
      }
    } catch (error) {
      console.error(error);
      alert("Erro no auto-fill. Preencha manualmente.");
    } finally {
      setIsScraping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    try {
        await onSave({ ...formData, originalUrl: tvUrl } as Indicator);
        setSaveStatus('success');
        setTimeout(onCancel, 1500);
    } catch (e) { setSaveStatus('error'); }
  };

  return (
    <div className="pt-24 pb-12 px-4 max-w-4xl mx-auto">
      <div className="bg-white dark:bg-tech-900 border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-tech-700 flex justify-between items-center bg-gray-100 dark:bg-tech-950">
          <div className="flex items-center gap-2"><Wand2 className="w-5 h-5 text-tech-accent" /><h2 className="text-xl font-bold dark:text-white">Editor de Indicador</h2></div>
          <button onClick={onCancel}><X className="w-6 h-6 text-gray-500" /></button>
        </div>
        <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-bold dark:text-gray-300">URL do TradingView</label>
                <div className="flex gap-2">
                  <input type="text" value={tvUrl} onChange={(e) => setTvUrl(e.target.value)} className="flex-1 bg-white dark:bg-tech-950 border border-gray-300 dark:border-tech-700 rounded-lg px-4 py-2 dark:text-white text-sm" />
                  <button type="button" onClick={handleAutoFill} disabled={isScraping} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                    {isScraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Auto
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold dark:text-gray-300">Título *</label>
                <input type="text" required value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-white dark:bg-tech-950 border border-gray-300 dark:border-tech-700 rounded-lg px-4 py-2 dark:text-white" />
              </div>
              <TagEditor label="Descrição Completa (PT)" value={formData.fullDescription || ''} onChange={val => setFormData({...formData, fullDescription: val})} />
              <div className="flex justify-end gap-3 pt-6 border-t dark:border-tech-700">
                <button type="button" onClick={onCancel} className="px-6 py-2 rounded-lg border border-gray-300 dark:text-gray-300">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-tech-accent text-white rounded-lg font-bold shadow-lg">Salvar</button>
              </div>
            </form>
        </div>
      </div>
    </div>
  );
};
