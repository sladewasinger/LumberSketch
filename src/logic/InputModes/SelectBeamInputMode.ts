import { EVENT_BEAM_SELECTION_CHANGED } from "../../events/Constants";
import { eventBus } from "../../events/EventBus";
import { AppState } from "../AppState";
import { Beam } from "../Beam";
import { BeamManager } from "../BeamManager";
import { InputMode } from "./InputMode";
import * as THREE from "three";

export class SelectBeamInputMode extends InputMode {
    appState: AppState;
    mouse1Down = false;
    intersectionOnBeam: THREE.Vector3 | null = null;
    prevMouseIntersection: THREE.Vector3 | null = null;
    curMouseIntersection: THREE.Vector3 | null = null;
    orientation: THREE.Vector3 = new THREE.Vector3(1, 0, 0);

    constructor(private beamManager: BeamManager) {
        super();
        this.appState = AppState.getInstance();
        document.body.style.cursor = 'pointer';
    }

    onMouseDown(event: MouseEvent): void {
        if (event.button !== 0) return;
        this.mouse1Down = true;

        const rayCaster = new THREE.Raycaster();
        rayCaster.setFromCamera(this.appState.mousePos, this.appState.camera);
        const intersects = rayCaster.intersectObjects(this.beamManager.getBeams(), false);

        let intersection = new THREE.Vector3();
        if (intersects.length > 0) {
            const beam = intersects[0].object as Beam;
            intersection = intersects[0].point;

            this.appState.selectedBeam = beam;
            this.intersectionOnBeam = intersection.clone();
            this.curMouseIntersection = intersection;
            this.prevMouseIntersection = this.curMouseIntersection.clone();
        } else {
            this.appState.selectedBeam = null;
            this.prevMouseIntersection = null;
            this.intersectionOnBeam = null;
        }

        eventBus.emit(EVENT_BEAM_SELECTION_CHANGED);
    }

    onMouseMove(event: MouseEvent): void {
        const beam = this.appState.selectedBeam;
        if (!beam || !this.mouse1Down || !this.prevMouseIntersection || !this.intersectionOnBeam) return;

        console.log('here');

        const rayCaster = new THREE.Raycaster();
        rayCaster.setFromCamera(this.appState.mousePos, this.appState.camera);
        const intersects = rayCaster.intersectObjects(this.beamManager.getBeams().filter(x => x != beam), false);

        let intersection = new THREE.Vector3();
        let posY = beam.position.y;
        if (intersects.length > 0) {
            let y = intersects[0].point.y;
            const originalIntersectionPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), this.intersectionOnBeam.y);
            rayCaster.ray.intersectPlane(originalIntersectionPlane, intersection)!;
            intersection.setY(y);
            posY = y + (beam.dimensions.height / 2);
        } else {
            const originalIntersectionPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), this.intersectionOnBeam.y);
            rayCaster.ray.intersectPlane(originalIntersectionPlane, intersection)!;
            posY = beam.dimensions.height / 2;
        }

        this.curMouseIntersection = intersection;
        let deltaX = this.curMouseIntersection.x - this.prevMouseIntersection.x;
        let deltaZ = this.curMouseIntersection.z - this.prevMouseIntersection.z;

        if (this.appState.keysDown.has('z')) {
            deltaX = 0;
            posY = beam.position.y;
        }
        if (this.appState.keysDown.has('x')) {
            deltaZ = 0;
            posY = beam.position.y;
        }

        if (Math.abs(beam.position.y - posY) > 0.01) {
            this.intersectionOnBeam.setY(posY + (this.intersectionOnBeam.y - beam.position.y));
        }
        beam.position.setY(posY);
        beam.position.add(new THREE.Vector3(deltaX, 0, deltaZ));
        this.prevMouseIntersection = this.curMouseIntersection.clone();
    }

    onMouseUp(event: MouseEvent): void {
        if (event.button !== 0) return;
        this.mouse1Down = false;
    }

    onKeyDown(event: KeyboardEvent): void {
        const key = event.key.toLowerCase();
        if (key === 'delete' || key === 'd') {
            if (this.appState.selectedBeam) {
                this.beamManager.deleteBeam(this.appState.selectedBeam);
            }
        }
        if (key === 'r') {
            const beam = this.appState.selectedBeam;
            if (beam) {
                if (this.orientation.x === 1) {
                    this.orientation = new THREE.Vector3(0, 0, 1);
                } else if (this.orientation.z === 1) {
                    this.orientation = new THREE.Vector3(1, 0, 0);
                }
                this.setBeamOrientation();
            }
        }
    }

    setBeamOrientation() {
        if (!this.appState.selectedBeam) return;

        this.appState.selectedBeam.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), this.orientation);
    }

    destroy(): void {
        document.body.style.cursor = 'default';
    }
}