// src/SceneManager.ts
import * as THREE from 'three';
import { MeshLine, MeshLineMaterial } from './packages/three.meshline/THREE.MeshLine';

export class CustomAxes extends THREE.Group {
    constructor(axisLength = 100, lineWidth: number = 1) {
        const createAxis = (points: number[], color: number) => {
            const meshLine = new MeshLine();
            meshLine.setPoints(points);
            const material = new MeshLineMaterial({
                resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
                color: new THREE.Color(color),
                sizeAttenuation: 0,
                side: THREE.DoubleSide,
                lineWidth: lineWidth,
            });
            return new THREE.Mesh(meshLine, material);
        };

        const xAxisPoints = [0, 0, 0, axisLength, 0, 0]; // X axis
        const yAxisPoints = [0, 0, 0, 0, axisLength, 0]; // Y axis
        const zAxisPoints = [0, 0, 0, 0, 0, axisLength]; // Z axis

        super();

        this.add(createAxis(xAxisPoints, 0xff0000), createAxis(yAxisPoints, 0x00ff00), createAxis(zAxisPoints, 0x0000ff));
    }
}

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
        const gridHelper = new THREE.GridHelper(12 * 10, 12 * 10, 0xFFFFFF, 0x888888);
        this.scene.add(gridHelper);

        // Add Axes Helper
        const axes = new CustomAxes(10, 10);
        this.scene.add(axes);

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
