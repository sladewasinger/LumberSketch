// src/BeamManager.ts
import * as THREE from 'three';
import { Beam } from './Beam';

export class BeamManager {
    private beamsGroup: THREE.Group;

    constructor(scene: THREE.Scene) {
        this.beamsGroup = new THREE.Group();
        scene.add(this.beamsGroup);
    }

    public addBeam(beam: Beam): void {
        this.beamsGroup.add(beam);
    }

    public getBeamsGroup(): THREE.Group {
        return this.beamsGroup;
    }
}
