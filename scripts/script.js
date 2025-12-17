// ============================================
// Color Space Conversion & Interpolation
// ============================================

function rgb2hsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;

    let h, s, v = max;

    s = max === 0 ? 0 : d / max;

    if (max === min) {
        h = 0;
    } else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h, s, v];
}

function hsv2rgb(h, s, v) {
    let r, g, b;

    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function lerpRGB(colorA, colorB, t) {
    return [
        Math.round(lerp(colorA[0], colorB[0], t)),
        Math.round(lerp(colorA[1], colorB[1], t)),
        Math.round(lerp(colorA[2], colorB[2], t))
    ];
}

// Hue direction: 'shortest', 'clockwise', 'counter'
let hueDirection = 'shortest';

function lerpHSV(colorA, colorB, t) {
    const hsvA = rgb2hsv(colorA[0], colorA[1], colorA[2]);
    const hsvB = rgb2hsv(colorB[0], colorB[1], colorB[2]);

    let hueA = hsvA[0];
    let hueB = hsvB[0];

    if (hueDirection === 'shortest') {
        // Take shortest path around wheel
        const hueDiff = hueB - hueA;
        if (Math.abs(hueDiff) > 0.5) {
            if (hueDiff > 0) {
                hueA += 1;
            } else {
                hueB += 1;
            }
        }
    } else if (hueDirection === 'clockwise') {
        // Always go clockwise (decreasing hue)
        if (hueB >= hueA) {
            hueA += 1;
        }
    } else if (hueDirection === 'counter') {
        // Always go counter-clockwise (increasing hue)
        if (hueB <= hueA) {
            hueB += 1;
        }
    }

    let h = lerp(hueA, hueB, t) % 1;
    if (h < 0) h += 1;

    const s = lerp(hsvA[1], hsvB[1], t);
    const v = lerp(hsvA[2], hsvB[2], t);

    return hsv2rgb(h, s, v);
}

function rgbToHex(rgb) {
    const toHex = (n) => {
        const hex = Math.round(n).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
}

function rgbToCss(rgb) {
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function hsvToCss(rgb) {
    const [h, s, v] = rgb2hsv(rgb[0], rgb[1], rgb[2]);
    return `hsv(${Math.round(h * 255)}, ${Math.round(s * 255)}, ${Math.round(v * 255)})`;
}

// ============================================
// WebGL Setup
// ============================================

const vertexShaderSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;

    void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
`;

const fragmentShaderSource = `
    precision highp float;

    varying vec2 v_uv;

    uniform vec3 u_colorA;
    uniform vec3 u_colorB;
    uniform float u_t;
    uniform int u_mode;
    uniform int u_hueDirection; // 0=shortest, 1=clockwise, 2=counter-clockwise
    uniform sampler2D u_letterA;
    uniform sampler2D u_letterB;

    #define PI 3.14159265359

    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }

    void main() {
        vec2 uv = v_uv * 2.0 - 1.0;
        float dist = length(uv);
        float angle = atan(uv.y, uv.x) / (2.0 * PI) + 0.5;

        // Scale wheel down to leave room for dots at edges
        float wheelScale = 0.85;
        float wheelDist = dist / wheelScale;
        vec3 wheelColor = hsv2rgb(vec3(angle, clamp(wheelDist, 0.0, 1.0), 1.0));
        float wheelMask = smoothstep(wheelScale, wheelScale - 0.02, dist);

        vec3 hsvA = rgb2hsv(u_colorA);
        vec3 hsvB = rgb2hsv(u_colorB);

        // Scale dot positions to match wheel
        vec2 posA = vec2(cos((hsvA.x - 0.5) * 2.0 * PI), sin((hsvA.x - 0.5) * 2.0 * PI)) * hsvA.y * wheelScale;
        vec2 posB = vec2(cos((hsvB.x - 0.5) * 2.0 * PI), sin((hsvB.x - 0.5) * 2.0 * PI)) * hsvB.y * wheelScale;

        float pathWidth = 0.04;
        vec3 pathColor = vec3(0.0);
        float pathAlpha = 0.0;
        float glowAlpha = 0.0;
        vec3 glowColor = vec3(1.0, 1.0, 1.0); // White glow

        if (u_mode == 0) {
            vec2 ab = posB - posA;
            float len = length(ab);
            vec2 dir = ab / len;
            vec2 toPoint = uv - posA;
            float proj = clamp(dot(toPoint, dir), 0.0, len);
            vec2 closest = posA + dir * proj;
            float distToLine = length(uv - closest);

            // Glow effect - wider, softer
            float glowWidth = 0.12;
            glowAlpha = smoothstep(glowWidth, 0.0, distToLine) * 0.6;

            // Main path
            pathAlpha = smoothstep(pathWidth, pathWidth * 0.3, distToLine);

            float pathT = proj / len;
            pathColor = mix(u_colorA, u_colorB, pathT);
        } else {
            // HSV arc - continuous line approach
            float hueA = hsvA.x;
            float hueB = hsvB.x;

            // Handle hue wraparound based on direction
            if (u_hueDirection == 0) {
                // Shortest path
                float hueDiff = hueB - hueA;
                if (hueDiff > 0.5) {
                    hueA += 1.0;
                } else if (hueDiff < -0.5) {
                    hueB += 1.0;
                }
            } else if (u_hueDirection == 1) {
                // Clockwise (decreasing hue)
                if (hueB >= hueA) {
                    hueA += 1.0;
                }
            } else {
                // Counter-clockwise (increasing hue)
                if (hueB <= hueA) {
                    hueB += 1.0;
                }
            }

            // Get hue range (ensure minH < maxH)
            float minH = min(hueA, hueB);
            float maxH = max(hueA, hueB);

            // Check if current pixel's angle falls within the arc's hue range
            float pointHue = angle;

            // Also check pointHue + 1.0 for wraparound cases
            float pointHue2 = pointHue + 1.0;

            bool onArc = (pointHue >= minH && pointHue <= maxH) ||
                         (pointHue2 >= minH && pointHue2 <= maxH);

            if (onArc) {
                // Calculate t (0-1) along the arc
                float useHue = (pointHue >= minH && pointHue <= maxH) ? pointHue : pointHue2;
                float arcT = (useHue - minH) / (maxH - minH);

                // Flip if A > B in hue
                if (hueA > hueB) arcT = 1.0 - arcT;

                // Expected saturation at this hue position
                float expectedSat = mix(hsvA.y, hsvB.y, arcT) * wheelScale;
                float distToArc = abs(dist - expectedSat);

                // Glow effect - wider, softer
                float glowWidth = 0.12;
                glowAlpha = smoothstep(glowWidth, 0.0, distToArc) * 0.6;

                // Main path
                pathAlpha = smoothstep(pathWidth, pathWidth * 0.3, distToArc);

                float h = mod(mix(hueA, hueB, arcT), 1.0);
                float s = mix(hsvA.y, hsvB.y, arcT);
                float v = mix(hsvA.z, hsvB.z, arcT);
                pathColor = hsv2rgb(vec3(h, s, v));
            }
        }

        float dotRadius = 0.08;
        float dotBorder = 0.02;

        float distA = length(uv - posA);
        float dotAMask = smoothstep(dotRadius, dotRadius - 0.01, distA);
        float dotABorder = smoothstep(dotRadius + dotBorder, dotRadius + dotBorder - 0.01, distA) - dotAMask;

        float distB = length(uv - posB);
        float dotBMask = smoothstep(dotRadius, dotRadius - 0.01, distB);
        float dotBBorder = smoothstep(dotRadius + dotBorder, dotRadius + dotBorder - 0.01, distB) - dotBMask;

        vec2 posT;
        vec3 colorT;

        if (u_mode == 0) {
            posT = mix(posA, posB, u_t);
            colorT = mix(u_colorA, u_colorB, u_t);
        } else {
            float hueA2 = hsvA.x;
            float hueB2 = hsvB.x;

            // Use same direction logic as arc
            if (u_hueDirection == 0) {
                float hueDiff2 = hueB2 - hueA2;
                if (abs(hueDiff2) > 0.5) {
                    if (hueDiff2 > 0.0) hueA2 += 1.0;
                    else hueB2 += 1.0;
                }
            } else if (u_hueDirection == 1) {
                if (hueB2 >= hueA2) hueA2 += 1.0;
            } else {
                if (hueB2 <= hueA2) hueB2 += 1.0;
            }

            float h = mod(mix(hueA2, hueB2, u_t), 1.0);
            float s = mix(hsvA.y, hsvB.y, u_t);
            float v = mix(hsvA.z, hsvB.z, u_t);
            posT = vec2(cos((h - 0.5) * 2.0 * PI), sin((h - 0.5) * 2.0 * PI)) * s * wheelScale;
            colorT = hsv2rgb(vec3(h, s, v));
        }

        float distT = length(uv - posT);
        float dotTRadius = 0.1;
        float dotTMask = smoothstep(dotTRadius, dotTRadius - 0.01, distT);
        float dotTBorder = smoothstep(dotTRadius + dotBorder, dotTRadius + dotBorder - 0.01, distT) - dotTMask;

        vec3 bgColor = vec3(0.043, 0.051, 0.063);
        vec3 finalColor = mix(bgColor, wheelColor, wheelMask);

        // Apply glow first (underneath path)
        finalColor = mix(finalColor, glowColor, glowAlpha * wheelMask);
        // Apply main path on top
        finalColor = mix(finalColor, pathColor, pathAlpha * 0.95);

        // Sample letter textures - centered
        float letterScale = 1.25;
        vec2 letterUVA = (uv - posA) / (dotRadius * letterScale);
        letterUVA = letterUVA * 0.5 + 0.5;
        letterUVA.y = 1.0 - letterUVA.y;

        vec2 letterUVB = (uv - posB) / (dotRadius * letterScale);
        letterUVB = letterUVB * 0.5 + 0.5;
        letterUVB.y = 1.0 - letterUVB.y;

        float letterA = texture2D(u_letterA, letterUVA).a;
        float letterB = texture2D(u_letterB, letterUVB).a;

        finalColor = mix(finalColor, vec3(1.0), dotABorder);
        finalColor = mix(finalColor, u_colorA, dotAMask);
        finalColor = mix(finalColor, vec3(0.0), letterA * dotAMask);

        finalColor = mix(finalColor, vec3(1.0), dotBBorder);
        finalColor = mix(finalColor, u_colorB, dotBMask);
        finalColor = mix(finalColor, vec3(0.0), letterB * dotBMask);

        finalColor = mix(finalColor, vec3(1.0), dotTBorder);
        finalColor = mix(finalColor, colorT, dotTMask);

        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

function setupWebGL(canvas, mode) {
    const gl = canvas.getContext('webgl');
    if (!gl) {
        console.error('WebGL not supported');
        return null;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createProgram(gl, vertexShader, fragmentShader);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
         1,  1,
    ]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');

    // Create letter textures
    const letterATexture = createLetterTexture(gl, 'A');
    const letterBTexture = createLetterTexture(gl, 'B');

    return {
        gl,
        program,
        positionBuffer,
        positionLocation,
        letterATexture,
        letterBTexture,
        uniforms: {
            colorA: gl.getUniformLocation(program, 'u_colorA'),
            colorB: gl.getUniformLocation(program, 'u_colorB'),
            t: gl.getUniformLocation(program, 'u_t'),
            mode: gl.getUniformLocation(program, 'u_mode'),
            hueDirection: gl.getUniformLocation(program, 'u_hueDirection'),
            letterA: gl.getUniformLocation(program, 'u_letterA'),
            letterB: gl.getUniformLocation(program, 'u_letterB'),
        },
        mode
    };
}

function createLetterTexture(gl, letter) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Clear with transparent background
    ctx.clearRect(0, 0, 64, 64);

    // Draw letter - using Space Grotesk to match design system
    ctx.fillStyle = 'white';
    ctx.font = '600 34px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 32, 32);

    // Create WebGL texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return texture;
}

function render(ctx, colorA, colorB, t) {
    const { gl, program, positionBuffer, positionLocation, uniforms, mode, letterATexture, letterBTexture } = ctx;

    const rect = gl.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    gl.canvas.width = rect.width * dpr;
    gl.canvas.height = rect.height * dpr;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Bind letter textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, letterATexture);
    gl.uniform1i(uniforms.letterA, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, letterBTexture);
    gl.uniform1i(uniforms.letterB, 1);

    gl.uniform3f(uniforms.colorA, colorA[0] / 255, colorA[1] / 255, colorA[2] / 255);
    gl.uniform3f(uniforms.colorB, colorB[0] / 255, colorB[1] / 255, colorB[2] / 255);
    gl.uniform1f(uniforms.t, t);
    gl.uniform1i(uniforms.mode, mode);

    // Pass hue direction: 0=shortest, 1=clockwise, 2=counter
    const hueDir = hueDirection === 'clockwise' ? 1 : (hueDirection === 'counter' ? 2 : 0);
    gl.uniform1i(uniforms.hueDirection, hueDir);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// ============================================
// Main App
// ============================================

const rgbCanvas = document.getElementById('rgbCanvas');
const hsvCanvas = document.getElementById('hsvCanvas');

const rgbCtx = setupWebGL(rgbCanvas, 0);
const hsvCtx = setupWebGL(hsvCanvas, 1);

const tSlider = document.getElementById('tSlider');
const tValueDisplay = document.getElementById('tValue');

const swatchA = document.getElementById('swatchA');
const swatchB = document.getElementById('swatchB');
const rgbADisplay = document.getElementById('rgbA');
const rgbBDisplay = document.getElementById('rgbB');
const hsvADisplay = document.getElementById('hsvA');
const hsvBDisplay = document.getElementById('hsvB');

const rgbSwatch = document.getElementById('rgbSwatch');
const hsvSwatch = document.getElementById('hsvSwatch');
const rgbValue = document.getElementById('rgbValue');
const hsvValue = document.getElementById('hsvValue');
const rgbValueHsv = document.getElementById('rgbValueHsv');
const hsvValueHsv = document.getElementById('hsvValueHsv');

let colorA = [255, 0, 0];    // Red (hue 0°)
let colorB = [0, 255, 255];  // Cyan (hue 180°) - opposite side of wheel
let t = parseFloat(tSlider.value);

let draggingDot = null; // 'A', 'B', or null

function update() {
    render(rgbCtx, colorA, colorB, t);
    render(hsvCtx, colorA, colorB, t);

    const rgbResult = lerpRGB(colorA, colorB, t);
    const hsvResult = lerpHSV(colorA, colorB, t);

    // Update result swatches (RGB and HSV values)
    rgbSwatch.style.backgroundColor = rgbToCss(rgbResult);
    hsvSwatch.style.backgroundColor = rgbToCss(hsvResult);
    rgbValue.textContent = rgbToCss(rgbResult);
    hsvValue.textContent = rgbToCss(hsvResult);
    rgbValueHsv.textContent = hsvToCss(rgbResult);
    hsvValueHsv.textContent = hsvToCss(hsvResult);

    // Update endpoint swatches (RGB and HSV values)
    swatchA.style.backgroundColor = rgbToCss(colorA);
    swatchB.style.backgroundColor = rgbToCss(colorB);
    rgbADisplay.textContent = rgbToCss(colorA);
    rgbBDisplay.textContent = rgbToCss(colorB);
    hsvADisplay.textContent = hsvToCss(colorA);
    hsvBDisplay.textContent = hsvToCss(colorB);

    tValueDisplay.textContent = t.toFixed(2);
}

// Get client coordinates from mouse or touch event
function getClientCoords(event) {
    if (event.touches && event.touches.length > 0) {
        return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY };
    }
    return { clientX: event.clientX, clientY: event.clientY };
}

// Wheel scale - must match shader
const WHEEL_SCALE = 0.85;

// Get color from canvas position
function getColorFromCanvas(canvas, event) {
    const { clientX, clientY } = getClientCoords(event);
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((clientY - rect.top) / rect.height) * 2 - 1);

    const dist = Math.sqrt(x * x + y * y);
    if (dist > WHEEL_SCALE) return null;

    const angle = Math.atan2(y, x) / (2 * Math.PI) + 0.5;
    const hue = angle;
    const sat = Math.min(dist / WHEEL_SCALE, 1);

    return hsv2rgb(hue, sat, 1);
}

