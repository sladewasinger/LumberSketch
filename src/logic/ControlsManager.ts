// src/ControlsManager.ts
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class ControlsManager {
    public controls: OrbitControls;

    constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
        this.controls = new OrbitControls(camera, domElement);
        this.controls.mouseButtons = { MIDDLE: THREE.MOUSE.PAN };
        this.controls.touches = { ONE: null, TWO: THREE.TOUCH.PAN };
    }

    public update(): void {
        this.controls.update();
    }
}
