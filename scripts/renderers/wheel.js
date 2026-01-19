// ============================================
// 2D Color Wheel WebGL Renderer
// ============================================

window.ColorApp = window.ColorApp || {};
window.ColorApp.Wheel = {};

(function(exports) {
    'use strict';

    // Wheel scale - must match shader
    var WHEEL_SCALE = 0.85;

    var vertexShaderSource = `
        attribute vec2 a_position;
        varying vec2 v_uv;

        void main() {
            v_uv = a_position * 0.5 + 0.5;
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    `;

    var fragmentShaderSource = `
        precision highp float;

        varying vec2 v_uv;

        uniform vec3 u_colorA;
        uniform vec3 u_colorB;
        uniform float u_t;
        uniform int u_mode;
        uniform int u_hueDirection;
        uniform float u_revolutions;

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
            float angle = fract(0.25 - atan(uv.y, uv.x) / (2.0 * PI));

            float wheelScale = 0.85;
            float wheelDist = dist / wheelScale;
            vec3 wheelColor = hsv2rgb(vec3(angle, clamp(wheelDist, 0.0, 1.0), 1.0));
            float wheelMask = smoothstep(wheelScale, wheelScale - 0.02, dist);

            vec3 hsvA = rgb2hsv(u_colorA);
            vec3 hsvB = rgb2hsv(u_colorB);

            vec2 posA = vec2(cos((0.25 - hsvA.x) * 2.0 * PI), sin((0.25 - hsvA.x) * 2.0 * PI)) * hsvA.y * wheelScale;
            vec2 posB = vec2(cos((0.25 - hsvB.x) * 2.0 * PI), sin((0.25 - hsvB.x) * 2.0 * PI)) * hsvB.y * wheelScale;

            float pathWidth = 0.04;
            vec3 pathColor = vec3(0.0);
            float pathAlpha = 0.0;
            float glowAlpha = 0.0;
            vec3 glowColor = vec3(1.0, 1.0, 1.0);

            if (u_mode == 0) {
                vec2 ab = posB - posA;
                float len = length(ab);
                vec2 dir = ab / len;
                vec2 toPoint = uv - posA;
                float proj = clamp(dot(toPoint, dir), 0.0, len);
                vec2 closest = posA + dir * proj;
                float distToLine = length(uv - closest);

                float glowWidth = 0.12;
                glowAlpha = smoothstep(glowWidth, 0.0, distToLine) * 0.6;

                pathAlpha = smoothstep(pathWidth, pathWidth * 0.3, distToLine);

                float pathT = proj / len;
                pathColor = mix(u_colorA, u_colorB, pathT);
            } else {
                float hueA = hsvA.x;
                float hueB = hsvB.x;

                if (u_hueDirection == 0) {
                    float hueDiff = hueB - hueA;
                    if (hueDiff > 0.5) {
                        hueA += 1.0;
                    } else if (hueDiff < -0.5) {
                        hueB += 1.0;
                    }
                } else if (u_hueDirection == 1) {
                    if (hueB <= hueA) {
                        hueB += 1.0;
                    }
                } else if (u_hueDirection == 2) {
                    if (hueB >= hueA) {
                        hueA += 1.0;
                    }
                } else if (u_hueDirection == 3) {
                    if (hueB <= hueA) {
                        hueB += 1.0;
                    }
                    hueB += u_revolutions;
                } else if (u_hueDirection == 4) {
                    if (hueB >= hueA) {
                        hueA += 1.0;
                    }
                    hueA += u_revolutions;
                }

                float minH = min(hueA, hueB);
                float maxH = max(hueA, hueB);

                float pointHue = angle;

                for (int wrap = 0; wrap < 4; wrap++) {
                    float testHue = pointHue + float(wrap);
                    if (testHue >= minH && testHue <= maxH) {
                        float arcT = (testHue - minH) / (maxH - minH);

                        if (hueA > hueB) arcT = 1.0 - arcT;

                        float expectedSat = mix(hsvA.y, hsvB.y, arcT) * wheelScale;
                        float distToArc = abs(dist - expectedSat);

                        float glowWidth = 0.12;
                        float thisGlow = smoothstep(glowWidth, 0.0, distToArc) * 0.6;
                        glowAlpha = max(glowAlpha, thisGlow);

                        float thisPath = smoothstep(pathWidth, pathWidth * 0.3, distToArc);
                        if (thisPath > pathAlpha) {
                            pathAlpha = thisPath;
                            float h = mod(mix(hueA, hueB, arcT), 1.0);
                            float s = mix(hsvA.y, hsvB.y, arcT);
                            float v = mix(hsvA.z, hsvB.z, arcT);
                            pathColor = hsv2rgb(vec3(h, s, v));
                        }
                    }
                }
            }

            float dotRadius = 0.12;
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

                if (u_hueDirection == 0) {
                    float hueDiff2 = hueB2 - hueA2;
                    if (abs(hueDiff2) > 0.5) {
                        if (hueDiff2 > 0.0) hueA2 += 1.0;
                        else hueB2 += 1.0;
                    }
                } else if (u_hueDirection == 1) {
                    if (hueB2 <= hueA2) hueB2 += 1.0;
                } else if (u_hueDirection == 2) {
                    if (hueB2 >= hueA2) hueA2 += 1.0;
                } else if (u_hueDirection == 3) {
                    if (hueB2 <= hueA2) hueB2 += 1.0;
                    hueB2 += u_revolutions;
                } else if (u_hueDirection == 4) {
                    if (hueB2 >= hueA2) hueA2 += 1.0;
                    hueA2 += u_revolutions;
                }

                float h = mod(mix(hueA2, hueB2, u_t), 1.0);
                float s = mix(hsvA.y, hsvB.y, u_t);
                float v = mix(hsvA.z, hsvB.z, u_t);
                posT = vec2(cos((0.25 - h) * 2.0 * PI), sin((0.25 - h) * 2.0 * PI)) * s * wheelScale;
                colorT = hsv2rgb(vec3(h, s, v));
            }

            float distT = length(uv - posT);
            float dotTRadius = 0.135;
            float dotTMask = smoothstep(dotTRadius, dotTRadius - 0.01, distT);
            float dotTBorder = smoothstep(dotTRadius + dotBorder, dotTRadius + dotBorder - 0.01, distT) - dotTMask;

            vec3 bgColor = vec3(0.043, 0.051, 0.063);
            vec3 finalColor = mix(bgColor, wheelColor, wheelMask);

            finalColor = mix(finalColor, glowColor, glowAlpha * wheelMask);
            finalColor = mix(finalColor, pathColor, pathAlpha * 0.95);

            finalColor = mix(finalColor, vec3(1.0), dotABorder);
            finalColor = mix(finalColor, u_colorA, dotAMask);

            finalColor = mix(finalColor, vec3(1.0), dotBBorder);
            finalColor = mix(finalColor, u_colorB, dotBMask);

            finalColor = mix(finalColor, vec3(1.0), dotTBorder);
            finalColor = mix(finalColor, colorT, dotTMask);

            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;

    function createShader(gl, type, source) {
        var shader = gl.createShader(type);
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
        var program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    function createWheelContext(canvas, mode) {
        var gl = canvas.getContext('webgl');
        if (!gl) {
            console.error('WebGL not supported');
            return null;
        }

        var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
        var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
        var program = createProgram(gl, vertexShader, fragmentShader);

        var positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1,
        ]), gl.STATIC_DRAW);

        var positionLocation = gl.getAttribLocation(program, 'a_position');

        return {
            gl: gl,
            program: program,
            positionBuffer: positionBuffer,
            positionLocation: positionLocation,
            uniforms: {
                colorA: gl.getUniformLocation(program, 'u_colorA'),
                colorB: gl.getUniformLocation(program, 'u_colorB'),
                t: gl.getUniformLocation(program, 'u_t'),
                mode: gl.getUniformLocation(program, 'u_mode'),
                hueDirection: gl.getUniformLocation(program, 'u_hueDirection'),
                revolutions: gl.getUniformLocation(program, 'u_revolutions')
            },
            mode: mode
        };
    }

    function renderWheel(ctx, colorA, colorB, t, hueDirection, spiralRevolutions) {
        hueDirection = hueDirection || 'shortest';
        spiralRevolutions = (spiralRevolutions !== undefined) ? spiralRevolutions : 1;

        var gl = ctx.gl;
        var program = ctx.program;
        var positionBuffer = ctx.positionBuffer;
        var positionLocation = ctx.positionLocation;
        var uniforms = ctx.uniforms;
        var mode = ctx.mode;

        var rect = gl.canvas.getBoundingClientRect();
        var dpr = window.devicePixelRatio || 1;
        gl.canvas.width = rect.width * dpr;
        gl.canvas.height = rect.height * dpr;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.useProgram(program);

        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        gl.uniform3f(uniforms.colorA, colorA[0] / 255, colorA[1] / 255, colorA[2] / 255);
        gl.uniform3f(uniforms.colorB, colorB[0] / 255, colorB[1] / 255, colorB[2] / 255);
        gl.uniform1f(uniforms.t, t);
        gl.uniform1i(uniforms.mode, mode);

        var hueDir = 0;
        if (hueDirection === 'clockwise') hueDir = 1;
        else if (hueDirection === 'counter') hueDir = 2;
        else if (hueDirection === 'spiralCW') hueDir = 3;
        else if (hueDirection === 'spiralCCW') hueDir = 4;
        gl.uniform1i(uniforms.hueDirection, hueDir);
        gl.uniform1f(uniforms.revolutions, spiralRevolutions);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // Export to namespace
    exports.WHEEL_SCALE = WHEEL_SCALE;
    exports.createWheelContext = createWheelContext;
    exports.renderWheel = renderWheel;

})(window.ColorApp.Wheel);