// Get dot positions for A, B, and T
function getDotPositions(mode) {
    const [hA, sA] = rgb2hsv(colorA[0], colorA[1], colorA[2]);
    const [hB, sB] = rgb2hsv(colorB[0], colorB[1], colorB[2]);

    const angleA = (hA - 0.5) * 2 * Math.PI;
    const posA = {
        x: Math.cos(angleA) * sA * WHEEL_SCALE,
        y: Math.sin(angleA) * sA * WHEEL_SCALE
    };

    const angleB = (hB - 0.5) * 2 * Math.PI;
    const posB = {
        x: Math.cos(angleB) * sB * WHEEL_SCALE,
        y: Math.sin(angleB) * sB * WHEEL_SCALE
    };

    let posT;
    if (mode === 0) {
        // RGB: linear interpolation
        posT = {
            x: posA.x + (posB.x - posA.x) * t,
            y: posA.y + (posB.y - posA.y) * t
        };
    } else {
        // HSV: arc interpolation
        let hueA = hA;
        let hueB = hB;
        const hueDiff = hueB - hueA;
        if (hueDiff > 0.5) hueA += 1;
        else if (hueDiff < -0.5) hueB += 1;

        const h = ((hueA + (hueB - hueA) * t) % 1 + 1) % 1;
        const s = sA + (sB - sA) * t;
        const angleT = (h - 0.5) * 2 * Math.PI;
        posT = {
            x: Math.cos(angleT) * s * WHEEL_SCALE,
            y: Math.sin(angleT) * s * WHEEL_SCALE
        };
    }

    return { posA, posB, posT, hA, sA, hB, sB };
}

