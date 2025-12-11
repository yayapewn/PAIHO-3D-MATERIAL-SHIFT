import React, { useState, useRef } from 'react';
import { Upload, Box, Check, Layers, X, Trash2, Sliders, Move, RotateCw, Maximize, Sun, Rotate3d, Lightbulb, Droplets, Hammer, Eye, Tag, AlignJustify, Share2, Download, Copy, Facebook, Twitter, MessageCircle, Link as LinkIcon, Palette, AlertTriangle } from 'lucide-react';
import ModelViewer from './components/ModelViewer';
import { TextureItem, SelectedPart, TextureConfig } from './types';

// --- Color Conversion Utilities (Hex <-> RGB <-> XYZ <-> LAB) ---

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
    let rL = r / 255;
    let gL = g / 255;
    let bL = b / 255;

    rL = rL > 0.04045 ? Math.pow((rL + 0.055) / 1.055, 2.4) : rL / 12.92;
    gL = gL > 0.04045 ? Math.pow((gL + 0.055) / 1.055, 2.4) : gL / 12.92;
    bL = bL > 0.04045 ? Math.pow((bL + 0.055) / 1.055, 2.4) : bL / 12.92;

    // D65 Standard Observer 2deg
    return {
        x: (rL * 0.4124 + gL * 0.3576 + bL * 0.1805) * 100,
        y: (rL * 0.2126 + gL * 0.7152 + bL * 0.0722) * 100,
        z: (rL * 0.0193 + gL * 0.1192 + bL * 0.9505) * 100
    };
}

function xyzToLab(x: number, y: number, z: number) {
    // D65 White Point
    const refX = 95.047;
    const refY = 100.000;
    const refZ = 108.883;

    let xR = x / refX;
    let yR = y / refY;
    let zR = z / refZ;

    xR = xR > 0.008856 ? Math.cbrt(xR) : (7.787 * xR) + (16 / 116);
    yR = yR > 0.008856 ? Math.cbrt(yR) : (7.787 * yR) + (16 / 116);
    zR = zR > 0.008856 ? Math.cbrt(zR) : (7.787 * zR) + (16 / 116);

    return {
        l: (116 * yR) - 16,
        a: 500 * (xR - yR),
        b: 200 * (yR - zR)
    };
}

function labToXyz(l: number, a: number, b: number) {
    let y = (l + 16) / 116;
    let x = a / 500 + y;
    let z = y - b / 200;

    const x3 = Math.pow(x, 3);
    const y3 = Math.pow(y, 3);
    const z3 = Math.pow(z, 3);

    // D65 White Point
    const refX = 95.047;
    const refY = 100.000;
    const refZ = 108.883;

    x = (x3 > 0.008856 ? x3 : (x - 16 / 116) / 7.787) * refX;
    y = (y3 > 0.008856 ? y3 : (y - 16 / 116) / 7.787) * refY;
    z = (z3 > 0.008856 ? z3 : (z - 16 / 116) / 7.787) * refZ;

    return { x, y, z };
}

function xyzToRgb(x: number, y: number, z: number) {
    let xR = x / 100;
    let yR = y / 100;
    let zR = z / 100;

    let r = xR * 3.2406 + yR * -1.5372 + zR * -0.4986;
    let g = xR * -0.9689 + yR * 1.8758 + zR * 0.0415;
    let b = xR * 0.0557 + yR * -0.2040 + zR * 1.0570;

    r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
    g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
    b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;

    return {
        r: Math.round(Math.max(0, Math.min(1, r)) * 255),
        g: Math.round(Math.max(0, Math.min(1, g)) * 255),
        b: Math.round(Math.max(0, Math.min(1, b)) * 255)
    };
}

function hexToLab(hex: string) {
    const rgb = hexToRgb(hex);
    const xyz = rgbToXyz(rgb.r, rgb.g, rgb.b);
    return xyzToLab(xyz.x, xyz.y, xyz.z);
}

function labToHex(l: number, a: number, b: number) {
    const xyz = labToXyz(l, a, b);
    const rgb = xyzToRgb(xyz.x, xyz.y, xyz.z);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
}


