
import React, { useState, useRef } from 'react';
import { Upload, Box, Check, Layers, X, Trash2, Sliders, Move, RotateCw, Maximize, Sun, Rotate3d, Lightbulb, Droplets, Hammer, Eye, Tag, AlignJustify, Share2, Download, Copy, Facebook, Twitter, MessageCircle, Link as LinkIcon, Palette, AlertTriangle } from 'lucide-react';
import ModelViewer from './components/ModelViewer';
import { TextureItem, SelectedPart, TextureConfig } from './types';

// --- Color Conversion Utilities ---
function hexToRgb(hex: string) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt("0x" + hex[1] + hex[1]);
        g = parseInt("0x" + hex[2] + hex[2]);
        b = parseInt("0x" + hex[3] + hex[3]);
    } else if (hex.length === 7) {
        r = parseInt("0x" + hex[1] + hex[2]);
        g = parseInt("0x" + hex[3] + hex[4]);
        b = parseInt("0x" + hex[5] + hex[6]);
    }
    return { r, g, b };
}
function rgbToHex(r: number, g: number, b: number) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function rgbToXyz(r: number, g: number, b: number) {
    let rL = r / 255, gL = g / 255, bL = b / 255;
    rL = rL > 0.04045 ? Math.pow((rL + 0.055) / 1.055, 2.4) : rL / 12.92;
    gL = gL > 0.04045 ? Math.pow((gL + 0.055) / 1.055, 2.4) : gL / 12.92;
    bL = bL > 0.04045 ? Math.pow((bL + 0.055) / 1.055, 2.4) : bL / 12.92;
    return { x: (rL * 0.4124 + gL * 0.3576 + bL * 0.1805) * 100, y: (rL * 0.2126 + gL * 0.7152 + bL * 0.0722) * 100, z: (rL * 0.0193 + gL * 0.1192 + bL * 0.9505) * 100 };
}
function xyzToLab(x: number, y: number, z: number) {
    const refX = 95.047, refY = 100.0, refZ = 108.883;
    let xR = x / refX, yR = y / refY, zR = z / refZ;
    xR = xR > 0.008856 ? Math.cbrt(xR) : (7.787 * xR) + (16 / 116);
    yR = yR > 0.008856 ? Math.cbrt(yR) : (7.787 * yR) + (16 / 116);
    zR = zR > 0.008856 ? Math.cbrt(zR) : (7.787 * zR) + (16 / 116);
    return { l: (116 * yR) - 16, a: 500 * (xR - yR), b: 200 * (yR - zR) };
}
function labToXyz(l: number, a: number, b: number) {
    let y = (l + 16) / 116, x = a / 500 + y, z = y - b / 200;
    const x3 = Math.pow(x, 3), y3 = Math.pow(y, 3), z3 = Math.pow(z, 3);
    const refX = 95.047, refY = 100.0, refZ = 108.883;
    x = (x3 > 0.008856 ? x3 : (x - 16 / 116) / 7.787) * refX;
    y = (y3 > 0.008856 ? y3 : (y - 16 / 116) / 7.787) * refY;
    z = (z3 > 0.008856 ? z3 : (z - 16 / 116) / 7.787) * refZ;
    return { x, y, z };
}
function xyzToRgb(x: number, y: number, z: number) {
    let xR = x / 100, yR = y / 100, zR = z / 100;
    let r = xR * 3.2406 + yR * -1.5372 + zR * -0.4986;
    let g = xR * -0.9689 + yR * 1.8758 + zR * 0.0415;
    let b = xR * 0.0557 + yR * -0.2040 + zR * 1.0570;
    r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
    g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
    b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;
    return { r: Math.round(Math.max(0, Math.min(1, r)) * 255), g: Math.round(Math.max(0, Math.min(1, g)) * 255), b: Math.round(Math.max(0, Math.min(1, b)) * 255) };
}
function hexToLab(hex: string) { const rgb = hexToRgb(hex); const xyz = rgbToXyz(rgb.r, rgb.g, rgb.b); return xyzToLab(xyz.x, xyz.y, xyz.z); }
function labToHex(l: number, a: number, b: number) { const xyz = labToXyz(l, a, b); const rgb = xyzToRgb(xyz.x, xyz.y, xyz.z); return rgbToHex(rgb.r, rgb.g, rgb.b); }