// Check if click/tap is near a dot
function checkDotClick(canvas, event) {
    const { clientX, clientY } = getClientCoords(event);
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((clientY - rect.top) / rect.height) * 2 - 1);

    const mode = canvas === rgbCanvas ? 0 : 1;
    const { posA, posB, posT } = getDotPositions(mode);

    const distA = Math.sqrt((x - posA.x) ** 2 + (y - posA.y) ** 2);
    const distB = Math.sqrt((x - posB.x) ** 2 + (y - posB.y) ** 2);
    const distT = Math.sqrt((x - posT.x) ** 2 + (y - posT.y) ** 2);

    // Dot radii (T is slightly larger)
    const dotRadius = 0.12;
    const dotRadiusT = 0.14;

    // Check T first (it's on top visually)
    if (distT <= dotRadiusT) {
        return 'T';
    } else if (distA <= dotRadius && distA <= distB) {
        return 'A';
    } else if (distB <= dotRadius) {
        return 'B';
    }

    return null;
}

// Calculate t value from position along the path
function getTFromPosition(canvas, event) {
    const { clientX, clientY } = getClientCoords(event);
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((clientY - rect.top) / rect.height) * 2 - 1);

    const mode = canvas === rgbCanvas ? 0 : 1;
    const { posA, posB, hA, sA, hB, sB } = getDotPositions(mode);

    if (mode === 0) {
        // RGB: project onto line from A to B
        const abX = posB.x - posA.x;
        const abY = posB.y - posA.y;
        const len = Math.sqrt(abX * abX + abY * abY);
        if (len === 0) return t;

        const apX = x - posA.x;
        const apY = y - posA.y;
        const proj = (apX * abX + apY * abY) / (len * len);
        return Math.max(0, Math.min(1, proj));
    } else {
        // HSV: calculate from angle
        let hueA = hA;
        let hueB = hB;
        const hueDiff = hueB - hueA;
        if (hueDiff > 0.5) hueA += 1;
        else if (hueDiff < -0.5) hueB += 1;

        const angle = Math.atan2(y, x) / (2 * Math.PI) + 0.5;
        let pointHue = angle;

        // Handle wraparound
        const minH = Math.min(hueA, hueB);
        const maxH = Math.max(hueA, hueB);

        // Try both pointHue and pointHue + 1
        let newT;
        if (pointHue >= minH && pointHue <= maxH) {
            newT = (pointHue - minH) / (maxH - minH);
        } else if (pointHue + 1 >= minH && pointHue + 1 <= maxH) {
            newT = (pointHue + 1 - minH) / (maxH - minH);
        } else {
            return t; // Outside arc range
        }

        // Flip if A > B
        if (hueA > hueB) newT = 1 - newT;
        return Math.max(0, Math.min(1, newT));
    }
}

