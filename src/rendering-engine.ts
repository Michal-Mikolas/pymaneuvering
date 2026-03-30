import * as THREE from 'three';
import { VesselProfile } from './vessels/types';
import {
  getDefaultFrustumSizeForVesselLength,
  getDefaultZoomMultiplierForViewport,
} from './zoom.js';

export class RenderingEngine {
  private static readonly VESSEL_ZOOM_TRANSITION_MS = 1000;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private container: HTMLElement;
  private frustumSize: number = getDefaultFrustumSizeForVesselLength(64);
  private baseFrustumSize: number = this.frustumSize;
  private zoomScale = 1;
  private environmentRotationGroup: THREE.Group;
  private environmentTranslationGroup: THREE.Group;
  private vesselMesh: THREE.Mesh | null = null;
  private pivotPointMesh: THREE.Mesh | null = null;
  private followShip = false;
  private showPivotPoint = false;
  private pivotPointOpacity = 0.2;
  private loadRequestId = 0;
  private currentVesselLength = 64;
  private currentDefaultZoom = 1;
  private currentDefaultZoomMobile = 1;
  private targetFrustumSize: number = this.frustumSize;
  private zoomTransition:
    | { startFrustumSize: number; targetFrustumSize: number; startTimeMs: number; durationMs: number }
    | null = null;
  private pinchStartDistance: number | null = null;
  private pinchStartZoomScale = 1;

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Initialize Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    // 2. Initialize Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.environmentRotationGroup = new THREE.Group();
    this.environmentTranslationGroup = new THREE.Group();
    this.environmentRotationGroup.add(this.environmentTranslationGroup);
    this.scene.add(this.environmentRotationGroup);

