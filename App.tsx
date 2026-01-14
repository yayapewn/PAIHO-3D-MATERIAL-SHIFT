
import React, { useState, useRef, useEffect } from 'react';
import { Upload, Box, Check, Layers, X, Trash2, Sliders, Move, RotateCw, Maximize, Sun, Rotate3d, Lightbulb, Droplets, Hammer, Eye, Tag, AlignJustify, Share2, Download, Copy, Facebook, Twitter, MessageCircle, Link as LinkIcon, Palette, AlertTriangle, Sparkles, Loader2 } from 'lucide-react';
import ModelViewer from './components/ModelViewer';
import { TextureItem, SelectedPart, TextureConfig } from './types';
import { generateAiTexture } from './services/geminiService';

// 預設材質庫數據
const VAMP_TEXTURES: TextureItem[] = [
  { id: 'v1', name: '精細面料 01', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000601%20A%20WP_BASE.jpg' },
  { id: 'v2', name: '編織面料 02', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000716%20A%20WP_BASE.jpg' },
  { id: 'v3', name: '機能材質 03', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000820%20J%20WP_BASE.jpg' },
  { id: 'v4', name: '耐磨面料 04', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01305-01A-000A_BASE.jpg' },
  { id: 'v5', name: '透氣網布 05', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01317-01A-000A_BASE.jpg' },
  { id: 'v6', name: '數位紋理 06', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01436-01A-000A_BASE.jpg' },
];
const SHOELACE_TEXTURES: TextureItem[] = [
  { id: 's1', name: '熱情紅', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01305-01A-000A_BASE.jpg' },
  { id: 's2', name: '冷酷藍', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000601%20A%20WP_BASE.jpg' },
  { id: 's3', name: '極致黑', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01317-01A-000A_BASE.jpg' },
  { id: 's4', name: '鋼鐵灰', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000716%20A%20WP_BASE.jpg' },
  { id: 's5', name: '純潔白', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000820%20J%20WP_BASE.jpg' },
  { id: 's6', name: '森林綠', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01436-01A-000A_BASE.jpg' },
];
const LABEL_TEXTURES: TextureItem[] = [
  { id: 'l1', name: '皮革質地', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000716%20A%20WP_BASE.jpg' },
  { id: 'l2', name: '碳纖維紋', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01317-01A-000A_BASE.jpg' },
  { id: 'l3', name: '磨砂質感', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000820%20J%20WP_BASE.jpg' },
  { id: 'l4', name: '鏡面反射', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01305-01A-000A_BASE.jpg' },
  { id: 'l5', name: '粗糙織物', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01436-01A-000A_BASE.jpg' },
  { id: 'l6', name: '蜂巢結構', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000601%20A%20WP_BASE.jpg' },
];

const App: React.FC = () => {
  const [modelFile] = useState<File | null>(null);
  const [libraries, setLibraries] = useState({ vamp: VAMP_TEXTURES, shoelace: SHOELACE_TEXTURES, label: LABEL_TEXTURES });
  const [selectedPart, setSelectedPart] = useState<SelectedPart | null>(null);
  const [envPreset] = useState<string>('studio'); 
  const [envIntensity, setEnvIntensity] = useState<number>(0.2); 
  const [envRotation, setEnvRotation] = useState<number>(280); 
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [partTextures, setPartTextures] = useState<Record<string, TextureConfig | null>>({});

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isGeneratingScreenshot, setIsGeneratingScreenshot] = useState(false);
  const modelViewerRef = useRef<any>(null);

  // AI 紋理生成狀態
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // 初始化檢查（可選：用於確認 API KEY 狀態）
  useEffect(() => {
    console.log("PAIHO 3D SHIFT 已啟動 - 準備部署至公開網頁");
  }, []);

  const handleTextureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setLibraries(prev => ({ ...prev, vamp: [{ id: crypto.randomUUID(), name: file.name, url }, ...prev.vamp] }));
    }
  };

  const applyTexture = (texture: TextureItem) => {
    if (!selectedPart) return;
    setPartTextures(prev => {
      const existing = prev[selectedPart.id];
      if (existing) return { ...prev, [selectedPart.id]: { ...existing, url: texture.url } };
      return { 
        ...prev, 
        [selectedPart.id]: { 
            url: texture.url, 
            scale: 1, 
            offsetX: 0, 
            offsetY: 0, 
            rotation: 0, 
            roughness: 0.5, 
            metalness: 0, 
            opacity: 1 
        } 
      };
    });
  };

  const handleAiTextureGenerate = async () => {
    if (!aiPrompt.trim() || !selectedPart) return;
    setIsGeneratingAi(true);
    try {
        const imageUrl = await generateAiTexture(aiPrompt);
        const newTexture: TextureItem = {
            id: crypto.randomUUID(),
            name: `AI: ${aiPrompt}`,
            url: imageUrl,
            isAiGenerated: true
        };
        
        const partName = selectedPart.name;
        if (partName.includes('Shape027')) {
            setLibraries(prev => ({ ...prev, vamp: [newTexture, ...prev.vamp] }));
        } else if (partName.includes('Line040')) {
            setLibraries(prev => ({ ...prev, label: [newTexture, ...prev.label] }));
        } else {
            setLibraries(prev => ({ ...prev, vamp: [newTexture, ...prev.vamp] }));
        }

        applyTexture(newTexture);
        setAiPrompt('');
    } catch (error: any) {
        console.error(error);
        alert(`AI 生成失敗: ${error.message}`);
    } finally {
        setIsGeneratingAi(false);
    }
  };

  const updateTextureConfig = (key: keyof TextureConfig, value: any) => {
      if (!selectedPart) return;
      setPartTextures(prev => {
          const config = prev[selectedPart.id] || { 
            url: '', scale: 1, offsetX: 0, offsetY: 0, rotation: 0, roughness: 0.5, metalness: 0, opacity: 1 
          };
          return { ...prev, [selectedPart.id]: { ...config, [key]: value } };
      });
  };

  const currentTextureConfig = selectedPart ? partTextures[selectedPart.id] : null;
  const currentColorHex = currentTextureConfig?.color || '#ffffff';

  const getVisibleLibraries = () => {
    if (!selectedPart) return { vamp: false, shoelace: false, label: false };
    const name = selectedPart.name;
    return {
        vamp: name.includes('Shape027'),
        shoelace: name.includes('Shape026'),
        label: name.includes('Line040')
    };
  };

  const visibleLibs = getVisibleLibraries();

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white overflow-hidden font-sans">
      <header className="flex items-center justify-between px-6 py-4 bg-[#111] border-b border-gray-800 shrink-0 shadow-2xl z-20">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <Box className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tighter uppercase italic">
            PAIHO <span className="text-indigo-500">3D SHIFT</span>
            <span className="text-[10px] font-normal text-gray-500 ml-3 bg-gray-800 px-2 py-0.5 rounded-full not-italic tracking-normal">v3.1.0</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
            <button onClick={async () => {
                setIsShareModalOpen(true);
                setIsGeneratingScreenshot(true);
                setTimeout(async () => {
                    const dataUrl = await modelViewerRef.current?.captureComposition();
                    setScreenshotUrl(dataUrl);
                    setIsGeneratingScreenshot(false);
                }, 800);
            }} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-bold transition active:scale-95 shadow-xl shadow-indigo-600/20">
                <Share2 size={16} /> 分享設計
            </button>
            <button onClick={() => setAutoRotate(!autoRotate)} className={`px-4 py-2.5 rounded-xl border text-sm transition font-bold ${autoRotate ? 'bg-indigo-600 border-indigo-500' : 'bg-[#1a1a1a] border-gray-800 hover:bg-gray-800'}`}>
                <RotateCw size={16} className={autoRotate ? 'animate-spin' : ''} />
            </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 relative bg-[#0f0f0f]">
           <ModelViewer 
             ref={modelViewerRef} modelFile={modelFile} selectedPart={selectedPart} onPartSelect={setSelectedPart}
             textureMap={partTextures} envPreset={envPreset} envIntensity={envIntensity} envRotation={envRotation} autoRotate={autoRotate}
           />
        </div>

        <div className="w-[400px] bg-[#111] border-l border-gray-800 flex flex-col shrink-0 z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] overflow-y-auto p-8 space-y-10 scrollbar-hide">
            {!selectedPart ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-6 text-gray-500 animate-in fade-in duration-700">
                    <div className="relative">
                        <div className="p-10 bg-[#1a1a1a] rounded-[40px] shadow-2xl border border-gray-800">
                            <Move size={56} className="opacity-20 text-indigo-500 animate-pulse" />
                        </div>
                        <div className="absolute -top-2 -right-2 bg-indigo-600 p-2 rounded-full shadow-lg">
                            <Sparkles size={16} className="text-white" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-lg font-black text-gray-300">選取部位進行客製</p>
                        <p className="text-xs text-gray-600 leading-relaxed max-w-[200px] mx-auto">
                            直接點擊 3D 模型上的部件，<br/>即可開啟高級材質庫與 AI 生成器。
                        </p>
                    </div>
                </div>
            ) : (
                 <div key={selectedPart.id} className="space-y-10 animate-in fade-in slide-in-from-right-10 duration-500 ease-out">
                    <div className="flex items-center justify-between pb-6 border-b border-gray-800/50">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-400 font-bold mb-1">正在客製化部件</p>
                            <h2 className="text-2xl font-black tracking-tight">{selectedPart.name}</h2>
                        </div>
                        <button onClick={() => setSelectedPart(null)} className="p-3 bg-[#1a1a1a] hover:bg-red-500/10 hover:text-red-500 rounded-2xl transition-all border border-gray-800"><X size={20}/></button>
                    </div>

                    <div className="space-y-4">
                        <div className="flex gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest mb-1">
                            <Sparkles size={14} className="animate-pulse" /> AI 智能紋理生成
                        </div>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAiTextureGenerate()}
                                placeholder="描述想要生成的材質細節..." 
                                className="w-full bg-[#0a0a0a] border border-gray-800 focus:border-indigo-500 rounded-2xl px-5 py-4 text-sm focus:outline-none transition-all pr-14 placeholder:text-gray-700 font-medium"
                            />
                            <button 
                                onClick={handleAiTextureGenerate}
                                disabled={isGeneratingAi || !aiPrompt.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-xl transition-all shadow-lg active:scale-90"
                            >
                                {isGeneratingAi ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-500 font-medium italic">Gemini 視覺引擎將為您創造專屬的無縫 3D 貼圖</p>
                    </div>

                    {currentTextureConfig && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest">
                                <Sliders className="w-4 h-4" /> 材質細節設定
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="bg-[#1a1a1a] p-5 rounded-3xl border border-gray-800/50 space-y-4 shadow-inner">
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                            <span>紋理縮放</span>
                                            <span className="text-indigo-400">{currentTextureConfig.scale.toFixed(1)}x</span>
                                        </div>
                                        <input type="range" min="0.1" max="10" step="0.1" value={currentTextureConfig.scale} onChange={(e) => updateTextureConfig('scale', parseFloat(e.target.value))} className="w-full accent-indigo-500 h-1.5" />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                            <span>旋轉角度</span>
                                            <span className="text-indigo-400">{Math.round(currentTextureConfig.rotation)}°</span>
                                        </div>
                                        <input type="range" min="0" max="360" value={currentTextureConfig.rotation} onChange={(e) => updateTextureConfig('rotation', parseFloat(e.target.value))} className="w-full accent-indigo-500 h-1.5" />
                                    </div>
                                </div>
                                
                                <div className="bg-[#1a1a1a] p-5 rounded-3xl border border-gray-800/50 space-y-4 shadow-inner">
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                            <span>表面粗糙度</span>
                                            <span className="text-blue-400">{currentTextureConfig.roughness.toFixed(2)}</span>
                                        </div>
                                        <input type="range" min="0" max="1" step="0.05" value={currentTextureConfig.roughness} onChange={(e) => updateTextureConfig('roughness', parseFloat(e.target.value))} className="w-full accent-blue-500 h-1.5" />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                            <span>金屬感強度</span>
                                            <span className="text-blue-400">{currentTextureConfig.metalness.toFixed(2)}</span>
                                        </div>
                                        <input type="range" min="0" max="1" step="0.05" value={currentTextureConfig.metalness} onChange={(e) => updateTextureConfig('metalness', parseFloat(e.target.value))} className="w-full accent-blue-500 h-1.5" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-6">
                        {visibleLibs.vamp && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500">
                            <div className="flex justify-between items-center mb-5">
                                <div className="flex gap-2 text-blue-400 font-bold text-xs uppercase tracking-widest">
                                    <Layers size={14} /> 核心材質庫
                                </div>
                                <label className="text-[10px] cursor-pointer text-gray-500 hover:text-white flex items-center gap-1 font-bold uppercase tracking-tighter transition-colors">
                                    <Upload size={12}/> 上傳自定義
                                    <input type="file" className="hidden" onChange={handleTextureUpload} />
                                </label>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                {libraries.vamp.map(t => (
                                    <button 
                                        key={t.id} 
                                        onClick={() => applyTexture(t)} 
                                        className={`group relative aspect-square rounded-2xl border-2 overflow-hidden transition-all duration-500 transform active:scale-90 ${currentTextureConfig?.url === t.url ? 'border-indigo-500 ring-4 ring-indigo-500/20 shadow-2xl scale-105 z-10' : 'border-[#1a1a1a] hover:border-gray-600 bg-[#0a0a0a]'}`}
                                    >
                                        <img src={t.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={t.name} />
                                        {t.isAiGenerated && (
                                            <div className="absolute top-2 right-2 bg-indigo-600 p-1.5 rounded-lg shadow-xl">
                                                <Sparkles size={10} className="text-white" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="text-[10px] font-black uppercase text-white tracking-widest">套用</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        )}
                        
                        {visibleLibs.shoelace && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500">
                            <div className="flex gap-2 text-purple-400 font-bold text-xs uppercase tracking-widest mb-5">
                                <Palette size={14} /> 色彩自定義
                            </div>
                            <div className="bg-[#1a1a1a] p-6 rounded-[32px] border border-gray-800 flex items-center gap-6 group shadow-inner">
                                <div className="relative w-16 h-16 rounded-[24px] overflow-hidden border-2 border-gray-700 shadow-2xl transform transition-transform group-hover:rotate-12">
                                    <input 
                                        type="color" 
                                        value={currentColorHex} 
                                        onChange={(e) => updateTextureConfig('color', e.target.value)} 
                                        className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer scale-150" 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] text-gray-500 uppercase font-black tracking-[0.2em]">顏色代碼 Hex</div>
                                    <div className="text-xl font-black uppercase text-purple-400 tracking-tighter">{currentColorHex}</div>
                                </div>
                            </div>
                        </div>
                        )}
                        
                        {visibleLibs.label && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500">
                            <div className="flex gap-2 text-pink-400 font-bold text-xs uppercase tracking-widest mb-5">
                                <Tag size={14} /> 細節部件紋理
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                {libraries.label.map(t => (
                                    <button 
                                        key={t.id} 
                                        onClick={() => applyTexture(t)} 
                                        className={`group relative aspect-square rounded-2xl border-2 overflow-hidden transition-all duration-500 transform active:scale-90 ${currentTextureConfig?.url === t.url ? 'border-pink-500 ring-4 ring-pink-500/20 shadow-2xl scale-105 z-10' : 'border-[#1a1a1a] hover:border-gray-600 bg-[#0a0a0a]'}`}
                                    >
                                        <img src={t.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={t.name} />
                                        {t.isAiGenerated && (
                                            <div className="absolute top-2 right-2 bg-indigo-600 p-1.5 rounded-lg">
                                                <Sparkles size={10} className="text-white" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                        )}
                    </div>
                 </div>
            )}

            <div className="pt-10 mt-auto border-t border-gray-800/50">
                <div className="flex items-center gap-2 text-orange-400 font-bold text-xs uppercase tracking-widest mb-5">
                    <Sun className="w-4 h-4" /> 環境光
                </div>
                <div className="bg-[#1a1a1a] p-6 rounded-[32px] border border-gray-800/50 space-y-6 shadow-inner">
                    <div className="space-y-3">
                        <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-gray-500">
                            <span>亮度</span>
                            <span className="text-orange-400">{envIntensity.toFixed(1)}x</span>
                        </div>
                        <input type="range" min="0" max="3" step="0.1" value={envIntensity} onChange={(e) => setEnvIntensity(parseFloat(e.target.value))} className="w-full accent-orange-500 h-1.5" />
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-gray-500">
                            <span>光源角度</span>
                            <span className="text-orange-400">{Math.round(envRotation)}°</span>
                        </div>
                        <input type="range" min="0" max="360" step="1" value={envRotation} onChange={(e) => setEnvRotation(parseFloat(e.target.value))} className="w-full accent-orange-500 h-1.5" />
                    </div>
                </div>
            </div>
          </div>
      </div>

       {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4">
            <div className="bg-white text-[#111] rounded-[48px] w-full max-w-4xl overflow-hidden shadow-[0_0_100px_rgba(79,70,229,0.3)] animate-in zoom-in-95 duration-500">
                <div className="flex items-center justify-between p-10 border-b border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-600 p-3 rounded-3xl shadow-xl">
                            <Share2 size={32} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black tracking-tighter">分享您的設計</h2>
                            <p className="text-[10px] text-gray-400 font-black tracking-[0.4em] mt-1">PAIHO 3D SHIFT MULTI-VIEW RENDER</p>
                        </div>
                    </div>
                    <button onClick={() => setIsShareModalOpen(false)} className="p-4 hover:bg-gray-100 rounded-full transition-all text-gray-400 hover:text-black hover:rotate-90"><X size={32}/></button>
                </div>
                <div className="p-10">
                    {isGeneratingScreenshot ? (
                        <div className="h-[400px] flex flex-col items-center justify-center text-gray-400 space-y-8">
                            <div className="relative">
                                <div className="animate-spin rounded-full h-24 w-24 border-[6px] border-gray-100 border-t-indigo-600"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Box size={32} className="text-indigo-600 animate-pulse" />
                                </div>
                            </div>
                            <div className="text-center space-y-2">
                                <p className="font-black text-lg tracking-[0.1em] text-gray-800 uppercase italic">正在進行高品質雲端渲染...</p>
                                <p className="text-xs font-bold text-gray-400 tracking-widest uppercase">正在合成 2K UHD 多視角全景圖</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-10">
                            <div className="group relative overflow-hidden rounded-[40px] border-[8px] border-gray-50 shadow-inner bg-gray-50">
                                <img src={screenshotUrl!} className="w-full transition-transform duration-1000 group-hover:scale-110" alt="渲染預覽" />
                                <div className="absolute top-6 left-6 bg-black/80 text-white text-[10px] px-4 py-2 rounded-full font-black tracking-widest shadow-2xl backdrop-blur-md">ULTRA HD RENDER</div>
                                <div className="absolute bottom-6 right-6 flex gap-2">
                                    <div className="bg-white/90 p-3 rounded-2xl shadow-lg"><Copy size={20} className="text-gray-700" /></div>
                                    <div className="bg-white/90 p-3 rounded-2xl shadow-lg"><Twitter size={20} className="text-sky-500" /></div>
                                </div>
                            </div>
                            <div className="flex gap-6">
                                <a href={screenshotUrl!} download="paiho-3d-design.png" className="flex-1 flex justify-center items-center gap-4 bg-indigo-600 hover:bg-indigo-700 text-white py-6 rounded-[32px] font-black text-2xl transition-all shadow-[0_20px_40px_rgba(79,70,229,0.3)] active:scale-95 group">
                                    <Download size={28} className="group-hover:translate-y-1 transition-transform" /> 下載高畫質圖檔
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