let activeCanvas = null;

// Handle start of drag (mouse or touch)
function handleDragStart(canvas, e) {
    const clicked = checkDotClick(canvas, e);

    if (clicked) {
        draggingDot = clicked;
        activeCanvas = canvas;
        canvas.style.cursor = 'grabbing';

        if (draggingDot === 'T') {
            // Update t value based on position
            t = getTFromPosition(canvas, e);
            tSlider.value = t;
            update();
        } else {
            // Immediately update color on click/tap
            const newColor = getColorFromCanvas(canvas, e);
            if (newColor) {
                if (draggingDot === 'A') {
                    colorA = newColor;
                } else {
                    colorB = newColor;
                }
                update();
            }
        }
    }
}

// Handle drag move (mouse or touch)
function handleDragMove(e) {
    if (draggingDot && activeCanvas) {
        if (draggingDot === 'T') {
            // Update t value based on position along path
            t = getTFromPosition(activeCanvas, e);
            tSlider.value = t;
            update();
        } else {
            const newColor = getColorFromCanvas(activeCanvas, e);
            if (newColor) {
                if (draggingDot === 'A') {
                    colorA = newColor;
                } else {
                    colorB = newColor;
                }
                update();
            }
        }
    }
}

// Handle end of drag
function handleDragEnd() {
    if (draggingDot) {
        draggingDot = null;
        activeCanvas = null;
        rgbCanvas.style.cursor = 'default';
        hsvCanvas.style.cursor = 'default';
    }
}

