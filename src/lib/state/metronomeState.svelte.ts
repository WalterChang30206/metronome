export const state = $state({
    currentAngle: 0,
    animationRunning: false,
    normRadius: 1.05, // 0 ~ 1, 0.525 可以對應到 BPM120
    // 動畫用
    direction: 1,
    lastTime:  0,
    lastReleaseTime: 0,
    lastReleaseAngle: 0,
    transientAngleMax: 0,
    // 互動用
    mouseMoving: false,
})
