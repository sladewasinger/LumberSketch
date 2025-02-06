// src/ControlsManager.ts
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class ControlsManager {
    public controls: OrbitControls;

    constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
        this.controls = new OrbitControls(camera, domElement);
        // (Customize the mouse button mapping if desired)
        this.controls.mouseButtons = { MIDDLE: THREE.MOUSE.PAN };

    }

    public update(): void {
        this.controls.update();
    }
}