// Setup mouse and touch handlers for canvases
function setupCanvasInteraction(canvas) {
    // Mouse events
    canvas.addEventListener('mousedown', (e) => handleDragStart(canvas, e));

    canvas.addEventListener('mousemove', (e) => {
        if (!draggingDot) {
            // Update cursor based on hover
            const hovering = checkDotClick(canvas, e);
            canvas.style.cursor = hovering ? 'grab' : 'default';
        }
    });

    // Touch events
    canvas.addEventListener('touchstart', (e) => {
        handleDragStart(canvas, e);
        if (draggingDot) {
            e.preventDefault(); // Prevent scrolling while dragging
        }
    }, { passive: false });
}

setupCanvasInteraction(rgbCanvas);
setupCanvasInteraction(hsvCanvas);

// Global mouse handlers
document.addEventListener('mousemove', handleDragMove);
document.addEventListener('mouseup', handleDragEnd);

// Global touch handlers
document.addEventListener('touchmove', (e) => {
    if (draggingDot) {
        e.preventDefault(); // Prevent scrolling while dragging
        handleDragMove(e);
    }
}, { passive: false });

document.addEventListener('touchend', handleDragEnd);
document.addEventListener('touchcancel', handleDragEnd);

tSlider.addEventListener('input', (e) => {
    t = parseFloat(e.target.value);
    update();
});

