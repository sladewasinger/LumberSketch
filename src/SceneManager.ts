// src/SceneManager.ts
import * as THREE from 'three';

export class SceneManager {
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;
    public container: HTMLElement;

    constructor(container: HTMLElement) {
        this.container = container;

        // Create Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x444444);

        // Create Camera
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(50, 50, 50);
        this.camera.lookAt(0, 0, 0);

        // Create Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);

        // Add Grid Helper
        const gridHelper = new THREE.GridHelper(100, 100);
        this.scene.add(gridHelper);

        // Add Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(50, 100, 50);
        this.scene.add(directionalLight);
    }

    public onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
