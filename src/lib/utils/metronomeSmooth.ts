// @ts-nocheck
import {liteMath} from './liteMathModule'

export class MetronomeSmooth {
    // === 物理常數 ===
    private readonly fixedBottomDistance = 0.05;  // 5cm
    private readonly bottomMass = 0.25
    private readonly upperMass  = 0.05
    private readonly gravity = 9.8;
    private readonly d = (radius) => (this.fixedBottomDistance * this.bottomMass - radius * this.upperMass) / (this.bottomMass + this.upperMass)
    private readonly I = (radius) => (radius ** 2 * this.upperMass) + (this.fixedBottomDistance ** 2 * this.bottomMass)
    
    // === 邊界設定 ===
    private readonly bpmMin = 40;
    private readonly bpmMax = 210;
    private readonly angleMin = this.degreeToRad(10);
    private readonly angleMax = this.degreeToRad(55);
    
    // === 計算出的邊界 ===
    public readonly radiusMin = 0.01;
    public readonly radiusMax = 0.30;
    
    constructor() {
        // 用精確物理公式計算 radius 邊界
        this.radiusMin = this.derivedRealRadius(
            this.bpmToPeriod(this.bpmMax),
            this.angleMin
        );
        
        this.radiusMax = this.derivedRealRadius(
            this.bpmToPeriod(this.bpmMin),
            this.angleMax
        );
        console.log(`raidusMin: ${this.radiusMin}, radiusMax: ${this.radiusMax}`)
    };

    // ==========================================
    // 初始化: 精確計算邊界
    // ==========================================
    
    /**
     * 用完整物理公式反推 radius
     * 給定目標週期和角度,數值求解對應的半徑
     */
    public derivedRealRadius(targetPeriod: number, angleMax: number): number {
        let low  = 0.01; // 1cm
        let high = 0.25; // 20cm
        const tolerance = 1e-6;
        
        while (high - low > tolerance) {
            const mid = (low + high) / 2;
            const period = this.calculateExactPeriod(mid, angleMax);
            
            if (period < targetPeriod) {
                low = mid;
            } else {
                high = mid;
            }
        }
        
        return (low + high) / 2;
    }
    
    /**
     * 完整複擺週期公式 (含大角度修正)
     */
    private calculateExactPeriod(realRadius: number, angleMax: number): number {
        
        const k = Math.sin(angleMax / 2);
        const K = this.ellipticK(k);
        
        // 最後想要得到 T_0 * K => 2π(I/gd​)**(1/2) * K(sin(θ/2))
        const T_simple = 2 * Math.PI * Math.sqrt(this.I(realRadius) / ((this.upperMass + this.bottomMass) * this.gravity * this.d(realRadius)));
        return T_simple //* K; 不知為啥這個橢圓近似怪怪的
    }
    
    // ==========================================
    // 運行時: 簡化映射 (radius 為唯一變數)
    // ==========================================
    
    /**
     * 用戶拖動滑秤 → 顯示 BPM
     * 線性映射策略
     */
    public bpm(normRadius: number): number {
        const ratio  = normRadius
        const slpoe  = -1 * (this.bpmMax - this.bpmMin)
        // y = ax^2 + b
        const innerFunction = () => Math.floor(slpoe * (ratio) + this.bpmMax)

        return liteMath.clamp(innerFunction(), this.bpmMin, this.bpmMax)
    }
    
    /**
     * radius → angleMax
     * 非線性映射策略
     */
    public angleMaxFromRadius(normRadius: number): number {
        const ratio  = normRadius
        const slope  = this.angleMax - this.angleMin
        // y = ax^3 + b
        const innerFunction = () => slope * ratio**3 + this.angleMin
        return innerFunction();
    }
    
    
    // ==========================================
    // 動畫模擬
    // ==========================================
    
    /**
     * 給定當前角度和半徑,計算角速度
     * 用於實時動畫
     */
    public angularVelocity(currentAngle: number, angleMax: number): number {
        const realRadius   = this.realRadiusFromAngleMax(angleMax)
        const numerator    = (this.upperMass + this.bottomMass) * this.gravity * this.d(realRadius) * Math.abs((Math.cos(currentAngle) - Math.cos(angleMax)))
        const denominator  = (1/2) * this.I(realRadius)
        const omegaSquared = numerator / denominator

        // console.log({currentAngle: this.radToDegree(currentAngle), realRadius: realRadius, omega: Math.sqrt(omegaSquared)})

        return Math.sqrt(omegaSquared);
    }
    
    // ==========================================
    // 輔助函數
    // ==========================================
    public bpmToPeriod(bpm) {
        return 60 * 2 / bpm
    }

    public periodToBpm(period) {
        return 60 * 2 / period
    }

    public radToDegree(radAngle) {
        return radAngle * (180 / Math.PI)
    }

    public degreeToRad(degreeAngle) {
        return degreeAngle * (Math.PI / 180)
    }

    private realRadiusFromAngleMax(angleMax) {
        let low  = 0
        let high = 1
        const tolerance = 1e-6;
        
        while (high - low > tolerance) {
            const mid = (low + high) / 2;
            const tempAngleMax = this.angleMaxFromRadius(mid);
            
            if (tempAngleMax < angleMax) {
                low = mid;
            } else {
                high = mid;
            }
        }
        
        const normRadius = (low + high) / 2;
        const bpm = this.bpm(normRadius)
        return this.derivedRealRadius(this.bpmToPeriod(bpm), angleMax)
    }
    
    /**
     * 第一類完全橢圓積分近似
     */
    private ellipticK(k: number): number {
        return (Math.PI / 2) * (1 + (1/4) * k**2 + (9/64) * k**4 + (25/256) * k**6);
    }
}