// Hue direction radio buttons
document.querySelectorAll('input[name="hueDirection"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        hueDirection = e.target.value;
        update();
    });
});

// Handle resize
window.addEventListener('resize', update);

// Shrink header on scroll
window.addEventListener('scroll', function() {
    const header = document.querySelector('.header');
    const title = document.querySelector('.title');
    const subtitle = document.querySelector('.subtitle');
    const screenWidth = window.innerWidth;
    const isMobile = screenWidth <= 768;

    if (document.body.scrollTop > 50 || document.documentElement.scrollTop > 50) {
        // Scrolled state
        header.style.padding = "10px 10px";
        if (isMobile) {
            const baseTitleSize = screenWidth / 180;
            title.style.fontSize = (baseTitleSize * 0.4) + "rem";
            subtitle.style.fontSize = (baseTitleSize * 0.3 * 0.6) + "rem";
        } else {
            title.style.fontSize = "1.5rem";
            subtitle.style.fontSize = "0.75rem";
        }
    } else {
        // At top state
        if (isMobile) {
            const baseTitleSize = screenWidth / 180;
            const basePadding = Math.min(Math.max(screenWidth / 30, 15), 40);
            header.style.padding = basePadding + "px 10px";
            title.style.fontSize = baseTitleSize + "rem";
            subtitle.style.fontSize = (baseTitleSize * 0.3) + "rem";
        } else {
            header.style.padding = "40px 10px";
            title.style.fontSize = "4rem";
            subtitle.style.fontSize = "1.25rem";
        }
    }
});

// Initial render
update();

// ============================================
// 3D RGB Cube Visualization
// ============================================

const cubeCanvas = document.getElementById('cubeCanvas');
let cubeGl, cubeProgram, cubePointProgram;
let cubeRotationX = -0.5;
let cubeRotationY = 0.7;
let isDraggingCube = false;
let lastCubeMouseX, lastCubeMouseY;

