// src/BeamManager.ts
import * as THREE from 'three';
import { Beam } from './Beam';
import { eventBus } from '../events/EventBus';
import { EVENT_BEAMS_DESELECTED, EVENT_BEAMS_SELECTED } from '../events/Constants';

export class BeamManager {
    private beamsGroup: THREE.Group;

    constructor(scene: THREE.Scene) {
        this.beamsGroup = new THREE.Group();
        scene.add(this.beamsGroup);

        eventBus.on(EVENT_BEAMS_SELECTED, (selectedBeams: Beam[]) => {
            for (const beam of selectedBeams) {
                beam.isSelected = true;
            }
        });
        eventBus.on(EVENT_BEAMS_DESELECTED, (selectedBeams: Beam[]) => {
            for (let child of this.beamsGroup.children) {
                let beam = child as Beam;
                beam.isSelected = false;
            }
        });
    }

    public addBeam(beam: Beam): void {
        this.beamsGroup.add(beam);
    }

    public removeBeam(beam: Beam) {
        this.beamsGroup.remove(beam);
    }

    public getBeamsGroup(): THREE.Group {
        return this.beamsGroup;
    }
}
