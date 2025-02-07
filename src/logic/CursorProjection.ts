import * as THREE from 'three';
import { Beam } from './Beam';
import { getGroundIntersection } from './Utils';
import { BeamManager } from './BeamManager';

export class CursorProjection {
    public raycaster: THREE.Raycaster;
    public mouse: THREE.Vector2;
    public cursor: Beam;

    constructor(
        public scene: THREE.Scene,
        public camera: THREE.PerspectiveCamera,
        public renderer: THREE.WebGLRenderer,
        public beamManager: BeamManager
    ) {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.cursor = new Beam({ length: 3.5, height: 1.5, depth: 3.5 });
        this.cursor.setOpacity(0.5);
        this.scene.add(this.cursor);

        window.addEventListener('mousemove', this.onMouseMove.bind(this));
    }

    public project(cursorX: number, cursorY: number, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer): THREE.Vector3 | null {
        this.raycaster.setFromCamera(this.mouse, camera);

        const intersects = this.raycaster.intersectObjects(this.beamManager.getBeamsGroup().children, false);

        if (intersects.length > 0) {
            const beam = intersects[0].object as Beam;
            if (beam) {
                return intersects[0].point.add(new THREE.Vector3(0, beam.dimensions.height / 2, 0));
            }
        }

        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(groundPlane, intersection);
        return intersection;
    }

    update() {
        const projection = this.project(this.mouse.x, this.mouse.y, this.camera, this.renderer);
        if (!projection) {
            return;
        }

        this.cursor.position.copy(projection);
        this.cursor.updateMatrixWorld();
    }

    private onMouseMove(event: MouseEvent): void {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }
}