function initCube() {
    cubeGl = cubeCanvas.getContext('webgl');
    if (!cubeGl) {
        console.error('WebGL not supported for cube');
        return;
    }

    // Line shader
    const lineVS = `
        attribute vec3 a_position;
        attribute vec3 a_color;
        uniform mat4 u_matrix;
        varying vec3 v_color;
        void main() {
            gl_Position = u_matrix * vec4(a_position, 1.0);
            v_color = a_color;
        }
    `;

    const lineFS = `
        precision mediump float;
        varying vec3 v_color;
        void main() {
            gl_FragColor = vec4(v_color, 1.0);
        }
    `;

    // Point shader
    const pointVS = `
        attribute vec3 a_position;
        attribute vec3 a_color;
        attribute float a_size;
        uniform mat4 u_matrix;
        varying vec3 v_color;
        void main() {
            gl_Position = u_matrix * vec4(a_position, 1.0);
            gl_PointSize = a_size;
            v_color = a_color;
        }
    `;

    const pointFS = `
        precision mediump float;
        varying vec3 v_color;
        void main() {
            float dist = length(gl_PointCoord - vec2(0.5));
            if (dist > 0.5) discard;
            float alpha = smoothstep(0.5, 0.35, dist);
            gl_FragColor = vec4(v_color, alpha);
        }
    `;

    function compileShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }

    function createProgram(gl, vs, fs) {
        const program = gl.createProgram();
        gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vs));
        gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    cubeProgram = createProgram(cubeGl, lineVS, lineFS);
    cubePointProgram = createProgram(cubeGl, pointVS, pointFS);

    cubeGl.enable(cubeGl.BLEND);
    cubeGl.blendFunc(cubeGl.SRC_ALPHA, cubeGl.ONE_MINUS_SRC_ALPHA);
}

function multiplyMatrices(a, b) {
    const result = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            result[i * 4 + j] = 0;
            for (let k = 0; k < 4; k++) {
                result[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
            }
        }
    }
    return result;
}

function perspectiveMatrix(fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2);
    return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) / (near - far), -1,
        0, 0, (2 * far * near) / (near - far), 0
    ]);
}

function rotationXMatrix(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return new Float32Array([
        1, 0, 0, 0,
        0, c, s, 0,
        0, -s, c, 0,
        0, 0, 0, 1
    ]);
}

function rotationYMatrix(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return new Float32Array([
        c, 0, -s, 0,
        0, 1, 0, 0,
        s, 0, c, 0,
        0, 0, 0, 1
    ]);
}

function translationMatrix(x, y, z) {
    return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        x, y, z, 1
    ]);
}

