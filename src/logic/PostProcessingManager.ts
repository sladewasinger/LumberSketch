import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { eventBus } from '../events/EventBus';
import { EVENT_BEAM_SELECTION_CHANGED } from '../events/Constants';
import { AppState } from './AppState';

export class PostProcessingManager {
    public composer: EffectComposer;

    constructor(renderer: THREE.WebGLRenderer) {
        const appState = AppState.getInstance();
        const scene = appState.scene;
        const camera = appState.camera;

        this.composer = new EffectComposer(renderer);

        const renderPass = new RenderPass(scene, camera);

        let outlinePass = new OutlinePass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            scene,
            camera
        );
        outlinePass.edgeStrength = 3.0;
        outlinePass.edgeGlow = 0.0;
        outlinePass.edgeThickness = 1.0;
        outlinePass.pulsePeriod = 0;
        outlinePass.visibleEdgeColor.set('red');
        outlinePass.hiddenEdgeColor.set('yellow');
        outlinePass.selectedObjects = [];

        let effectFXAA = new ShaderPass(FXAAShader);
        effectFXAA.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);

        var gammaCorrection = new ShaderPass(GammaCorrectionShader)

        this.composer.addPass(renderPass);
        this.composer.addPass(outlinePass);
        this.composer.addPass(effectFXAA)
        this.composer.addPass(gammaCorrection);

        this.onWindowResize();

        // Listen for selection events:
        eventBus.on(EVENT_BEAM_SELECTION_CHANGED, () => {
            if (appState.selectedBeam === null)
                outlinePass.selectedObjects = [];
            else
                outlinePass.selectedObjects = [appState.selectedBeam]
        });
    }

    public render(): void {
        this.composer.render();
    }

    public onWindowResize(): void {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.composer.setSize(width, height);
    }
}