// Vamp Textures (Formerly Library)
const VAMP_TEXTURES: TextureItem[] = [
  { id: 'v1', name: 'Vamp 01', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000601%20A%20WP_BASE.jpg' },
  { id: 'v2', name: 'Vamp 02', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000716%20A%20WP_BASE.jpg' },
  { id: 'v3', name: 'Vamp 03', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000820%20J%20WP_BASE.jpg' },
  { id: 'v4', name: 'Vamp 04', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01305-01A-000A_BASE.jpg' },
  { id: 'v5', name: 'Vamp 05', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01317-01A-000A_BASE.jpg' },
  { id: 'v6', name: 'Vamp 06', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01436-01A-000A_BASE.jpg' },
];

// Shoelace Textures
const SHOELACE_TEXTURES: TextureItem[] = [
  { id: 's1', name: 'Lace Red', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01305-01A-000A_BASE.jpg' },
  { id: 's2', name: 'Lace Blue', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000601%20A%20WP_BASE.jpg' },
  { id: 's3', name: 'Lace Black', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01317-01A-000A_BASE.jpg' },
  { id: 's4', name: 'Lace Grey', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000716%20A%20WP_BASE.jpg' },
  { id: 's5', name: 'Lace White', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000820%20J%20WP_BASE.jpg' },
  { id: 's6', name: 'Lace Green', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01436-01A-000A_BASE.jpg' },
];

// Label Textures
const LABEL_TEXTURES: TextureItem[] = [
  { id: 'l1', name: 'Label Leather', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000716%20A%20WP_BASE.jpg' },
  { id: 'l2', name: 'Label Synthetic', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01317-01A-000A_BASE.jpg' },
  { id: 'l3', name: 'Label Matte', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000820%20J%20WP_BASE.jpg' },
  { id: 'l4', name: 'Label Gloss', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01305-01A-000A_BASE.jpg' },
  { id: 'l5', name: 'Label Fabric', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01436-01A-000A_BASE.jpg' },
  { id: 'l6', name: 'Label Mesh', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000601%20A%20WP_BASE.jpg' },
];

const App: React.FC = () => {
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [libraries, setLibraries] = useState({
    vamp: VAMP_TEXTURES,
    shoelace: SHOELACE_TEXTURES,
    label: LABEL_TEXTURES
  });
  const [selectedPart, setSelectedPart] = useState<SelectedPart | null>(null);
  const [envPreset] = useState<string>('city');
  const [envIntensity, setEnvIntensity] = useState<number>(1);
  const [envRotation, setEnvRotation] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [partTextures, setPartTextures] = useState<Record<string, TextureConfig | null>>({});

  // Share Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [activeShareTab, setActiveShareTab] = useState<'image' | 'embed'>('image');
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isGeneratingScreenshot, setIsGeneratingScreenshot] = useState(false);
  const modelViewerRef = useRef<any>(null);

  // Handlers
  const handleModelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setModelFile(e.target.files[0]);
      setSelectedPart(null);
      setPartTextures({});
    }
  };

  const handleTextureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      const newTexture: TextureItem = {
        id: crypto.randomUUID(),
        name: file.name,
        url: url
      };
      setLibraries(prev => ({
        ...prev,
        vamp: [newTexture, ...prev.vamp]
      }));
    }
  };

  const deleteTexture = (e: React.MouseEvent, category: keyof typeof libraries, id: string) => {
    e.stopPropagation(); 
    setLibraries(prev => ({
      ...prev,
      [category]: prev[category].filter(t => t.id !== id)
    }));
  };

  const applyTexture = (texture: TextureItem) => {
    if (!selectedPart) return;

    setPartTextures(prev => {
      const existingConfig = prev[selectedPart.id];
      if (existingConfig) {
        return {
          ...prev,
          [selectedPart.id]: {
            ...existingConfig,
            url: texture.url
          }
        };
      }
      return {
        ...prev,
        [selectedPart.id]: {
            url: texture.url,
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            rotation: 0,
            roughness: 1,
            metalness: 0,
            opacity: 1,
        }
      };
    });
  };

  const clearTexture = () => {
    if (!selectedPart) return;
    const newMap = { ...partTextures };
    delete newMap[selectedPart.id];
    setPartTextures(newMap);
  };

  const removeTextureUrl = () => {
    if (!selectedPart) return;
    setPartTextures(prev => {
        const existing = prev[selectedPart.id];
        if (existing) {
            return {
                ...prev,
                [selectedPart.id]: {
                    ...existing,
                    url: ''
                }
            };
        }
        return prev;
    });
  };

  const updateTextureConfig = (key: keyof TextureConfig, value: number) => {
      if (!selectedPart) return;
      setPartTextures(prev => {
          const currentConfig = prev[selectedPart.id];
          if (!currentConfig) return prev;
          return {
              ...prev,
              [selectedPart.id]: {
                  ...currentConfig,
                  [key]: value
              }
          };
      });
  };

  const currentTextureConfig = selectedPart ? partTextures[selectedPart.id] : null;

  // --- Color Palette Handlers (Shoelace) ---
  const updatePartColor = (hex: string) => {
      if (!selectedPart) return;
      setPartTextures(prev => {
          const existing = prev[selectedPart.id];
          if (existing) {
              return {
                  ...prev,
                  [selectedPart.id]: { ...existing, color: hex }
              };
          } else {
              return {
                  ...prev,
                  [selectedPart.id]: {
                      url: '', 
                      scale: 1,
                      offsetX: 0,
                      offsetY: 0,
                      rotation: 0,
                      roughness: 1,
                      metalness: 0,
                      opacity: 1,
                      color: hex
                  }
              };
          }
      });
  };

  const removeColor = () => {
      if (!selectedPart) return;
      setPartTextures(prev => {
          const existing = prev[selectedPart.id];
          if (existing) {
             const newConfig = { ...existing };
             delete newConfig.color;
             return { ...prev, [selectedPart.id]: newConfig };
          }
          return prev;
      });
  }

  // Derived LAB values for display
  const currentColorHex = currentTextureConfig?.color || '#ffffff';
  const currentLab = hexToLab(currentColorHex);

  const handleLabChange = (component: 'l' | 'a' | 'b', value: string) => {
      const numVal = parseFloat(value);
      if (isNaN(numVal)) return;

      const newLab = { ...currentLab, [component]: numVal };
      const newHex = labToHex(newLab.l, newLab.a, newLab.b);
      updatePartColor(newHex);
  };


  const getVisibleLibraries = () => {
    if (!selectedPart) return { vamp: false, shoelace: false, label: false };
    switch (selectedPart.name) {
        case 'Plane005_1': return { vamp: true, shoelace: false, label: false };
        case 'Line030_1': return { vamp: false, shoelace: true, label: false };
        case 'Plane009_1': return { vamp: false, shoelace: false, label: true };
        default: return { vamp: false, shoelace: false, label: false }; 
    }
  };

  const visibleLibs = getVisibleLibraries();
  const hasAnyLibrary = Object.values(visibleLibs).some(v => v);

  // Share Logic
  const handleShare = async () => {
      setIsShareModalOpen(true);
      setIsGeneratingScreenshot(true);
      setScreenshotUrl(null);

      // Delay slightly to allow modal to open
      setTimeout(async () => {
          if (modelViewerRef.current) {
              const dataUrl = await modelViewerRef.current.captureComposition();
              setScreenshotUrl(dataUrl);
              setIsGeneratingScreenshot(false);
          }
      }, 500);
  };

  const handleSocialShare = (platform: 'facebook' | 'twitter' | 'line') => {
      const url = encodeURIComponent(window.location.href);
      const text = encodeURIComponent("Check out my custom 3D sneaker design on PAIHO 3D MATERIAL SHIFT!");
      
      let shareUrl = '';
      switch (platform) {
          case 'facebook':
              shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
              break;
          case 'twitter':
              shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
              break;
          case 'line':
              // Line uses a specific schema
              shareUrl = `https://social-plugins.line.me/lineit/share?url=${url}`;
              break;
      }
      window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  const handleCopyLink = () => {
      navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
  };

  // Determine Embed URL validity
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const isBlobUrl = currentUrl.startsWith('blob:');
  const embedSrc = isBlobUrl ? 'https://your-domain.com' : currentUrl;

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden font-sans">
      <header className="flex items-center justify-between px-6 py-4 bg-gray-950 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <Box className="w-8 h-8 text-indigo-500" />
          <h1 className="text-xl font-bold tracking-tight">PAIHO 3D MATERIAL SHIFT <span className="text-xs font-normal text-gray-500 ml-2">v1.2</span></h1>
        </div>
        <div className="flex items-center gap-4">
            <button
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition text-sm font-medium shadow-lg shadow-indigo-900/20"
            >
                <Share2 size={16} /> Share
            </button>

            <button
                onClick={() => setAutoRotate(!autoRotate)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm font-medium ${
                    autoRotate 
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)]' 
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                }`}
                title="Toggle 360° Rotation"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <text x="12" y="16" textAnchor="middle" fontSize="7" strokeWidth="0" fill="currentColor" fontWeight="bold">360</text>
                </svg>
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg cursor-pointer transition text-sm">
                <Upload size={16} />
                <span>Upload GLB</span>
                <input type="file" accept=".glb,.gltf" className="hidden" onChange={handleModelUpload} />
            </label>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative bg-gray-100">
           <ModelViewer 
             ref={modelViewerRef}
             modelFile={modelFile}
             selectedPart={selectedPart}
             onPartSelect={setSelectedPart}
             textureMap={partTextures}
             envPreset={envPreset}
             envIntensity={envIntensity}
             envRotation={envRotation}
             autoRotate={autoRotate}
           />
        </div>

        <div className="w-96 bg-gray-950 border-l border-gray-800 flex flex-col shrink-0 z-10 shadow-2xl">
          <div className="flex-1 overflow-y-auto p-6 space-y-8">

            {selectedPart && currentTextureConfig && (
                 <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-indigo-400">
                            <Sliders className="w-4 h-4" />
                            <h3 className="font-semibold text-sm">Texture Settings</h3>
                        </div>
                    </div>
                    
                    <div className="space-y-4 bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Transform</h4>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-gray-400">
                                <span className="flex items-center gap-1"><Maximize size={10} /> Scale</span>
                                <span>{currentTextureConfig.scale.toFixed(1)}x</span>
                            </div>
                            <input 
                                type="range" 
                                min="0.1" 
                                max="10" 
                                step="0.1" 
                                value={currentTextureConfig.scale}
                                onChange={(e) => updateTextureConfig('scale', parseFloat(e.target.value))}
                                className="w-full accent-indigo-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-gray-400">
                                <span className="flex items-center gap-1"><RotateCw size={10} /> Rotation</span>
                                <span>{Math.round(currentTextureConfig.rotation)}°</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="360" 
                                value={currentTextureConfig.rotation}
                                onChange={(e) => updateTextureConfig('rotation', parseFloat(e.target.value))}
                                className="w-full accent-indigo-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                         <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-gray-400">
                                <span className="flex items-center gap-1"><Move size={10} /> Offset X</span>
                                <span>{currentTextureConfig.offsetX.toFixed(2)}</span>
                            </div>
                            <input 
                                type="range" 
                                min="-1" 
                                max="1" 
                                step="0.05"
                                value={currentTextureConfig.offsetX}
                                onChange={(e) => updateTextureConfig('offsetX', parseFloat(e.target.value))}
                                className="w-full accent-indigo-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                         <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-gray-400">
                                <span className="flex items-center gap-1"><Move size={10} className="rotate-90"/> Offset Y</span>
                                <span>{currentTextureConfig.offsetY.toFixed(2)}</span>
                            </div>
                            <input 
                                type="range" 
                                min="-1" 
                                max="1" 
                                step="0.05"
                                value={currentTextureConfig.offsetY}
                                onChange={(e) => updateTextureConfig('offsetY', parseFloat(e.target.value))}
                                className="w-full accent-indigo-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    </div>

                    <div className="space-y-4 bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Material Properties</h4>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-gray-400">
                                <span className="flex items-center gap-1"><Droplets size={10} /> Roughness</span>
                                <span>{currentTextureConfig.roughness.toFixed(2)}</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.05"
                                value={currentTextureConfig.roughness}
                                onChange={(e) => updateTextureConfig('roughness', parseFloat(e.target.value))}
                                className="w-full accent-blue-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-gray-400">
                                <span className="flex items-center gap-1"><Hammer size={10} /> Metalness</span>
                                <span>{currentTextureConfig.metalness.toFixed(2)}</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.05"
                                value={currentTextureConfig.metalness}
                                onChange={(e) => updateTextureConfig('metalness', parseFloat(e.target.value))}
                                className="w-full accent-blue-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-gray-400">
                                <span className="flex items-center gap-1"><Eye size={10} /> Opacity</span>
                                <span>{currentTextureConfig.opacity.toFixed(2)}</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.05"
                                value={currentTextureConfig.opacity}
                                onChange={(e) => updateTextureConfig('opacity', parseFloat(e.target.value))}
                                className="w-full accent-blue-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
            )}

            <div>
                 <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Sun className="w-4 h-4 text-orange-400" />
                        <h3 className="font-semibold text-sm">Environment</h3>
                    </div>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800 space-y-4">
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-gray-400">
                            <span className="flex items-center gap-1"><Lightbulb size={10} /> Intensity</span>
                            <span>{envIntensity.toFixed(1)}</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="10" 
                            step="0.1" 
                            value={envIntensity}
                            onChange={(e) => setEnvIntensity(parseFloat(e.target.value))}
                            className="w-full accent-orange-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-gray-400">
                            <span className="flex items-center gap-1"><Rotate3d size={10} /> Rotation</span>
                            <span>{envRotation}°</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="360" 
                            step="1" 
                            value={envRotation}
                            onChange={(e) => setEnvRotation(parseFloat(e.target.value))}
                            className="w-full accent-orange-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            <div className={`transition-opacity duration-200 ${!selectedPart ? 'opacity-0 pointer-events-none' : 'opacity-100'} space-y-8 pb-10`}>
                
                {selectedPart && !hasAnyLibrary && (
                    <div className="text-center text-gray-500 py-10 border-2 border-dashed border-gray-800 rounded-lg">
                        <p className="text-sm">No textures available for <br /><span className="text-indigo-400 font-mono text-xs">{selectedPart.name}</span></p>
                    </div>
                )}

                {/* Vamp Library */}
                {visibleLibs.vamp && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-blue-400" />
                            <h3 className="font-semibold text-sm">Vamp</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={clearTexture}
                                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 hover:bg-red-400/10 px-2 py-1 rounded transition-colors"
                            >
                                <X size={12} /> Remove
                            </button>
                             <label className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1">
                                <Upload size={12} /> Upload
                                <input type="file" accept="image/*" className="hidden" onChange={handleTextureUpload} />
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        {libraries.vamp.map((tex) => (
                            <div key={tex.id} className="group relative aspect-square">
                                <button
                                    onClick={() => applyTexture(tex)}
                                    className="w-full h-full rounded-lg overflow-hidden border border-gray-800 hover:border-white focus:ring-2 focus:ring-blue-500 transition relative"
                                >
                                    <img src={tex.url} alt={tex.name} className="w-full h-full object-cover" />
                                    {selectedPart && partTextures[selectedPart.id]?.url === tex.url && (
                                        <div className="absolute inset-0 bg-blue-500/40 flex items-center justify-center">
                                            <Check className="w-6 h-6 text-white drop-shadow-md" />
                                        </div>
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1 pointer-events-none">
                                        <p className="text-[10px] text-center truncate px-1">{tex.name}</p>
                                    </div>
                                </button>
                                <button 
                                    onClick={(e) => deleteTexture(e, 'vamp', tex.id)}
                                    className="absolute top-1 right-1 p-1 bg-gray-900/80 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all scale-90 hover:scale-100 shadow-sm z-20"
                                >
                                    <Trash2 size={10} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
                )}

                {/* Shoelace Library */}
                {visibleLibs.shoelace && (
                <div className="space-y-6">
                    {/* Color Palette Section */}
                    <div>
                         <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Palette className="w-4 h-4 text-purple-400" />
                                <h3 className="font-semibold text-sm">Color Palette</h3>
                            </div>
                            <button 
                                onClick={removeColor}
                                className="text-xs text-gray-500 hover:text-white flex items-center gap-1 transition-colors"
                            >
                                <X size={12} /> Remove
                            </button>
                        </div>
                        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800 flex gap-4">
                             {/* Color Picker */}
                             <div className="flex flex-col gap-2 items-center">
                                <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-600 relative cursor-pointer shadow-inner">
                                    <input 
                                        type="color" 
                                        value={currentColorHex}
                                        onChange={(e) => updatePartColor(e.target.value)}
                                        className="absolute -top-4 -left-4 w-24 h-24 cursor-pointer opacity-0" 
                                    />
                                    <div className="w-full h-full" style={{ backgroundColor: currentColorHex }}></div>
                                </div>
                                <span className="text-[10px] font-mono text-gray-400 uppercase">{currentColorHex}</span>
                             </div>

                             {/* LAB Inputs */}
                             <div className="flex-1 space-y-2">
                                 {/* L */}
                                 <div className="flex items-center gap-2">
                                     <span className="text-xs text-gray-400 w-4 text-right font-bold">L:</span>
                                     <input 
                                        type="number" 
                                        value={Math.round(currentLab.l)}
                                        onChange={(e) => handleLabChange('l', e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                                     />
                                 </div>
                                 {/* a */}
                                 <div className="flex items-center gap-2">
                                     <span className="text-xs text-gray-400 w-4 text-right font-bold">a:</span>
                                     <input 
                                        type="number" 
                                        value={Math.round(currentLab.a)}
                                        onChange={(e) => handleLabChange('a', e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                                     />
                                 </div>
                                 {/* b */}
                                 <div className="flex items-center gap-2">
                                     <span className="text-xs text-gray-400 w-4 text-right font-bold">b:</span>
                                     <input 
                                        type="number" 
                                        value={Math.round(currentLab.b)}
                                        onChange={(e) => handleLabChange('b', e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                                     />
                                 </div>
                             </div>
                        </div>
                    </div>

                    {/* Original Shoelace Library */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <AlignJustify className="w-4 h-4 text-emerald-400" />
                                <h3 className="font-semibold text-sm">Shoelace Textures</h3>
                            </div>
                            <button
                                onClick={removeTextureUrl}
                                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 hover:bg-red-400/10 px-2 py-1 rounded transition-colors"
                            >
                                <X size={12} /> Remove
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {libraries.shoelace.map((tex) => (
                                <div key={tex.id} className="group relative aspect-square">
                                    <button
                                        onClick={() => applyTexture(tex)}
                                        className="w-full h-full rounded-lg overflow-hidden border border-gray-800 hover:border-white focus:ring-2 focus:ring-emerald-500 transition relative"
                                    >
                                        <img src={tex.url} alt={tex.name} className="w-full h-full object-cover" />
                                        {selectedPart && partTextures[selectedPart.id]?.url === tex.url && (
                                            <div className="absolute inset-0 bg-emerald-500/40 flex items-center justify-center">
                                                <Check className="w-6 h-6 text-white drop-shadow-md" />
                                            </div>
                                        )}
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1 pointer-events-none">
                                            <p className="text-[10px] text-center truncate px-1">{tex.name}</p>
                                        </div>
                                    </button>
                                    <button 
                                        onClick={(e) => deleteTexture(e, 'shoelace', tex.id)}
                                        className="absolute top-1 right-1 p-1 bg-gray-900/80 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all scale-90 hover:scale-100 shadow-sm z-20"
                                    >
                                        <Trash2 size={10} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                )}

                {/* Label Library */}
                {visibleLibs.label && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-pink-400" />
                            <h3 className="font-semibold text-sm">Label</h3>
                        </div>
                        <button
                            onClick={clearTexture}
                            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 hover:bg-red-400/10 px-2 py-1 rounded transition-colors"
                        >
                            <X size={12} /> Remove
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        {libraries.label.map((tex) => (
                            <div key={tex.id} className="group relative aspect-square">
                                <button
                                    onClick={() => applyTexture(tex)}
                                    className="w-full h-full rounded-lg overflow-hidden border border-gray-800 hover:border-white focus:ring-2 focus:ring-pink-500 transition relative"
                                >
                                    <img src={tex.url} alt={tex.name} className="w-full h-full object-cover" />
                                    {selectedPart && partTextures[selectedPart.id]?.url === tex.url && (
                                        <div className="absolute inset-0 bg-pink-500/40 flex items-center justify-center">
                                            <Check className="w-6 h-6 text-white drop-shadow-md" />
                                        </div>
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1 pointer-events-none">
                                        <p className="text-[10px] text-center truncate px-1">{tex.name}</p>
                                    </div>
                                </button>
                                <button 
                                    onClick={(e) => deleteTexture(e, 'label', tex.id)}
                                    className="absolute top-1 right-1 p-1 bg-gray-900/80 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all scale-90 hover:scale-100 shadow-sm z-20"
                                >
                                    <Trash2 size={10} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
                )}

            </div>
          </div>
        </div>
      </div>

       {/* Share Modal */}
       {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white text-gray-900 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-600">
                        <Share2 className="w-5 h-5" />
                        Share Your Design
                    </h2>
                    <button onClick={() => setIsShareModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>
                
                {/* Tabs */}
                <div className="flex border-b border-gray-100 bg-gray-50/50">
                    <button 
                        onClick={() => setActiveShareTab('image')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeShareTab === 'image' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Download Image
                    </button>
                    <button 
                        onClick={() => setActiveShareTab('embed')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeShareTab === 'embed' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Embed Viewer
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {activeShareTab === 'image' && (
                        <div className="space-y-6">
                            {isGeneratingScreenshot ? (
                                <div className="h-64 flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
                                    <p className="text-sm text-gray-500 font-medium">Rendering 2K Composite...</p>
                                </div>
                            ) : screenshotUrl ? (
                                <div className="space-y-4">
                                    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-gray-50">
                                        <img src={screenshotUrl} alt="Design Preview" className="w-full h-auto object-contain max-h-[400px]" />
                                    </div>
                                    
                                    <div className="flex gap-3">
                                        <a 
                                            href={screenshotUrl} 
                                            download="paiho-design-2k.png"
                                            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl font-semibold transition shadow-lg shadow-indigo-200"
                                        >
                                            <Download size={18} /> Download 2K PNG
                                        </a>
                                    </div>

                                    {/* Social Share Buttons */}
                                    <div className="pt-2">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 text-center">Or Share to Social Media</p>
                                        <div className="flex justify-center gap-4">
                                            <button 
                                                onClick={() => handleSocialShare('facebook')}
                                                className="p-3 bg-[#1877F2] text-white rounded-full hover:scale-110 transition shadow-md"
                                                title="Share on Facebook"
                                            >
                                                <Facebook size={20} />
                                            </button>
                                            <button 
                                                onClick={() => handleSocialShare('twitter')}
                                                className="p-3 bg-[#1DA1F2] text-white rounded-full hover:scale-110 transition shadow-md"
                                                title="Share on Twitter"
                                            >
                                                <Twitter size={20} />
                                            </button>
                                            <button 
                                                onClick={() => handleSocialShare('line')}
                                                className="p-3 bg-[#00C300] text-white rounded-full hover:scale-110 transition shadow-md"
                                                title="Share on LINE"
                                            >
                                                <MessageCircle size={20} />
                                            </button>
                                            <button 
                                                onClick={handleCopyLink}
                                                className="p-3 bg-gray-700 text-white rounded-full hover:scale-110 transition shadow-md"
                                                title="Copy Link"
                                            >
                                                <LinkIcon size={20} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    )}

                    {activeShareTab === 'embed' && (
                        <div className="space-y-4">
                             {isBlobUrl && (
                                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-xs flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <div>
                                        <strong>Preview Mode Detected:</strong> You are viewing a temporary preview URL (`blob:`). 
                                        This cannot be embedded. The code below uses a placeholder URL. 
                                        Please deploy your app to a static host (like GitHub Pages or Vercel) to get a valid embed URL.
                                    </div>
                                </div>
                             )}

                             <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <p className="text-sm text-gray-600 mb-2">Copy this code to embed the 3D viewer on your website:</p>
                                <div className="relative">
                                    <textarea 
                                        readOnly
                                        className="w-full h-32 bg-white border border-gray-300 rounded-lg p-3 text-xs font-mono text-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={`<iframe src="${embedSrc}" width="100%" height="600px" frameborder="0" allow="camera; microphone; fullscreen"></iframe>`}
                                    />
                                    <button 
                                        onClick={() => {
                                            navigator.clipboard.writeText(`<iframe src="${embedSrc}" width="100%" height="600px" frameborder="0" allow="camera; microphone; fullscreen"></iframe>`);
                                            alert("Code copied!");
                                        }}
                                        className="absolute top-2 right-2 p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition"
                                        title="Copy Code"
                                    >
                                        <Copy size={14} />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="text-xs text-gray-500 space-y-1">
                                <p><strong>⚠️ Important Note:</strong></p>
                                <p>This embedded viewer will load the <strong>default 3D model</strong>.</p>
                                <p>Custom uploaded GLB files and applied textures are <strong>not saved to the cloud</strong> in this version and will not appear in the iframe on other websites.</p>
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