function renderCube() {
    if (!cubeGl) return;

    const gl = cubeGl;
    const rect = cubeCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cubeCanvas.width = rect.width * dpr;
    cubeCanvas.height = rect.height * dpr;
    gl.viewport(0, 0, cubeCanvas.width, cubeCanvas.height);

    gl.clearColor(0.043, 0.051, 0.063, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Build transformation matrix
    const aspect = cubeCanvas.width / cubeCanvas.height;
    const proj = perspectiveMatrix(Math.PI / 4, aspect, 0.1, 100);
    const view = translationMatrix(0, 0, -4);
    const rotX = rotationXMatrix(cubeRotationX);
    const rotY = rotationYMatrix(cubeRotationY);
    const center = translationMatrix(-0.5, -0.5, -0.5);

    let matrix = multiplyMatrices(proj, view);
    matrix = multiplyMatrices(matrix, rotY);
    matrix = multiplyMatrices(matrix, rotX);
    matrix = multiplyMatrices(matrix, center);

    // Cube edges (12 edges, 24 vertices)
    // Cube corners with RGB colors: (r,g,b) = position
    const cubeEdges = [
        // Bottom face edges
        0,0,0, 1,0,0,   1,0,0, 1,0,1,   1,0,1, 0,0,1,   0,0,1, 0,0,0,
        // Top face edges
        0,1,0, 1,1,0,   1,1,0, 1,1,1,   1,1,1, 0,1,1,   0,1,1, 0,1,0,
        // Vertical edges
        0,0,0, 0,1,0,   1,0,0, 1,1,0,   1,0,1, 1,1,1,   0,0,1, 0,1,1
    ];

    // Colors match positions (RGB cube)
    const edgeColors = cubeEdges.slice(); // Same as positions for RGB cube

    // Draw cube edges
    gl.useProgram(cubeProgram);

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cubeEdges), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(cubeProgram, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(edgeColors), gl.STATIC_DRAW);

    const colorLoc = gl.getAttribLocation(cubeProgram, 'a_color');
    gl.enableVertexAttribArray(colorLoc);
    gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

    const matrixLoc = gl.getUniformLocation(cubeProgram, 'u_matrix');
    gl.uniformMatrix4fv(matrixLoc, false, matrix);

    gl.drawArrays(gl.LINES, 0, 24);

    // Draw points A, B, and T
    gl.useProgram(cubePointProgram);

    const rgbA = [colorA[0] / 255, colorA[1] / 255, colorA[2] / 255];
    const rgbB = [colorB[0] / 255, colorB[1] / 255, colorB[2] / 255];
    const rgbT = [
        rgbA[0] + (rgbB[0] - rgbA[0]) * t,
        rgbA[1] + (rgbB[1] - rgbA[1]) * t,
        rgbA[2] + (rgbB[2] - rgbA[2]) * t
    ];

    const pointPositions = [
        ...rgbA, ...rgbB, ...rgbT
    ];
    const pointColors = [
        ...rgbA, ...rgbB, ...rgbT
    ];
    const pointSizes = [20.0 * dpr, 20.0 * dpr, 25.0 * dpr];

    const pointPosBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pointPosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pointPositions), gl.STATIC_DRAW);

    const pointPosLoc = gl.getAttribLocation(cubePointProgram, 'a_position');
    gl.enableVertexAttribArray(pointPosLoc);
    gl.vertexAttribPointer(pointPosLoc, 3, gl.FLOAT, false, 0, 0);

    const pointColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pointColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pointColors), gl.STATIC_DRAW);

    const pointColorLoc = gl.getAttribLocation(cubePointProgram, 'a_color');
    gl.enableVertexAttribArray(pointColorLoc);
    gl.vertexAttribPointer(pointColorLoc, 3, gl.FLOAT, false, 0, 0);

    const pointSizeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pointSizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pointSizes), gl.STATIC_DRAW);

    const pointSizeLoc = gl.getAttribLocation(cubePointProgram, 'a_size');
    gl.enableVertexAttribArray(pointSizeLoc);
    gl.vertexAttribPointer(pointSizeLoc, 1, gl.FLOAT, false, 0, 0);

    const pointMatrixLoc = gl.getUniformLocation(cubePointProgram, 'u_matrix');
    gl.uniformMatrix4fv(pointMatrixLoc, false, matrix);

    gl.drawArrays(gl.POINTS, 0, 3);

    // Draw line from A to B
    gl.useProgram(cubeProgram);

    const linePositions = [...rgbA, ...rgbB];
    const lineColors = [...rgbA, ...rgbB];

    const lineBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(linePositions), gl.STATIC_DRAW);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

    const lineColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, lineColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineColors), gl.STATIC_DRAW);
    gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

    gl.lineWidth(3.0);
    gl.drawArrays(gl.LINES, 0, 2);
}

// Cube mouse/touch rotation handlers
cubeCanvas.addEventListener('mousedown', (e) => {
    isDraggingCube = true;
    lastCubeMouseX = e.clientX;
    lastCubeMouseY = e.clientY;
    cubeCanvas.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', (e) => {
    if (isDraggingCube) {
        const dx = e.clientX - lastCubeMouseX;
        const dy = e.clientY - lastCubeMouseY;
        cubeRotationY += dx * 0.01;
        cubeRotationX += dy * 0.01;
        lastCubeMouseX = e.clientX;
        lastCubeMouseY = e.clientY;
        renderCube();
    }
});

document.addEventListener('mouseup', () => {
    isDraggingCube = false;
    cubeCanvas.style.cursor = 'grab';
});

// Touch support for cube rotation
cubeCanvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        isDraggingCube = true;
        lastCubeMouseX = e.touches[0].clientX;
        lastCubeMouseY = e.touches[0].clientY;
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    if (isDraggingCube && e.touches.length === 1) {
        const dx = e.touches[0].clientX - lastCubeMouseX;
        const dy = e.touches[0].clientY - lastCubeMouseY;
        cubeRotationY += dx * 0.01;
        cubeRotationX += dy * 0.01;
        lastCubeMouseX = e.touches[0].clientX;
        lastCubeMouseY = e.touches[0].clientY;
        renderCube();
    }
}, { passive: false });

document.addEventListener('touchend', () => {
    isDraggingCube = false;
});

// Modify the existing update function to also render the cube
const originalUpdate = update;
update = function() {
    originalUpdate();
    renderCube();
};

// Initialize and render cube
initCube();
renderCube();
