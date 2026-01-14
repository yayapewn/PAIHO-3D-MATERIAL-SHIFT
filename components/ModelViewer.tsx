
import React, { Component, useEffect, useState, Suspense, useRef, ErrorInfo, ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html, Loader, Environment, PerspectiveCamera, Center, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { SelectedPart, TextureConfig } from '../types';

const DEFAULT_MODEL_URL = "https://huggingface.co/yayapewn/huggingface/resolve/main/lace-sneaker-9-part.glb";
const INTERACTIVE_KEYWORDS = ['Shape027', 'Line040', 'Shape026'];

const isInteractive = (name: string) => {
    return INTERACTIVE_KEYWORDS.some(keyword => name && name.includes(keyword));
};

const ScreenshotHandler = React.forwardRef((props, ref) => {
    const { gl, scene, camera } = useThree();
    React.useImperativeHandle(ref, () => ({
        captureComposition: async () => {
            return new Promise<string>((resolve) => {
                const originalPosition = camera.position.clone();
                const originalRotation = camera.rotation.clone();
                const originalAspect = (camera as THREE.PerspectiveCamera).aspect;
                const totalWidth = 2560;
                const totalHeight = 1440;
                const leftWidth = Math.floor(totalWidth * (2/3));
                const rightWidth = totalWidth - leftWidth;
                const rowHeight = totalHeight / 3;
                const canvas = document.createElement('canvas');
                canvas.width = totalWidth;
                canvas.height = totalHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) { resolve(''); return; }
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, totalWidth, totalHeight);
                const renderAndDraw = (x: number, y: number, w: number, h: number, camPos: THREE.Vector3, lookAt: THREE.Vector3) => {
                     camera.position.copy(camPos);
                     camera.lookAt(lookAt);
                     camera.updateMatrixWorld();
                     gl.render(scene, camera);
                     const tempCanvas = document.createElement('canvas');
                     tempCanvas.width = gl.domElement.width;
                     tempCanvas.height = gl.domElement.height;
                     const tempCtx = tempCanvas.getContext('2d');
                     if(tempCtx) {
                         tempCtx.drawImage(gl.domElement, 0, 0);
                         const srcAspect = tempCanvas.width / tempCanvas.height;
                         const destAspect = w / h;
                         let drawW, drawH, drawX, drawY;
                         if (srcAspect > destAspect) {
                             drawW = w; drawH = w / srcAspect; drawX = x; drawY = y + (h - drawH) / 2;
                         } else {
                             drawH = h; drawW = h * srcAspect; drawY = y; drawX = x + (w - drawW) / 2;
                         }
                         ctx.drawImage(tempCanvas, drawX, drawY, drawW, drawH);
                     }
                };
                const lookAtCenter = new THREE.Vector3(0, 0, 0);
                renderAndDraw(0, 0, leftWidth, totalHeight, originalPosition, lookAtCenter);
                renderAndDraw(leftWidth, 0, rightWidth, rowHeight, new THREE.Vector3(0, 0.5, 0), lookAtCenter);
                renderAndDraw(leftWidth, rowHeight, rightWidth, rowHeight, new THREE.Vector3(0.5, 0, 0), lookAtCenter);
                renderAndDraw(leftWidth, rowHeight * 2, rightWidth, rowHeight, new THREE.Vector3(0, 0, -0.5), lookAtCenter);
                camera.position.copy(originalPosition);
                camera.rotation.copy(originalRotation);
                (camera as THREE.PerspectiveCamera).aspect = originalAspect;
                camera.updateProjectionMatrix();
                resolve(canvas.toDataURL('image/png', 0.9));
            });
        }
    }));
    return null;
});

interface ModelProps {
  url: string;
  selectedPart: SelectedPart | null;
  onPartSelect: (part: SelectedPart | null) => void;
  textureMap: Record<string, TextureConfig | null>;
}

