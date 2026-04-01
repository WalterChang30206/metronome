import { state } from '../state/metronomeState.svelte'
import { MetronomeSmooth } from '../utils/metronomeSmooth';
import { liteMath } from './liteMathModule'
import { METRONOME_UI } from '../consts/metronomeUi'

export class InteractionModule {

    private metronome = new MetronomeSmooth();

    private clientCenter = { x: 0, y: 0 }
    private originalNormRadius = state.normRadius

    public angleMaxFromRadius = () =>
        this.metronome.angleMaxFromRadius(state.normRadius)

    public pendulumWeightPosition = () =>
        METRONOME_UI.pendulumWeightPositionMax - state.normRadius * (METRONOME_UI.pendulumWeightPositionMax - METRONOME_UI.pendulumWeightPositionMin)
    // 因為 y 數字越大的在越下面


    public pendulumWeightPointerDown = (e: PointerEvent, audioContext: AudioContext) => {
    // public pendulumWeightPointerDown(e: PointerEvent) {
        console.log(e, audioContext)
        // ios 系統一定要使用者操作後才可以放出聲音
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        // 避免離開判定區域後丟失指定物件
        e.currentTarget.setPointerCapture(e.pointerId);

        state.animationRunning = false
        this.clientCenter = {
            x: e.clientX,
            y: e.clientY
        }
        this.originalNormRadius = state.normRadius
        state.mouseMoving = true
    }

    // 取樣當下，與一開始 mouse down 鎖定的點形成一個 vector，只取與指針平行的分量
    public pendulumWeightPointerDrag = (e: PointerEvent) => {

        if (state.mouseMoving === false) {
            return
        }
        
        // 新位置 = 舊位置 + 映射偏移向量
        const mouseVector = liteMath.vec2(
            e.clientX - this.clientCenter.x,
            e.clientY - this.clientCenter.y
        )
        const unitDirectionVector = liteMath.vec2(
            -Math.sin(state.currentAngle * Math.PI / 180),
            -Math.abs(Math.cos(state.currentAngle * Math.PI / 180))
        )
        const CTM                = e.target.getScreenCTM()
        const magicSecretNumber  = 1 / CTM.d
        const scalingCoefficient = magicSecretNumber / (METRONOME_UI.pendulumWeightPositionMax - METRONOME_UI.pendulumWeightPositionMin)

        state.normRadius = liteMath.clamp(
            this.originalNormRadius + scalingCoefficient * liteMath.dot(mouseVector, unitDirectionVector),
            0,
            1.05,
        )

        // 如果 BPM 歸零就停者動畫
        if (state.normRadius > 1) {
            state.animationRunning = false
        }
    }

    public pendulumWeightPointerUp = (e: PointerEvent, callback: () => void) => {
        state.mouseMoving = false

        // 只有在合適區間才開始擺動
        if (0 <= state.normRadius && state.normRadius < 1) {
            callback()
        }
    }
}