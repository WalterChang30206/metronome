import { state } from '../state/metronomeState.svelte'
import { MetronomeSmooth } from '../utils/metronomeSmooth';
import { liteMath } from './liteMathModule'
import { METRONOME_UI } from '../consts/metronomeUi'

export class InteractionModule {

    private metronome = new MetronomeSmooth();

    private clientCenter = { x: 0, y: 0 }

    private initialNormRadius = state.normRadius;

    public angleMaxFromRadius = () =>
        this.metronome.angleMaxFromRadius(state.normRadius)

    public pendulumWeightPosition = () =>
        METRONOME_UI.pendulumWeightPositionMax - state.normRadius * (METRONOME_UI.pendulumWeightPositionMax - METRONOME_UI.pendulumWeightPositionMin)
    // 因為 y 數字越大的在越下面

    // 記錄最近幾個 pointermove 的位置和時間
    private recentMoves: { x: number, y: number, t: number }[] = []

    public pendulumWeightPointerDown = (e: PointerEvent, audioContext: AudioContext, runAnimation: () => void) => {
        // ios 系統一定要使用者操作後才可以放出聲音
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => console.log('audioContext state:', audioContext.state))
        }

        // 避免離開判定區域後丟失指定物件
        e.currentTarget.setPointerCapture(e.pointerId);

        // 停下穩定運動的動畫
        state.animationRunning = false
        // 開啟 pointer 移動狀態
        state.pointerMoving = true
        // 設定 pointer 中心
        this.clientCenter = {
            x: e.clientX,
            y: e.clientY
        }
        this.initialNormRadius = state.normRadius;
        // 初始化切向初速度數據
        state.initialAngularVelocity = 0;
        state.initialDirection       = 0;
        // 清空採樣數據
        this.recentMoves = []
    }

    // 停滯 1 秒後進入到鎖定狀態，此時在縱向上需要嚴格判定為重
    public pendulumWeightPointerDrag = (e: PointerEvent) => {
        if (state.pointerMoving === false) {
            return
        }

        if (this.recentMoves.length >= 5) {
            this.recentMoves.shift()
        }
        this.recentMoves.push({ x: e.clientX, y: e.clientY, t: performance.now() })
 
        // 用於計算半徑
        const radialPointerVector = liteMath.vec2(
            e.clientX - this.clientCenter.x,
            e.clientY - this.clientCenter.y
        )
        const tangentialPointerVector = liteMath.vec2(
            this.recentMoves[this.recentMoves.length - 1].x - this.recentMoves[0].x,
            this.recentMoves[this.recentMoves.length - 1].y - this.recentMoves[0].y,
        )
        const CTM                = e.target.getScreenCTM()
        const magicSecretNumber  = Math.abs(Math.cos(state.currentAngle)) / CTM.d
        const scalingCoefficient = magicSecretNumber / (METRONOME_UI.pendulumWeightPositionMax - METRONOME_UI.pendulumWeightPositionMin)
        const innerProduct       = liteMath.dot(radialPointerVector, this.radialUnit())

        // 如果移動向量與徑向向量夾角大於 45 度代表要進入到切向速度模式
        const tangentialProjection           = liteMath.dot(tangentialPointerVector, this.tangentialUnit())
        const tantentialPointerVectorSquared = liteMath.dot(tangentialPointerVector, tangentialPointerVector)
        // 避免 0 除以 0 的問題
        const firingTangentialAngle = tantentialPointerVectorSquared === 0
            ? 0
            : Math.acos(Math.abs(tangentialProjection) / Math.sqrt(tantentialPointerVectorSquared)) * 180 / Math.PI
        console.log(firingTangentialAngle)
        if (firingTangentialAngle > 60) {
            // 走徑向改變 BPM
            state.normRadius = liteMath.clamp(
                this.initialNormRadius - scalingCoefficient * innerProduct,
                0,
                1.05,
            )

            // 如果 BPM 歸零就停者動畫
            if (state.normRadius > 1) {
                state.animationRunning = false
            }
        }
    }

    // public pendulumWeightPointerUp = (e: PointerEvent, runAnimation: () => void) => {
    public handlePointerEnd = (e: PointerEvent, runAnimation: () => void) => {
        state.pointerMoving = false

        this.setInitialAngularVelocity()

        // 只有在合適區間才開始擺動
        if (0 <= state.normRadius && state.normRadius < 1) {
            runAnimation()
        }
    }

    private setInitialAngularVelocity() {
        // 如果都沒有移動，就沒有數據點，根本不需要計算
        if (!this.recentMoves[0]) return;

        const tangentialPointerVector = liteMath.vec2(
            this.recentMoves[this.recentMoves.length - 1].x - this.recentMoves[0].x,
            this.recentMoves[this.recentMoves.length - 1].y - this.recentMoves[0].y,
        )
        const magicScaleNumber       = 15 // 測出來的魔術數字
        const affectiveVelocity      = liteMath.dot(tangentialPointerVector, this.tangentialUnit()) / magicScaleNumber
        // console.log(affectiveVelocity, tangentialPointerVector, this.tangentialUnit(), state.currentAngle)
        
        state.initialAngularVelocity = liteMath.clamp(Math.abs(affectiveVelocity), 0, 2 * Math.PI)
        state.initialDirection       = affectiveVelocity > 0 ? 1 : -1

        // 清空採樣數據
        this.recentMoves = []
    }

    private radialUnit = () => liteMath.vec2(
        -Math.sin(state.currentAngle),
        Math.abs(Math.cos(state.currentAngle))
    )
    
    private tangentialUnit = () => liteMath.vec2(
        Math.cos(state.currentAngle),
        Math.sin(state.currentAngle)
    )
}