const Model: React.FC<ModelProps> = ({ url, selectedPart, onPartSelect, textureMap }) => {
  const { scene } = useGLTF(url);
  const textureLoader = useRef(new THREE.TextureLoader());
  const interactiveMeshesRef = useRef<THREE.Mesh[]>([]);
  const allMeshesRef = useRef<THREE.Mesh[]>([]);
  const Primitive = 'primitive' as any;

  useEffect(() => {
    const interactive: THREE.Mesh[] = [];
    const all: THREE.Mesh[] = [];
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        all.push(mesh);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (!mesh.userData.originalMaterial) {
            mesh.userData.originalMaterial = mesh.material;
        }
        const isPartInteractive = isInteractive(mesh.name);
        if (isPartInteractive) {
            interactive.push(mesh);
            if (!mesh.userData.isCustomMaterial) {
                const originalMat = Array.isArray(mesh.userData.originalMaterial) 
                    ? mesh.userData.originalMaterial[0] 
                    : mesh.userData.originalMaterial;
                const newMat = originalMat.clone();
                newMat.side = THREE.DoubleSide;
                newMat.transparent = true;
                if (newMat.emissive) {
                    newMat.emissive.setHex(0x000000);
                    newMat.emissiveIntensity = 0;
                }
                mesh.material = newMat;
                mesh.userData.isCustomMaterial = true;
                mesh.userData.glowEnergy = 0;
            }
        }

        const config = textureMap[mesh.uuid];
        if (config) {
            const material = mesh.material as THREE.MeshStandardMaterial;
            if (config.color) material.color.set(config.color);
            else material.color.setHex(0xffffff);
            material.roughness = config.roughness;
            material.metalness = config.metalness;
            material.opacity = config.opacity;
            material.alphaTest = 0.05;

            if (config.url) {
                if (mesh.userData.currentTextureUrl !== config.url) {
                    textureLoader.current.load(config.url, (texture) => {
                        texture.flipY = false;
                        texture.colorSpace = THREE.SRGBColorSpace;
                        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                        texture.repeat.set(config.scale, config.scale);
                        texture.offset.set(config.offsetX, config.offsetY);
                        texture.rotation = (config.rotation * Math.PI) / 180;
                        texture.center.set(0.5, 0.5);
                        material.map = texture;
                        material.needsUpdate = true;
                        mesh.userData.currentTextureUrl = config.url;
                    });
                } else if (material.map) {
                    material.map.repeat.set(config.scale, config.scale);
                    material.map.rotation = (config.rotation * Math.PI) / 180;
                    material.map.offset.set(config.offsetX, config.offsetY);
                }
            } else {
                material.map = null;
                mesh.userData.currentTextureUrl = null;
            }
        }
      }
    });
    interactiveMeshesRef.current = interactive;
    allMeshesRef.current = all;
  }, [scene, textureMap]);

  useFrame((state, delta) => {
    // 效能優化：僅遍歷快取清單
    interactiveMeshesRef.current.forEach(mesh => {
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (material && 'emissive' in material) {
            if (mesh.userData.glowEnergy > 0) {
                mesh.userData.glowEnergy = THREE.MathUtils.lerp(mesh.userData.glowEnergy, 0, delta * 2.6);
                if (mesh.userData.glowEnergy < 0.001) mesh.userData.glowEnergy = 0;
            }
            const energySin = Math.sin(mesh.userData.glowEnergy * Math.PI);
            let selectIntensity = 0;
            if (mesh.uuid === selectedPart?.id) {
                selectIntensity = 0.08 + Math.sin(state.clock.elapsedTime * 1.8) * 0.03;
            }
            const totalIntensityTarget = selectIntensity + (energySin * 0.12);
            const baseEmissive = (mesh.uuid === selectedPart?.id) ? 0x666666 : 0xffffff;
            material.emissive.lerp(new THREE.Color(baseEmissive), 0.08);
            material.emissiveIntensity = THREE.MathUtils.lerp(material.emissiveIntensity, totalIntensityTarget, 0.1);
            
            const config = textureMap[mesh.uuid];
            const targetBaseOpacity = config?.opacity ?? 1.0;
            material.opacity = THREE.MathUtils.lerp(material.opacity, targetBaseOpacity + (energySin * 0.15), 0.08);
        }
    });
  });

  return <Primitive 
            object={scene} 
            scale={[2, 2, 2]} 
            rotation={[0, Math.PI, 0]} 
            onPointerOver={(e: any) => { e.stopPropagation(); if(isInteractive(e.object.name)) document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
            onClick={(e: any) => {
                e.stopPropagation();
                const mesh = e.object as THREE.Mesh;
                if (!isInteractive(mesh.name)) { onPartSelect(null); return; }
                mesh.userData.glowEnergy = 1.0;
                const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
                onPartSelect({ name: mesh.name, materialName: mat.name, id: mesh.uuid });
            }}
          />;
};

const InnerScene = React.memo(({ url, selectedPart, onPartSelect, textureMap }: ModelProps) => {
    const [modelBottom, setModelBottom] = useState(-0.1);
    return (
        <group>
            <Center onCentered={({ height }) => setModelBottom(-height / 2)}>
                <Model 
                    url={url} 
                    selectedPart={selectedPart} 
                    onPartSelect={onPartSelect}
                    textureMap={textureMap}
                />
            </Center>
            <ContactShadows 
                position={[0, modelBottom - 0.001, 0]} 
                opacity={0.8} 
                scale={1.1} 
                blur={1.0} 
                far={0.8} 
                resolution={1024} 
                color="#000000" 
            />
        </group>
    );
});

interface ErrorBoundaryProps { children?: ReactNode; key?: any; }
interface ErrorBoundaryState { hasError: boolean; error: any; }

/**
 * Custom Error Boundary to catch 3D rendering failures.
 * Fix: Changed React.Component to Component (imported from 'react') to correctly resolve state, setState, and props inheritance in TypeScript.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any): ErrorBoundaryState { return { hasError: true, error }; }
  componentDidCatch(error: any, errorInfo: ErrorInfo) { console.error("模型載入錯誤:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <Html center>
          <div className="bg-white/90 p-6 rounded-lg shadow-xl border border-red-200 text-center w-80 backdrop-blur-sm">
            <div className="text-red-500 font-bold mb-2 text-lg">載入失敗</div>
            <p className="text-sm text-gray-600 mb-4">無法讀取 3D 模型，請確認連結是否正確或網路狀態。</p>
            <button onClick={() => this.setState({ hasError: false })} className="px-4 py-2 bg-red-500 text-white rounded-md text-sm hover:bg-red-600 transition">重試</button>
          </div>
        </Html>
      );
    }
    return this.props.children;
  }
}

interface ModelViewerProps {
  modelFile: File | null;
  selectedPart: SelectedPart | null;
  onPartSelect: (part: SelectedPart | null) => void;
  textureMap: Record<string, TextureConfig | null>;
  envPreset: string;
  envIntensity: number;
  envRotation: number;
  autoRotate: boolean;
}

const ModelViewer = React.forwardRef<any, ModelViewerProps>(({ 
    modelFile, selectedPart, onPartSelect, textureMap, envPreset, envIntensity, envRotation, autoRotate
}, ref) => {
  const [modelUrl, setModelUrl] = useState<string>(DEFAULT_MODEL_URL);
  const controlsRef = useRef<any>(null);
  const screenshotHandlerRef = useRef<any>(null);

  React.useImperativeHandle(ref, () => ({
      captureComposition: () => screenshotHandlerRef.current?.captureComposition() || Promise.resolve('')
  }));

  useEffect(() => {
    if (modelFile) {
      const url = URL.createObjectURL(modelFile);
      setModelUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setModelUrl(DEFAULT_MODEL_URL);
    }
  }, [modelFile]);

  useEffect(() => {
    if (controlsRef.current) {
        controlsRef.current.object.position.set(0.6, 0.1, 0);
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
    }
  }, [modelUrl]);

  return (
    <div className="w-full h-full bg-gray-100 relative">
      <Canvas 
          shadows 
          dpr={[1, 1.5]} 
          gl={{ 
            preserveDrawingBuffer: true, 
            antialias: true, 
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.2
          }}
          onPointerMissed={(e) => { if (e.type === 'click') onPartSelect(null); }}
      >
        <PerspectiveCamera makeDefault position={[0.6, 0.1, 0]} fov={45} near={0.01} />
        <OrbitControls 
            ref={controlsRef}
            makeDefault 
            minPolarAngle={0} 
            maxPolarAngle={Math.PI / 1.5} 
            enableDamping={true}
            dampingFactor={0.05}
            autoRotate={autoRotate}
            autoRotateSpeed={3.0}
        />
        <ScreenshotHandler ref={screenshotHandlerRef} />
        <Suspense fallback={<Html center><div className="flex flex-col items-center gap-2"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div><p className="text-xs text-indigo-600 font-bold uppercase tracking-widest">載入資源中...</p></div></Html>}>
            <ErrorBoundary key={modelUrl}>
                <InnerScene 
                    url={modelUrl}
                    selectedPart={selectedPart}
                    onPartSelect={onPartSelect}
                    textureMap={textureMap}
                />
                <Suspense fallback={null}>
                  <Environment 
                      preset={envPreset as any} 
                      environmentIntensity={envIntensity}
                      environmentRotation={[0, (envRotation * Math.PI) / 180, 0]}
                  />
                </Suspense>
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0001} />
            </ErrorBoundary>
        </Suspense>
      </Canvas>
      <Loader />
      {selectedPart && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/80 text-white px-5 py-3 rounded-full text-sm font-medium shadow-lg z-10 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></div>
          正在編輯：<span className="text-accent font-bold">{selectedPart.name}</span>
        </div>
      )}
    </div>
  );
});

export default ModelViewer;