// Textures
const VAMP_TEXTURES: TextureItem[] = [
  { id: 'v1', name: 'Vamp 01', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000601%20A%20WP_BASE.jpg' },
  { id: 'v2', name: 'Vamp 02', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000716%20A%20WP_BASE.jpg' },
  { id: 'v3', name: 'Vamp 03', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000820%20J%20WP_BASE.jpg' },
  { id: 'v4', name: 'Vamp 04', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01305-01A-000A_BASE.jpg' },
  { id: 'v5', name: 'Vamp 05', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01317-01A-000A_BASE.jpg' },
  { id: 'v6', name: 'Vamp 06', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01436-01A-000A_BASE.jpg' },
];
const SHOELACE_TEXTURES: TextureItem[] = [
  { id: 's1', name: 'Lace Red', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01305-01A-000A_BASE.jpg' },
  { id: 's2', name: 'Lace Blue', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000601%20A%20WP_BASE.jpg' },
  { id: 's3', name: 'Lace Black', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01317-01A-000A_BASE.jpg' },
  { id: 's4', name: 'Lace Grey', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000716%20A%20WP_BASE.jpg' },
  { id: 's5', name: 'Lace White', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000820%20J%20WP_BASE.jpg' },
  { id: 's6', name: 'Lace Green', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01436-01A-000A_BASE.jpg' },
];
const LABEL_TEXTURES: TextureItem[] = [
  { id: 'l1', name: 'Label Leather', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000716%20A%20WP_BASE.jpg' },
  { id: 'l2', name: 'Label Synthetic', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01317-01A-000A_BASE.jpg' },
  { id: 'l3', name: 'Label Matte', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000820%20J%20WP_BASE.jpg' },
  { id: 'l4', name: 'Label Gloss', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01305-01A-000A_BASE.jpg' },
  { id: 'l5', name: 'Label Fabric', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01436-01A-000A_BASE.jpg' },
  { id: 'l6', name: 'Label Mesh', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000601%20A%20WP_BASE.jpg' },
];

const App: React.FC = () => {
  const [modelFile] = useState<File | null>(null); // 移除 setModelFile
  const [libraries, setLibraries] = useState({ vamp: VAMP_TEXTURES, shoelace: SHOELACE_TEXTURES, label: LABEL_TEXTURES });
  const [selectedPart, setSelectedPart] = useState<SelectedPart | null>(null);
  const [envPreset] = useState<string>('studio'); 
  const [envIntensity, setEnvIntensity] = useState<number>(0.2); 
  const [envRotation, setEnvRotation] = useState<number>(262);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [partTextures, setPartTextures] = useState<Record<string, TextureConfig | null>>({});

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [activeShareTab, setActiveShareTab] = useState<'image' | 'embed'>('image');
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isGeneratingScreenshot, setIsGeneratingScreenshot] = useState(false);
  const modelViewerRef = useRef<any>(null);

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
      return { ...prev, [selectedPart.id]: { url: texture.url, scale: 1, offsetX: 0, offsetY: 0, rotation: 0, roughness: 1, metalness: 0, opacity: 1 } };
    });
  };

  const updateTextureConfig = (key: keyof TextureConfig, value: number) => {
      if (!selectedPart) return;
      setPartTextures(prev => {
          const config = prev[selectedPart.id];
          if (!config) return prev;
          return { ...prev, [selectedPart.id]: { ...config, [key]: value } };
      });
  };

  const currentTextureConfig = selectedPart ? partTextures[selectedPart.id] : null;
  const currentColorHex = currentTextureConfig?.color || '#ffffff';
  const currentLab = hexToLab(currentColorHex);

  const getVisibleLibraries = () => {
    if (!selectedPart) return { vamp: false, shoelace: false, label: false };
    const name = selectedPart.name;
    // 使用包含判斷 (模糊比對) 並且對調鞋帶與標籤部位
    return {
        vamp: name.includes('Shape027'),
        shoelace: name.includes('Shape026'), // Swapped: 現在 Shape026 對應鞋帶功能
        label: name.includes('Line040')      // Swapped: 現在 Line040 對應標籤功能
    };
  };

  const visibleLibs = getVisibleLibraries();
  const hasAnyLibrary = Object.values(visibleLibs).some(v => v);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden font-sans">
      <header className="flex items-center justify-between px-6 py-4 bg-gray-950 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <Box className="w-8 h-8 text-indigo-500" />
          <h1 className="text-xl font-bold tracking-tight">PAIHO 3D MATERIAL SHIFT <span className="text-xs font-normal text-gray-500 ml-2">v1.2</span></h1>
        </div>
        <div className="flex items-center gap-4">
            <button onClick={async () => {
                setIsShareModalOpen(true);
                setIsGeneratingScreenshot(true);
                setTimeout(async () => {
                    const dataUrl = await modelViewerRef.current?.captureComposition();
                    setScreenshotUrl(dataUrl);
                    setIsGeneratingScreenshot(false);
                }, 500);
            }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition">
                <Share2 size={16} /> Share
            </button>
            <button onClick={() => setAutoRotate(!autoRotate)} className={`px-3 py-2 rounded-lg border text-sm transition ${autoRotate ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-800 border-gray-700'}`}>360°</button>
            {/* 移除上傳 GLB 的功能按鈕 */}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative bg-gray-100">
           <ModelViewer 
             ref={modelViewerRef} modelFile={modelFile} selectedPart={selectedPart} onPartSelect={setSelectedPart}
             textureMap={partTextures} envPreset={envPreset} envIntensity={envIntensity} envRotation={envRotation} autoRotate={autoRotate}
           />
        </div>

        <div className="w-96 bg-gray-950 border-l border-gray-800 flex flex-col shrink-0 z-10 shadow-2xl overflow-y-auto p-6 space-y-8">
            {selectedPart && currentTextureConfig && (
                 <div className="space-y-6">
                    <div className="flex items-center gap-2 text-indigo-400"><Sliders className="w-4 h-4" /><h3 className="font-semibold text-sm">Texture Settings</h3></div>
                    <div className="space-y-4 bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                        <div className="space-y-1.5"><div className="flex justify-between text-xs text-gray-400"><span>Scale</span><span>{currentTextureConfig.scale.toFixed(1)}x</span></div>
                        <input type="range" min="0.1" max="10" step="0.1" value={currentTextureConfig.scale} onChange={(e) => updateTextureConfig('scale', parseFloat(e.target.value))} className="w-full accent-indigo-500 h-1.5" /></div>
                        <div className="space-y-1.5"><div className="flex justify-between text-xs text-gray-400"><span>Rotation</span><span>{Math.round(currentTextureConfig.rotation)}°</span></div>
                        <input type="range" min="0" max="360" value={currentTextureConfig.rotation} onChange={(e) => updateTextureConfig('rotation', parseFloat(e.target.value))} className="w-full accent-indigo-500 h-1.5" /></div>
                    </div>
                    <div className="space-y-4 bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                        <div className="space-y-1.5"><div className="flex justify-between text-xs text-gray-400"><span>Roughness</span><span>{currentTextureConfig.roughness.toFixed(2)}</span></div>
                        <input type="range" min="0" max="1" step="0.05" value={currentTextureConfig.roughness} onChange={(e) => updateTextureConfig('roughness', parseFloat(e.target.value))} className="w-full accent-blue-500 h-1.5" /></div>
                        <div className="space-y-1.5"><div className="flex justify-between text-xs text-gray-400"><span>Metalness</span><span>{currentTextureConfig.metalness.toFixed(2)}</span></div>
                        <input type="range" min="0" max="1" step="0.05" value={currentTextureConfig.metalness} onChange={(e) => updateTextureConfig('metalness', parseFloat(e.target.value))} className="w-full accent-blue-500 h-1.5" /></div>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <div className="flex items-center gap-2 text-orange-400"><Sun className="w-4 h-4" /><h3 className="font-semibold text-sm">Environment</h3></div>
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800 space-y-4">
                    <div className="space-y-1.5"><div className="flex justify-between text-xs text-gray-400"><span>Intensity</span><span>{envIntensity.toFixed(2)}</span></div>
                    <input type="range" min="0" max="1" step="0.01" value={envIntensity} onChange={(e) => setEnvIntensity(parseFloat(e.target.value))} className="w-full accent-orange-500 h-1.5" /></div>
                    <div className="space-y-1.5"><div className="flex justify-between text-xs text-gray-400"><span>Rotation</span><span>{Math.round(envRotation)}°</span></div>
                    <input type="range" min="0" max="360" step="1" value={envRotation} onChange={(e) => setEnvRotation(parseFloat(e.target.value))} className="w-full accent-orange-500 h-1.5" /></div>
                </div>
            </div>

            <div className={`space-y-8 ${!selectedPart ? 'opacity-30 pointer-events-none' : ''}`}>
                {visibleLibs.vamp && (
                <div><div className="flex justify-between items-center mb-3"><div className="flex gap-2 text-blue-400"><Layers size={16} /><h3 className="text-sm font-semibold">Vamp</h3></div><label className="text-xs cursor-pointer text-blue-400 hover:underline"><Upload size={12} className="inline mr-1"/>Upload<input type="file" className="hidden" onChange={handleTextureUpload} /></label></div>
                <div className="grid grid-cols-3 gap-2">{VAMP_TEXTURES.map(t => <button key={t.id} onClick={() => applyTexture(t)} className={`aspect-square rounded border-2 transition ${currentTextureConfig?.url === t.url ? 'border-blue-500' : 'border-transparent'}`}><img src={t.url} className="w-full h-full object-cover rounded"/></button>)}</div></div>
                )}
                {visibleLibs.shoelace && (
                <div><div className="flex gap-2 text-purple-400 mb-3"><Palette size={16} /><h3 className="text-sm font-semibold">Shoelace Color</h3></div><div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800 flex items-center gap-4"><input type="color" value={currentColorHex} onChange={(e) => setPartTextures(prev => ({ ...prev, [selectedPart!.id]: { ...(prev[selectedPart!.id] || { url: '', scale: 1, offsetX: 0, offsetY: 0, rotation: 0, roughness: 1, metalness: 0, opacity: 1 }), color: e.target.value } }))} className="w-12 h-12 bg-transparent border-none cursor-pointer" /><div className="text-xs font-mono uppercase">{currentColorHex}</div></div></div>
                )}
                {visibleLibs.label && (
                <div><div className="flex gap-2 text-pink-400 mb-3"><Tag size={16} /><h3 className="text-sm font-semibold">Label</h3></div><div className="grid grid-cols-3 gap-2">{LABEL_TEXTURES.map(t => <button key={t.id} onClick={() => applyTexture(t)} className={`aspect-square rounded border-2 transition ${currentTextureConfig?.url === t.url ? 'border-pink-500' : 'border-transparent'}`}><img src={t.url} className="w-full h-full object-cover rounded"/></button>)}</div></div>
                )}
            </div>
          </div>
      </div>

       {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white text-gray-900 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-xl font-bold text-indigo-600 flex gap-2"><Share2 /> Share Your Design</h2>
                    <button onClick={() => setIsShareModalOpen(false)}><X /></button>
                </div>
                <div className="p-6">
                    {isGeneratingScreenshot ? <div className="h-64 flex flex-col items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div><p>Rendering...</p></div> : 
                    <div className="space-y-4">
                        <img src={screenshotUrl!} className="w-full rounded-xl border" />
                        <a href={screenshotUrl!} download="my-design.png" className="w-full flex justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold transition"><Download /> Download 2K PNG</a>
                    </div>}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
