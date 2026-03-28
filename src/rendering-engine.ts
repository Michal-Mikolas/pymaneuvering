import * as THREE from 'three';
import { VesselProfile } from './vessels/types';

export class RenderingEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private container: HTMLElement;
  private frustumSize: number = 150; // 150 meters across
  private environmentRotationGroup: THREE.Group;
  private environmentTranslationGroup: THREE.Group;
  private vesselMesh: THREE.Mesh | null = null;
  private pivotPointMesh: THREE.Mesh | null = null;
  private followShip = true;
  private showPivotPoint = false;

  constructor(container: HTMLElement) {
    this.container = container;
    
    // 1. Initialize Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
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

    const pivotMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.pivotPointMesh = new THREE.Mesh(geometry, pivotMaterial);
    this.pivotPointMesh.rotation.x = -Math.PI / 2;
    this.pivotPointMesh.position.y = 0.2;
    this.pivotPointMesh.visible = false;
    this.environmentTranslationGroup.add(this.pivotPointMesh);
  }

  private onWindowResize() {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.left = (-this.frustumSize * aspect) / 2;
    this.camera.right = (this.frustumSize * aspect) / 2;
    this.camera.top = this.frustumSize / 2;
    this.camera.bottom = -this.frustumSize / 2;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  public async loadVessel(profile: VesselProfile) {
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
   * Updates the vessel and applies an inverse transform to the environment
   * when ship-follow mode is enabled.
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
      this.vesselMesh.position.set(position.x, 0.1, position.z);
      this.vesselMesh.rotation.z = rotationY;
      this.environmentTranslationGroup.position.set(0, 0, 0);
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
    this.renderer.render(this.scene, this.camera);
  }
}
