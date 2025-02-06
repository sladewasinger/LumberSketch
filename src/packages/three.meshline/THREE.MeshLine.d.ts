import { Vector3, BufferGeometry, ShaderMaterial, Color } from 'three';

export class MeshLine extends BufferGeometry {
    isMeshLine: boolean;
    setPoints(points: Vector3[] | Number[], wcb?: (p: Vector3) => void): void;
    setMatrixWorld: void;
    positions: Vector3[];
    _points: Vector3[];
    _attributes: {
        position: any;
        previous: any;
        next: any;
        side: any;
        width: any;
        uv: any;
        index: any;
        counters: any;
    };
}

export class MeshLineMaterial extends ShaderMaterial {
    color: Color;
    isMeshLineMaterial: boolean;
    lineWidth: any;
    constructor(parameters?: any);
}
export function MeshLineRaycast(raycaster: any, intersects: any): void;
export { };
