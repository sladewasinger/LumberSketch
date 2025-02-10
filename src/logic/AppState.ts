import { Beam } from "./Beam";
import * as THREE from "three";

export type GuiInputMode = 'place-beam' | 'select-beam' | 'cut-beam' | null;
export type GuiState = {
    inputMode: GuiInputMode;
};

export class AppState {
    private static instance: AppState;

    public scene: THREE.Scene = new THREE.Scene();
    public camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    public guiState: GuiState = {
        inputMode: null,
    };

    public selectedBeam: Beam | null = null;
    public mousePos: THREE.Vector2 = new THREE.Vector2(0, 0);
    public container: HTMLElement | null = null;

    // Input Related:
    public keysDown: Set<string> = new Set();

    private constructor() { }

    static getInstance(): AppState {
        if (!AppState.instance) {
            AppState.instance = new AppState();
        }
        return AppState.instance;
    }
}
