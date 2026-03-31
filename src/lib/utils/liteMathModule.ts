export class liteMath {

    // 平面向量
    public static vec2 = (x: number, y: number) => ({ x, y });

    // 2維向量內積
    public static dot = (a: any, b: any) => a.x * b.x + a.y * b.y;

    // 旋轉運算子
    public static rotate = (v: any, rad: number) => ({
        x: v.x * Math.cos(rad) - v.y * Math.sin(rad),
        y: v.x * Math.sin(rad) + v.y * Math.cos(rad),
    });

    public static clamp = (value: number, min: number, max: number) => {
        if (value < min) {
            return min
        } else if (value > max) {
            return max
        } else {
            return value
        };
    }

    public static eulerMethod(y_0: number, dt: number, f: (x: number) => number) {
        return y_0 + f(y_0) * dt
    }

    public static trapezoidal(y_0: number, dt: number, f: (x: number) => number) {
        const k1 = f(y_0)
        const k2 = f(y_0 + dt * f(y_0))
        return y_0 + dt * (k1 + k2) / 2
    }

    public static rungeKutta4(y_0: number, dt: number, f: (x: number) => number) {
        const k1 = f(y_0)
        const k2 = f(y_0 + k1 * dt/2)
        const k3 = f(y_0 + k2 * dt/2)
        const k4 = f(y_0 + k3 * dt)
        return y_0 + (k1 + 2*k2 + 2*k3 + k4) / 6 * dt
    }
}