// src/BeamManager.ts
import * as THREE from 'three';
import { Beam } from './Beam';
import { eventBus } from './EventBus';

export class BeamManager {
    private beamsGroup: THREE.Group;

    constructor(scene: THREE.Scene) {
        this.beamsGroup = new THREE.Group();
        scene.add(this.beamsGroup);

        // Listen for selection events:
        eventBus.on('selectionChanged', (selectedObjects: THREE.Object3D[]) => {
            for (const beam of this.beamsGroup.children) {
                if (selectedObjects.includes(beam)) {
                    (beam as Beam).isSelected = true;
                } else {
                    (beam as Beam).isSelected = false;
                }
            };
        });
    }

    public addBeam(beam: Beam): void {
        this.beamsGroup.add(beam);
    }

    public getBeamsGroup(): THREE.Group {
        return this.beamsGroup;
    }
}
