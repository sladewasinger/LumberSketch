import { AppState } from "../logic/AppState";
import { BeamManager } from "../logic/Beam/BeamManager";
import { ControlsManager } from "../logic/ControlsManager";
import { CursorProjection } from "../logic/CursorProjection";
import { GuiManager } from "../logic/GuiManager";
import { InputManager } from "../logic/Input/InputManager";
import { PlaceBeamInputMode } from "../logic/Input/PlaceBeamInputMode";
import { SelectBeamInputMode } from "../logic/Input/SelectBeamInputMode";
import { MeasurementDisplay } from "../logic/MeasurementDisplay";
import { PostProcessingManager } from "../logic/PostProcessingManager";
import { SceneManager } from "../logic/SceneManager";

export class DependencyContainer {
    private static instance: DependencyContainer;

    public sceneManager: SceneManager;
    public controlsManager: ControlsManager;
    public postProcessingManager: PostProcessingManager;
    public beamManager: BeamManager;
    public measurementDisplay: MeasurementDisplay;
    public inputManager: InputManager;
    public cursorProjection: CursorProjection;
    public guiManager: GuiManager;

    private constructor(container: HTMLElement, measurementDiv: HTMLElement) {
        const appState = AppState.getInstance();

        this.sceneManager = new SceneManager(container);
        this.controlsManager = new ControlsManager(this.sceneManager.renderer.domElement);
        this.postProcessingManager = new PostProcessingManager(
            this.sceneManager.renderer
        );
        this.beamManager = new BeamManager();
        this.measurementDisplay = new MeasurementDisplay(measurementDiv);
        this.inputManager = new InputManager(this.beamManager);
        this.cursorProjection = new CursorProjection(
            this.sceneManager.renderer,
            this.beamManager
        );
        this.guiManager = new GuiManager();

        this.inputManager.inputMode = new SelectBeamInputMode(this.beamManager);
    }

    public static getInstance(container?: HTMLElement, measurementDiv?: HTMLElement): DependencyContainer {
        if (!DependencyContainer.instance) {
            if (!container || !measurementDiv) {
                throw new Error("DependencyContainer must be initialized with container elements.");
            }
            DependencyContainer.instance = new DependencyContainer(container, measurementDiv);
        }
        return DependencyContainer.instance;
    }
}