    // 3. Initialize Camera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.OrthographicCamera(
      (-this.frustumSize * aspect) / 2,
      (this.frustumSize * aspect) / 2,
      this.frustumSize / 2,
      -this.frustumSize / 2,
      0.1,
      1000
    );
    this.camera.position.set(0, 50, 0);
    this.camera.lookAt(0, 0, 0);

    // 4. Initialize Environment
    this.initWater();
    this.initBuoys();

    // 5. Handle Resize
    window.addEventListener('resize', () => this.onWindowResize());
    this.renderer.domElement.addEventListener('wheel', this.onMouseWheel, { passive: false });
    this.renderer.domElement.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.renderer.domElement.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.renderer.domElement.addEventListener('touchend', this.onTouchEnd);
    this.renderer.domElement.addEventListener('touchcancel', this.onTouchEnd);
  }

  private initWater() {
    const geometry = new THREE.PlaneGeometry(2000, 2000);
    const material = new THREE.MeshBasicMaterial({ color: 0x1e88e5 });
    const water = new THREE.Mesh(geometry, material);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -1; // Slightly below origins
    this.environmentTranslationGroup.add(water);
  }

  private initBuoys() {
    const buoyRadius = 0.5;
    const geometry = new THREE.CircleGeometry(buoyRadius, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.5,
    });

    for (let x = -200; x <= 200; x += 20) {
      for (let z = -200; z <= 200; z += 20) {
        const buoy = new THREE.Mesh(geometry, material);
        buoy.rotation.x = -Math.PI / 2;
        buoy.position.set(x, 0, z);
        this.environmentTranslationGroup.add(buoy);
      }
    }

    const pivotMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: this.pivotPointOpacity,
    });
    this.pivotPointMesh = new THREE.Mesh(geometry, pivotMaterial);
    this.pivotPointMesh.rotation.x = -Math.PI / 2;
    this.pivotPointMesh.position.y = 0.2;
    this.pivotPointMesh.visible = false;
    this.environmentTranslationGroup.add(this.pivotPointMesh);
  }

  private onWindowResize() {
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.updateAdaptiveZoomBase();
  }

  private updateCameraFrustum() {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.left = (-this.frustumSize * aspect) / 2;
    this.camera.right = (this.frustumSize * aspect) / 2;
    this.camera.top = this.frustumSize / 2;
    this.camera.bottom = -this.frustumSize / 2;
    this.camera.updateProjectionMatrix();
  }

  private readonly onMouseWheel = (event: WheelEvent) => {
    event.preventDefault();

    const zoomFactor = Math.exp(event.deltaY * 0.0015);
    this.setZoomScale(this.zoomScale * zoomFactor);
  };

  private readonly onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 2) {
      this.resetPinchZoom();
      return;
    }

    event.preventDefault();
    this.pinchStartDistance = this.getTouchDistance(event.touches);
    this.pinchStartZoomScale = this.zoomScale;
  };

  private readonly onTouchMove = (event: TouchEvent) => {
    if (event.touches.length !== 2 || this.pinchStartDistance === null) {
      return;
    }

    event.preventDefault();
    const currentDistance = this.getTouchDistance(event.touches);

    if (currentDistance <= 0) {
      return;
    }

    const pinchRatio = this.pinchStartDistance / currentDistance;
    this.setZoomScale(this.pinchStartZoomScale * pinchRatio);
  };

  private readonly onTouchEnd = (event: TouchEvent) => {
    if (event.touches.length < 2) {
      this.resetPinchZoom();
      return;
    }

    this.pinchStartDistance = this.getTouchDistance(event.touches);
    this.pinchStartZoomScale = this.zoomScale;
  };

  private getTouchDistance(touches: TouchList): number {
    if (touches.length < 2) {
      return 0;
    }

    const firstTouch = touches[0];
    const secondTouch = touches[1];
    return Math.hypot(
      secondTouch.clientX - firstTouch.clientX,
      secondTouch.clientY - firstTouch.clientY
    );
  }

  private resetPinchZoom() {
    this.pinchStartDistance = null;
  }

  private setZoomScale(nextZoomScale: number) {
    this.zoomTransition = null;
    this.zoomScale = THREE.MathUtils.clamp(nextZoomScale, 0.25, 6);
    this.targetFrustumSize = this.baseFrustumSize * this.zoomScale;
    this.frustumSize = this.targetFrustumSize;
    this.updateCameraFrustum();
  }

  private updateAdaptiveZoomBase() {
    const defaultFrustumSize = getDefaultFrustumSizeForVesselLength(this.currentVesselLength);
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const viewportZoomMultiplier = getDefaultZoomMultiplierForViewport(
      window.innerWidth,
      window.innerHeight,
      coarsePointer
    );
    const vesselZoomMultiplier = viewportZoomMultiplier > 1
      ? this.currentDefaultZoomMobile
      : this.currentDefaultZoom;
    this.baseFrustumSize = defaultFrustumSize * viewportZoomMultiplier * vesselZoomMultiplier;
    this.targetFrustumSize = this.baseFrustumSize * this.zoomScale;

    if (this.zoomTransition) {
      this.zoomTransition.targetFrustumSize = this.targetFrustumSize;
      return;
    }

    this.frustumSize = this.targetFrustumSize;
    this.updateCameraFrustum();
  }

  private setAdaptiveZoom(profile: VesselProfile) {
    const startFrustumSize = this.frustumSize;
    this.currentVesselLength = profile.dimensions.length;
    this.currentDefaultZoom = profile.defaultZoom;
    this.currentDefaultZoomMobile = profile.defaultZoomMobile;
    this.zoomScale = 1;
    this.updateAdaptiveZoomBase();
    this.startZoomTransition(startFrustumSize, this.targetFrustumSize);
  }

  private startZoomTransition(startFrustumSize: number, targetFrustumSize: number) {
    if (Math.abs(startFrustumSize - targetFrustumSize) < 0.001) {
      this.zoomTransition = null;
      this.frustumSize = targetFrustumSize;
      this.updateCameraFrustum();
      return;
    }

    this.frustumSize = startFrustumSize;
    this.zoomTransition = {
      startFrustumSize,
      targetFrustumSize,
      startTimeMs: performance.now(),
      durationMs: RenderingEngine.VESSEL_ZOOM_TRANSITION_MS,
    };
    this.updateCameraFrustum();
  }

  private updateZoomTransition() {
    if (!this.zoomTransition) {
      return;
    }

    const elapsedMs = performance.now() - this.zoomTransition.startTimeMs;
    const rawProgress = elapsedMs / this.zoomTransition.durationMs;
    const progress = THREE.MathUtils.clamp(rawProgress, 0, 1);
    const easedProgress = 1 - Math.pow(1 - progress, 3);

    this.frustumSize = THREE.MathUtils.lerp(
      this.zoomTransition.startFrustumSize,
      this.zoomTransition.targetFrustumSize,
      easedProgress
    );
    this.updateCameraFrustum();

    if (progress >= 1) {
      this.frustumSize = this.zoomTransition.targetFrustumSize;
      this.zoomTransition = null;
      this.updateCameraFrustum();
    }
  }

  private removeCurrentVessel() {
    if (!this.vesselMesh) {
      return;
    }

    this.scene.remove(this.vesselMesh);
    this.vesselMesh.geometry.dispose();

    const material = this.vesselMesh.material;
    if (Array.isArray(material)) {
      material.forEach((entry) => {
        entry.map?.dispose();
        entry.dispose();
      });
    } else {
      material.map?.dispose();
      material.dispose();
    }

    this.vesselMesh = null;
  }

  public async loadVessel(profile: VesselProfile) {
    const requestId = ++this.loadRequestId;
    this.removeCurrentVessel();
    this.setAdaptiveZoom(profile);

    const loader = new THREE.TextureLoader();

    try {
      const texture = await new Promise<THREE.Texture>((resolve, reject) => {
        loader.load(
          profile.assets.sprite2DPath,
          (tex) => resolve(tex),
          undefined,
          (err) => reject(err)
        );
      });

      if (requestId !== this.loadRequestId) {
        texture.dispose();
        return;
      }

      const geometry = new THREE.PlaneGeometry(profile.dimensions.beam, profile.dimensions.length);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.8,
      });
      const vessel = new THREE.Mesh(geometry, material);
      vessel.rotation.x = -Math.PI / 2;
      vessel.position.y = 0.1; // Above water and buoys
      this.scene.add(vessel);
      this.vesselMesh = vessel;
      this.setVesselOpacity(0.8);
    } catch (error) {
      if (requestId !== this.loadRequestId) {
        return;
      }

      console.warn(`Failed to load sprite for ${profile.name}, using fallback:`, error);
      const geometry = new THREE.PlaneGeometry(profile.dimensions.beam, profile.dimensions.length);
      const material = new THREE.MeshBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.8,
      });
      const fallbackVessel = new THREE.Mesh(geometry, material);
      fallbackVessel.rotation.x = -Math.PI / 2;
      fallbackVessel.position.y = 0.1;
      this.scene.add(fallbackVessel);
      this.vesselMesh = fallbackVessel;
      this.setVesselOpacity(0.8);
    }
  }

  public setShowPivotPoint(show: boolean) {
    this.showPivotPoint = show;

    if (this.pivotPointMesh && !show) {
      this.pivotPointMesh.visible = false;
    }
  }

  public setFollowShip(follow: boolean) {
    this.followShip = follow;
  }

  public setPivotPointOpacity(opacity: number) {
    this.pivotPointOpacity = THREE.MathUtils.clamp(opacity, 0, 1);

    if (!this.pivotPointMesh) {
      return;
    }

    const material = this.pivotPointMesh.material;
    material.transparent = this.pivotPointOpacity < 1;
    material.opacity = this.pivotPointOpacity;
  }

  public setVesselOpacity(opacity: number) {
    if (!this.vesselMesh) {
      return;
    }

    const clampedOpacity = THREE.MathUtils.clamp(opacity, 0, 1);
    const material = this.vesselMesh.material;

    if (Array.isArray(material)) {
      material.forEach((entry) => {
        entry.transparent = clampedOpacity < 1;
        entry.opacity = clampedOpacity;
      });
      return;
    }

    material.transparent = clampedOpacity < 1;
    material.opacity = clampedOpacity;
  }

  /**
   * Keeps the vessel centered on screen while optionally rotating the
   * environment into ship-relative view.
   */
  public updateVesselTransform(
    position: { x: number, y: number, z: number },
    rotationY: number,
    pivotPoint: { x: number, y: number, z: number } | null
  ) {
    if (!this.vesselMesh) return;

    if (this.followShip) {
      this.vesselMesh.position.set(0, 0.1, 0);
      this.vesselMesh.rotation.z = 0;
      this.environmentTranslationGroup.position.set(-position.x, 0, -position.z);
      this.environmentRotationGroup.rotation.set(0, -rotationY, 0);
    } else {
      this.vesselMesh.position.set(0, 0.1, 0);
      this.vesselMesh.rotation.z = rotationY;
      this.environmentTranslationGroup.position.set(-position.x, 0, -position.z);
      this.environmentRotationGroup.rotation.set(0, 0, 0);
    }

    if (this.pivotPointMesh) {
      this.pivotPointMesh.visible = this.showPivotPoint && pivotPoint !== null;
      if (pivotPoint) {
        this.pivotPointMesh.position.set(pivotPoint.x, 0.2, pivotPoint.z);
      }
    }
  }

  public render() {
    this.updateZoomTransition();
    this.renderer.render(this.scene, this.camera);
  }
}
