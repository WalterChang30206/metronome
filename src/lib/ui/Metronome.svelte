<script>
  import { onMount } from 'svelte';
  import { state } from '../state/metronomeState.svelte'
  import { MetronomeSmooth } from '../utils/metronomeSmooth';
  import { InteractionModule } from '../utils/interactionModule'
  import { METRONOME_UI } from '../consts/metronomeUi'
    import { liteMath } from '../utils/liteMathModule';
  
  const metronome         = new MetronomeSmooth();
  const interactionModule = new InteractionModule();
  const audioContext      = new AudioContext();
  
  // derived values
  let bpm =
    $derived(state.normRadius > 1 ? 0 : metronome.bpm(state.normRadius));
  let angleMaxFromRadius =
    $derived(interactionModule.angleMaxFromRadius())
  let pendulumWeightPosition =
    $derived(interactionModule.pendulumWeightPosition())

  // @debug
  // let testingArray = [];

  function runAnimation() {
    state.animationRunning = true
    requestAnimationFrame(tick)
  }

  function tick(timestamp) {

    // 停止運動
    if (!state.animationRunning) {
        state.lastTime         = 0
        state.lastReleaseTime  = 0
        state.lastReleaseAngle = 0
        return
    };

    // 開始運動
    if (state.lastTime === 0) {
        state.lastTime          = timestamp
        state.lastReleaseTime   = timestamp
        state.lastReleaseAngle  = Math.abs(state.currentAngle)
        state.transientAngleMax = liteMath.clamp(
          state.lastReleaseAngle,
          metronome.degreeToRad(10),
          metronome.degreeToRad(55),
        )
        state.direction         = state.currentAngle > 0 ? -1 : 1
        requestAnimationFrame(tick)
        return
    }

    // 達到最大角度後：1. 轉向, 2. 發出聲音
    const originalDirection = state.direction
    if (state.currentAngle > state.transientAngleMax) {
      state.direction = -1
    } else if (state.currentAngle < (-1 * state.transientAngleMax)) {
      state.direction = 1
    }
    if (originalDirection != state.direction) {
      playTick(audioContext)
    } 

    // @debug
    // if (originalDirection != state.direction) {
    //   testingArray.push(timestamp)
    //   console.log(testingArray)
    // }

    // using euler method
    const deltaTime     = (timestamp - state.lastTime) / 1000
    const slopeFunction = (angle) => state.direction * metronome.angularVelocity(angle, state.transientAngleMax + 1e-6)
    const nextCurrentAngle = liteMath.eulerMethod(
      state.currentAngle,
      deltaTime,
      slopeFunction,
    )

    const isReleasedAtSmallAngle = state.lastReleaseAngle < metronome.degreeToRad(3)
    const hasCrossedMiddleLine   = (nextCurrentAngle * state.currentAngle) < 0
    
    if (isReleasedAtSmallAngle) {
      // 小角度釋放不做軌道變換，直接照著穩定軌跡運行
      state.transientAngleMax = angleMaxFromRadius
    } else if (hasCrossedMiddleLine) {
      // 如果跨過中心線，就要 update 下一個 transientAngleMax
      const elapsedTime = (timestamp - state.lastReleaseTime) / 1000
      // 釋放角度小於收斂最大擺角 => 線性衰減
      // 釋放角度大於收斂最大擺角 => 指數衰減
      const decayCoefficient  = (state.transientAngleMax < angleMaxFromRadius)
        ? liteMath.clamp((3 - elapsedTime) / 3, 0, 1)
        : liteMath.clamp(Math.exp(-1 * elapsedTime), 0, 1)
      state.transientAngleMax = liteMath.clamp(
        angleMaxFromRadius + (state.lastReleaseAngle - angleMaxFromRadius) * decayCoefficient,
        metronome.degreeToRad(10),
        metronome.degreeToRad(55),
      )
    }

    // final callback
    state.currentAngle = nextCurrentAngle
    state.lastTime     = timestamp
    requestAnimationFrame(tick)
  }

  // 純粹是用來發出聲音用的
  function playTick(audioContext) {
    const gainNode   = audioContext.createGain();
    gainNode.connect(audioContext.destination);

    // 基音 + 泛音列 or 其他組合
    const partials = [
        // attack
        {
          freq: 700,
          gain: 0.5,
          attack: 0,
          sustain: 0.3,
        },
        {
          freq: 1000,
          gain: 0.5,
          attack: 0,
          sustain: 0.1,
        },
        {
          freq: 2000,
          gain: 0.3,
          attack: 0,
          sustain: 0.1,
        },
        {
          freq: 2500,
          gain: 0.3,
          attack: 0,
          sustain: 0.05,
        },
    ];

    partials.forEach(({ freq, gain, attack, sustain }) => {
      const osc = audioContext.createOscillator();
      const partialGain = audioContext.createGain();

      osc.connect(partialGain);
        partialGain.connect(gainNode);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        partialGain.gain.setValueAtTime(gain, audioContext.currentTime);
        partialGain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + sustain);
        
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.3);
    })
  }

  // @debug
  // function calculateBpmFromTestingArray() {
  //   const period  = (testingArray.slice(-1)[0] - testingArray[0]) / 1000 / ((testingArray.length - 1) / 2)
  //   const testBpm = (60 * 2) / period
  //   console.log(period, testBpm)
  // }

  // viewRadius -> bpm & angleMax -> realRadius -> angularVelocity
  // angularVelocity(currentAngle, angleMax, realRadius)
  // angleMax 和 realRadius 要隨著時間變化，但現在沒有兩者的映射關係
