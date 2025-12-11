import React, { useEffect, useState, Suspense, useRef, useCallback, useMemo, ErrorInfo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html, Loader, Environment, PerspectiveCamera, Center, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { SelectedPart, TextureConfig } from '../types';

// Reliable sneaker model URL from Khronos Group samples via jsDelivr CDN
const DEFAULT_MODEL_URL = "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/MaterialsVariantsShoe/glTF-Binary/MaterialsVariantsShoe.glb";

// Define allowed interactive parts
const INTERACTIVE_PARTS = ['Plane005_1', 'Line030_1', 'Plane009_1'];

interface ScreenshotHandlerProps {
    gl: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.Camera;
}

// Screenshot Handler Component
const ScreenshotHandler = React.forwardRef((props, ref) => {
    const { gl, scene, camera } = useThree();

    React.useImperativeHandle(ref, () => ({
        captureComposition: async () => {
            return new Promise<string>((resolve) => {
                // 1. Setup - Save original state
                const originalPosition = camera.position.clone();
                const originalRotation = camera.rotation.clone();
                const originalAspect = (camera as THREE.PerspectiveCamera).aspect;
                
                // Define 2K Resolution
                const totalWidth = 2560;
                const totalHeight = 1440;
                
                // Layout Dimensions
                const leftWidth = Math.floor(totalWidth * (2/3)); // ~1706px
                const rightWidth = totalWidth - leftWidth;        // ~854px
                const rowHeight = totalHeight / 3;                // 480px

                // Create compositing canvas
                const canvas = document.createElement('canvas');
                canvas.width = totalWidth;
                canvas.height = totalHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve('');
                    return;
                }

                // White Background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, totalWidth, totalHeight);

                // Helper to render and draw to canvas with "contain" fit
                const renderAndDraw = (x: number, y: number, w: number, h: number, camPos: THREE.Vector3, lookAt: THREE.Vector3) => {
                     // Position Camera
                     camera.position.copy(camPos);
                     camera.lookAt(lookAt);
                     camera.updateMatrixWorld();
                     
                     // Adjust aspect ratio for the render target (optional, but helps framing)
                     // Here we just render full gl canvas and crop/fit later
                     
                     // Render
                     gl.render(scene, camera);
                     
                     // Copy to temp canvas to allow cropping/scaling
                     const tempCanvas = document.createElement('canvas');
                     tempCanvas.width = gl.domElement.width;
                     tempCanvas.height = gl.domElement.height;
                     const tempCtx = tempCanvas.getContext('2d');
                     if(tempCtx) {
                         tempCtx.drawImage(gl.domElement, 0, 0);
                         
                         // Calculate Aspect Ratios
                         const srcAspect = tempCanvas.width / tempCanvas.height;
                         const destAspect = w / h;
                         
                         let drawW, drawH, drawX, drawY;
                         
                         // Contain logic (fit within box maintaining aspect ratio)
                         if (srcAspect > destAspect) {
                             // Source is wider than dest: fit to width
                             drawW = w;
                             drawH = w / srcAspect;
                             drawX = x;
                             drawY = y + (h - drawH) / 2;
                         } else {
                             // Source is taller than dest: fit to height
                             drawH = h;
                             drawW = h * srcAspect;
                             drawY = y;
                             drawX = x + (w - drawW) / 2;
                         }

                         ctx.drawImage(tempCanvas, drawX, drawY, drawW, drawH);
                     }
                };

                const lookAtCenter = new THREE.Vector3(0, 0, 0);

                // A. Main View (Left Column)
                // Use original camera position but re-render to ensure fresh buffer
                renderAndDraw(0, 0, leftWidth, totalHeight, originalPosition, lookAtCenter);

                // B. Top View (Right Top)
                renderAndDraw(leftWidth, 0, rightWidth, rowHeight, new THREE.Vector3(0, 0.5, 0), lookAtCenter);

                // C. Front View (Right Middle)
                // Assuming Front is +Z or similar suitable angle for shoe
                renderAndDraw(leftWidth, rowHeight, rightWidth, rowHeight, new THREE.Vector3(0, 0, 0.5), lookAtCenter);

                // D. Back View (Right Bottom)
                renderAndDraw(leftWidth, rowHeight * 2, rightWidth, rowHeight, new THREE.Vector3(0, 0, -0.5), lookAtCenter);

                // Restore Camera
                camera.position.copy(originalPosition);
                camera.rotation.copy(originalRotation);
                (camera as THREE.PerspectiveCamera).aspect = originalAspect;
                camera.updateProjectionMatrix();
                
                // Return Data URL
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
  textureMap: Record<string, TextureConfig | null>; // Map mesh UUID to texture config
  onResetCamera?: () => void;
}

const Model: React.FC<ModelProps> = ({ url, selectedPart, onPartSelect, textureMap, onResetCamera }) => {
  const { scene } = useGLTF(url);
  const [hovered, setHovered] = useState<string | null>(null);
  
  // FIX: Cast 'primitive' to any to avoid JSX.IntrinsicElements error
  const Primitive = 'primitive' as any;

  // Apply textures when textureMap updates
  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        
        // Enable Shadows
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Handle material cloning to avoid affecting shared materials
        // Store original material in userData if not present
        if (!mesh.userData.originalMaterial) {
            // Store the material as is (could be array or single)
            mesh.userData.originalMaterial = mesh.material;
        }

        const config = textureMap[mesh.uuid];

        if (config) {
          // If a config exists for this part
          
          // Get the original material to clone properties from
            const originalMat = Array.isArray(mesh.userData.originalMaterial) 
                ? mesh.userData.originalMaterial[0] 
                : mesh.userData.originalMaterial;

            if (originalMat) {
                const newMaterial = originalMat.clone();
                
                // 1. Apply Color (Tint or Solid)
                if (config.color) {
                    if ('color' in newMaterial) {
                        (newMaterial as THREE.MeshStandardMaterial).color.set(config.color);
                    }
                } else {
                     // If no specific color is set, default to white so texture works
                     if ('color' in newMaterial) {
                        (newMaterial as THREE.MeshStandardMaterial).color.setHex(0xffffff);
                     }
                }

                // 2. Apply Texture if URL exists
                if (config.url) {
                    const loader = new THREE.TextureLoader();
                    loader.load(config.url, (texture) => {
                        texture.flipY = false;
                        texture.colorSpace = THREE.SRGBColorSpace;
                        texture.wrapS = THREE.RepeatWrapping;
                        texture.wrapT = THREE.RepeatWrapping;
                        texture.repeat.set(config.scale, config.scale);
                        texture.offset.set(config.offsetX, config.offsetY);
                        texture.center.set(0.5, 0.5); 
                        texture.rotation = (config.rotation * Math.PI) / 180;

                        newMaterial.map = texture;
                        newMaterial.needsUpdate = true;
                    });
                } else {
                    // No texture URL, clear map
                    newMaterial.map = null;
                }

                // 3. Apply PBR Properties
                if ('roughness' in newMaterial) {
                    (newMaterial as THREE.MeshStandardMaterial).roughness = config.roughness;
                }
                if ('metalness' in newMaterial) {
                    (newMaterial as THREE.MeshStandardMaterial).metalness = config.metalness;
                }
                
                // 4. Apply Opacity
                newMaterial.opacity = config.opacity;
                newMaterial.transparent = config.opacity < 1.0;
                newMaterial.alphaTest = 0; 
                newMaterial.side = THREE.DoubleSide;

                newMaterial.needsUpdate = true;
                
                // Assign new material
                mesh.material = newMaterial;
            }
        } else {
            // Revert to original material
            
            // CRITICAL FIX: Ensure interactive parts get a UNIQUE copy of the material.
            if (INTERACTIVE_PARTS.includes(mesh.name)) {
                 const originalMat = Array.isArray(mesh.userData.originalMaterial) 
                    ? mesh.userData.originalMaterial[0] 
                    : mesh.userData.originalMaterial;
                 
                 if (originalMat) {
                     // Clone the material to make it unique to this mesh instance
                     mesh.material = originalMat.clone();
                 }
            } else {
                 // Non-interactive parts can safely use the shared original material
                 if (mesh.userData.originalMaterial) {
                    mesh.material = mesh.userData.originalMaterial;
                 }
            }
        }
      }
    });
  }, [scene, textureMap]);

  // Handle pointer events
  const handlePointerOver = (e: any) => {
    e.stopPropagation();
    const mesh = e.object as THREE.Mesh;
    
    // Only allow hover effect for specific parts
    if (INTERACTIVE_PARTS.includes(mesh.name)) {
        setHovered(e.object.uuid);
        document.body.style.cursor = 'pointer';
    }
  };

  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    setHovered(null);
    document.body.style.cursor = 'auto';
  };

  const handleClick = (e: any) => {
    e.stopPropagation();
    const mesh = e.object as THREE.Mesh;
    
    // Strict filtering
    if (!INTERACTIVE_PARTS.includes(mesh.name)) {
        onPartSelect(null);
        return;
    }

    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    
    onPartSelect({
      name: mesh.name || 'Unnamed Part',
      materialName: material.name || 'Unnamed Material',
      id: mesh.uuid
    });
  };

  const handleDoubleClick = (e: any) => {
      e.stopPropagation();
      if (onResetCamera) {
          onResetCamera();
      }
  };

  // Animation Loop for Highlights
  useFrame(() => {
     scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            
            // Only apply effects to interactive parts
            if (!INTERACTIVE_PARTS.includes(mesh.name)) return;

            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            
            materials.forEach((material) => {
                if (material && 'emissive' in material) {
                     const mat = material as THREE.MeshStandardMaterial;
                     
                     let targetEmissive = new THREE.Color(0x000000); // Default: no emissive
                     let targetIntensity = 0;

                     if (mesh.uuid === hovered) {
                        // Increase brightness by ~30%
                        targetEmissive.setHex(0xffffff);
                        targetIntensity = 0.3; 
                     } else if (mesh.uuid === selectedPart?.id) {
                        // Maintain a subtle highlight for selected part
                        targetEmissive.setHex(0x222222); 
                        targetIntensity = 0.2;
                     }

                     mat.emissive.copy(targetEmissive);
                     mat.emissiveIntensity = targetIntensity;
                }
            });
        }
    });
  });

  return <Primitive 
            object={scene} 
            rotation={[0, Math.PI, 0]} // Rotate 180 degrees
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
          />;
};