</script>


<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400&family=Playfair+Display:wght@400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .body {
    background: #1a1610;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    /* min-height: 100vh; */
    height: 100vh;
    min-width: 100vw;
    font-family: 'DM Mono', monospace;
    color: #c8b89a;
  }

  h1 {
    font-family: 'Playfair Display', serif;
    font-size: 1rem;
    letter-spacing: 0.35em;
    text-transform: uppercase;
    color: #6a5e4a;
    margin-bottom: 2rem;
  }

  .metronome-body {
    background: linear-gradient(160deg, #2e2820 0%, #1e1a14 100%);
    border: 1px solid #3a3020;
    border-radius: 4px 4px 36px 36px;
    width: 200px;
    padding: 1.5rem 1.5rem 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04);
  }

  .no-pointer-events {
    pointer-events: none;
  }

  .window {
    width: 100%;
    height: 220px;
    background: #100e0b;
    border: 1px solid #2a2418;
    border-radius: 2px;
    position: relative;
    /* overflow: hidden; */
    margin-bottom: 1.5rem;
  }

  svg {
    width: 100%;
    height: 100%;
    overflow: visible;
    touch-action: none;
  }

  .controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
  }

  .bpm-display {
    font-size: 2rem;
    font-weight: 300;
    color: #e0d0b8;
    letter-spacing: 0.05em;
  }

  .bpm-label {
    font-size: 0.55rem;
    letter-spacing: 0.3em;
    color: #4a4030;
    text-align: center;
  }

  input[type=range] {
    -webkit-appearance: none;
    width: 100%;
    height: 2px;
    background: #3a3020;
    border-radius: 1px;
    outline: none;
    cursor: pointer;
  }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px; height: 12px;
    border-radius: 50%;
    background: #c8b89a;
    cursor: pointer;
  }

  button {
    background: none;
    border: 1px solid #3a3020;
    color: #6a5e4a;
    font-family: 'DM Mono', monospace;
    font-size: 0.6rem;
    letter-spacing: 0.25em;
    padding: 0.5rem;
    cursor: pointer;
    text-transform: uppercase;
    width: 100%;
    transition: all 0.2s;
  }
  button:hover { border-color: #c8b89a; color: #c8b89a; }

  .base {
    width: 220px;
    height: 12px;
    background: #1e1a14;
    border: 1px solid #3a3020;
    border-top: none;
    border-radius: 0 0 4px 4px;
  }
</style>

  <main>
    <div class="body">
      <h1>Metronome</h1>

      <div class="metronome-body">
        <div class="window">
          <!--
            SVG 參數（供動畫邏輯引用）：
              data-angle       目前角度（弧度），從垂直軸算起，正為右
              data-origin-x/y  擺動支點座標
              data-length      指針長度（SVG px）
              data-weight-pos  配重塊位置，0.0 ~ 1.0（沿指針比例）
          -->
          <svg
            id="pendulum-svg"
            viewBox="0 0 200 400"
            data-angle="0"
            data-origin-x="100"
            data-origin-y="20"
            data-length="160"
            data-weight-pos="0.7"
          >
            <!-- 指針 -->
            <line
              id="pendulum-rod"
              x1="100"
              y1={METRONOME_UI.rodPositionMin}
              x2={METRONOME_UI.pivotX}
              y2={METRONOME_UI.pivotY}
              stroke="#c8b89a"
              stroke-width="8"
              stroke-linecap="round"
              transform={`rotate(${metronome.radToDegree(state.currentAngle)}, ${METRONOME_UI.pivotX}, ${METRONOME_UI.pivotY})`}
            />

            <!-- 配重塊（可沿指針滑動） -->
            <rect
              id="pendulum-weight"
              x="80"
              y={pendulumWeightPosition}
              width="40"
              height="16"
              rx="2"
              fill="#c8b89a"
              transform={`rotate(${metronome.radToDegree(state.currentAngle)}, ${METRONOME_UI.pivotX}, ${METRONOME_UI.pivotY})`}
            />

            <!-- 透明的大判定區，負責接收事件 -->
            <rect
              x="40"
              y={pendulumWeightPosition - 40}
              width="120" height="100"
              rx="4"
              fill="transparent"
              transform={`rotate(${metronome.radToDegree(state.currentAngle)}, ${METRONOME_UI.pivotX}, ${METRONOME_UI.pivotY})`}
              onpointerdown={interactionModule.pendulumWeightPointerDown}
              onpointermove={interactionModule.pendulumWeightPointerDrag}
              onpointerup={(e) => interactionModule.pendulumWeightPointerUp(e, runAnimation)}
              style="cursor: grab;"
            />

            <!-- 轉軸 (pivot) -->
            <circle
              id="pendulum-bob"
              cx={METRONOME_UI.pivotX}
              cy={METRONOME_UI.pivotY}
              r="9"
              fill="#c8b89a"
            />

            <!-- 刻度左側(BPM) -->
            <line class="no-pointer-events" x1="50" y1="86" x2="70" y2="86" stroke="#c8b89a" stroke-width="1"/>
            <text class="no-pointer-events" x="40" y="90" text-anchor="end" font-size="12" fill="#c8b89a">40</text>

            <line class="no-pointer-events" x1="50" y1="155" x2="70" y2="155" stroke="#c8b89a" stroke-width="1"/>
            <text class="no-pointer-events" x="40" y="160" text-anchor="end" font-size="12" fill="#c8b89a">80</text>

            <line class="no-pointer-events" x1="50" y1="224" x2="70" y2="224" stroke="#c8b89a" stroke-width="1"/>
            <text class="no-pointer-events" x="40" y="229" text-anchor="end" font-size="12" fill="#c8b89a">120</text>

            <line class="no-pointer-events" x1="50" y1="292" x2="70" y2="292" stroke="#c8b89a" stroke-width="1"/>
            <text class="no-pointer-events" x="40" y="297" text-anchor="end" font-size="12" fill="#c8b89a">160</text>

            <line class="no-pointer-events" x1="50" y1="358" x2="70" y2="358" stroke="#c8b89a" stroke-width="1"/>
            <text class="no-pointer-events" x="40" y="363" text-anchor="end" font-size="12" fill="#c8b89a">200</text>

            <!-- 刻度左側(速度術語) -->
            <line class="no-pointer-events" x1="130" y1="85" x2="150" y2="85" stroke="#c8b89a" stroke-width="1"/>
            <text class="no-pointer-events" x="160" y="90" text-anchor="start" font-size="12" fill="#c8b89a">Grave</text>

            <line class="no-pointer-events" x1="130" y1="155" x2="150" y2="155" stroke="#c8b89a" stroke-width="1"/>
            <text class="no-pointer-events" x="160" y="160" text-anchor="start" font-size="12" fill="#c8b89a">Andante</text>

            <line class="no-pointer-events" x1="130" y1="224" x2="150" y2="224" stroke="#c8b89a" stroke-width="1"/>
            <text class="no-pointer-events" x="160" y="229" text-anchor="start" font-size="12" fill="#c8b89a">Moderato</text>

            <line class="no-pointer-events" x1="130" y1="292" x2="150" y2="292" stroke="#c8b89a" stroke-width="1"/>
            <text class="no-pointer-events" x="160" y="297" text-anchor="start" font-size="12" fill="#c8b89a">Allegro</text>

            <line class="no-pointer-events" x1="130" y1="358" x2="150" y2="358" stroke="#c8b89a" stroke-width="1"/>
            <text class="no-pointer-events" x="160" y="363" text-anchor="start" font-size="12" fill="#c8b89a">Presto</text>

            <!-- 刻度中線 -->
            <line class="no-pointer-events" x1="70" y1="86" x2="70" y2="375" stroke="#c8b89a" stroke-width="1"/>
            <line class="scale-mark" x1="130" y1="86" x2="130" y2="375" stroke="#c8b89a" stroke-width="1"/>

          </svg>
        </div>
      </div>
      <div class="base"></div>

      <div class="controls">
        <div style="text-align:center">
          <div class="bpm-display" id="bpm-display">{bpm}</div>
          <div class="bpm-label">BPM</div>
        </div>
        <!-- <button onclick={calculateBpmFromTestingArray}>calculate bpm</button> -->
      </div>

      
    </div>
  </main>