// Custom comparison function for React.memo
const arePropsEqual = (prevProps: ModelProps, nextProps: ModelProps) => {
    return (
        prevProps.url === nextProps.url &&
        prevProps.selectedPart === nextProps.selectedPart &&
        prevProps.textureMap === nextProps.textureMap 
    );
};

// Separated and Memoized Scene Content
const InnerScene = React.memo(({ url, selectedPart, onPartSelect, textureMap, onResetCamera }: ModelProps) => {
    const [modelBottom, setModelBottom] = useState(-0.1);

    return (
        <group>
            {/* Align model to geometric center */}
            <Center onCentered={({ height }) => setModelBottom(-height / 2)}>
                <Model 
                    url={url} 
                    selectedPart={selectedPart} 
                    onPartSelect={onPartSelect}
                    textureMap={textureMap}
                    onResetCamera={onResetCamera}
                />
            </Center>
            {/* Shadow positioned exactly at the bottom */}
            <ContactShadows 
                position={[0, modelBottom, 0]}
                opacity={0.8} 
                scale={1} 
                blur={2.5} 
                far={1} 
                resolution={512} 
                color="#000000" 
            />
        </group>
    );
}, arePropsEqual);

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

// Error Boundary
// FIX: Use React.Component to ensure props are correctly typed and available
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error("Model Loading Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Html center>
          <div className="bg-white/90 p-6 rounded-lg shadow-xl border border-red-200 text-center w-80 backdrop-blur-sm">
            <div className="text-red-500 font-bold mb-2 text-lg">Load Failed</div>
            <p className="text-sm text-gray-600 mb-4">Could not load the 3D model.</p>
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
    modelFile, 
    selectedPart, 
    onPartSelect, 
    textureMap,
    envPreset,
    envIntensity,
    envRotation,
    autoRotate
}, ref) => {
  const [modelUrl, setModelUrl] = useState<string>(DEFAULT_MODEL_URL);
  const controlsRef = useRef<any>(null);
  const screenshotHandlerRef = useRef<any>(null);

  // Expose capture function to parent
  React.useImperativeHandle(ref, () => ({
      captureComposition: () => {
          if (screenshotHandlerRef.current) {
              return screenshotHandlerRef.current.captureComposition();
          }
          return Promise.resolve('');
      }
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

  // FIX: Cast lights to any
  const AmbientLight = 'ambientLight' as any;
  const DirectionalLight = 'directionalLight' as any;

  const handleResetCamera = useCallback(() => {
      controlsRef.current?.reset();
  }, []);

  return (
    <div className="w-full h-full bg-gray-100 relative">
      <Canvas 
          shadows 
          dpr={[1, 2]}
          gl={{ preserveDrawingBuffer: true }} // Required for screenshots
          onPointerMissed={(e) => {
            if (e.type === 'click') {
                onPartSelect(null);
            }
          }}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 0.5]} fov={45} near={0.01} />
        
        <OrbitControls 
            ref={controlsRef}
            makeDefault 
            minPolarAngle={0} 
            maxPolarAngle={Math.PI / 1.5} 
            enableDamping={true}
            autoRotate={autoRotate}
            autoRotateSpeed={3.0}
        />

        <ScreenshotHandler ref={screenshotHandlerRef} />

        <Suspense fallback={<Html center><Loader /></Html>}>
            <ErrorBoundary key={modelUrl}>
                <InnerScene 
                    url={modelUrl}
                    selectedPart={selectedPart}
                    onPartSelect={onPartSelect}
                    textureMap={textureMap}
                    onResetCamera={handleResetCamera}
                />
                
                <AmbientLight intensity={envIntensity * 0.2} />
                <DirectionalLight 
                    position={[1, 2, 1]} 
                    intensity={envIntensity * 0.8} 
                    castShadow 
                    shadow-bias={-0.0001}
                />

                <Suspense fallback={null}>
                  <Environment 
                      preset={envPreset as any} 
                      environmentIntensity={envIntensity}
                      environmentRotation={[0, (envRotation * Math.PI) / 180, 0]}
                  />
                </Suspense>
            </ErrorBoundary>
        </Suspense>
      </Canvas>
      <Loader />
      
      {/* Removed Title Overlay */}

       {selectedPart && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/80 text-white px-5 py-3 rounded-full text-sm font-medium shadow-lg z-10 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
          Editing: <span className="text-accent font-bold">{selectedPart.name}</span>
        </div>
      )}
    </div>
  );
});

export default ModelViewer;