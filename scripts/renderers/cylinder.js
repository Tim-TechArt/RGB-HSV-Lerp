// ============================================
// 3D HSV Cylinder Visualization
// ============================================

window.ColorApp = window.ColorApp || {};
window.ColorApp.Cylinder = {};

(function(exports, Matrix, Color) {
    'use strict';

    // Cylinder state
    var cylinderGl, cylinderProgram, cylinderPointProgram, cylinderSolidProgram;

    // Shader sources
    var lineVS = `
        attribute vec3 a_position;
        attribute vec3 a_color;
        uniform mat4 u_matrix;
        varying vec3 v_color;
        void main() {
            gl_Position = u_matrix * vec4(a_position, 1.0);
            v_color = a_color;
        }
    `;

    var lineFS = `
        precision mediump float;
        varying vec3 v_color;
        void main() {
            gl_FragColor = vec4(v_color, 1.0);
        }
    `;

    var pointVS = `
        attribute vec3 a_position;
        attribute vec3 a_color;
        attribute float a_size;
        attribute float a_hasGlow;
        uniform mat4 u_matrix;
        varying vec3 v_color;
        varying float v_hasGlow;
        void main() {
            gl_Position = u_matrix * vec4(a_position, 1.0);
            gl_PointSize = a_size;
            v_color = a_color;
            v_hasGlow = a_hasGlow;
        }
    `;

    var pointFS = `
        precision mediump float;
        varying vec3 v_color;
        varying float v_hasGlow;
        void main() {
            float dist = length(gl_PointCoord - vec2(0.5));
            if (dist > 0.5) discard;

            float alpha = smoothstep(0.5, 0.47, dist);
            vec3 finalColor = v_color;

            if (v_hasGlow > 0.5) {
                float innerRadius = 0.42;
                float borderMask = smoothstep(innerRadius - 0.01, innerRadius, dist);
                finalColor = mix(v_color, vec3(1.0), borderMask);
            }

            gl_FragColor = vec4(finalColor, alpha);
        }
    `;

    var solidCylinderVS = `
        attribute vec3 a_position;
        uniform mat4 u_matrix;
        varying vec3 v_color;
        varying vec3 v_position;
        void main() {
            gl_Position = u_matrix * vec4(a_position, 1.0);
            v_position = a_position;

            float hue = fract(0.25 - atan(-a_position.z, a_position.x) / (2.0 * 3.14159265));
            float sat = length(vec2(a_position.x, a_position.z)) * 2.0;
            float val = a_position.y;

            vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
            vec3 p = abs(fract(vec3(hue) + K.xyz) * 6.0 - K.www);
            v_color = val * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), sat);
        }
    `;

    var solidCylinderFS = `
        precision mediump float;
        varying vec3 v_color;
        varying vec3 v_position;
        uniform vec3 u_planePoint;
        uniform vec3 u_planeNormal;
        uniform float u_clipEnabled;

        void main() {
            if (u_clipEnabled > 0.5) {
                float dist = dot(v_position - u_planePoint, u_planeNormal);
                if (dist > 0.0) discard;
            }
            gl_FragColor = vec4(v_color, 1.0);
        }
    `;

    function compileShader(gl, type, source) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }

    function createProgramCyl(gl, vs, fs) {
        var program = gl.createProgram();
        gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vs));
        gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    function initCylinder(canvas) {
        cylinderGl = canvas.getContext('webgl');
        if (!cylinderGl) {
            console.error('WebGL not supported for cylinder');
            return null;
        }

        cylinderProgram = createProgramCyl(cylinderGl, lineVS, lineFS);
        cylinderPointProgram = createProgramCyl(cylinderGl, pointVS, pointFS);
        cylinderSolidProgram = createProgramCyl(cylinderGl, solidCylinderVS, solidCylinderFS);

        cylinderGl.enable(cylinderGl.BLEND);
        cylinderGl.blendFunc(cylinderGl.SRC_ALPHA, cylinderGl.ONE_MINUS_SRC_ALPHA);

        return cylinderGl;
    }

    function generateCylinderVertices(segments, rings) {
        var vertices = [];
        var radius = 0.5;

        for (var ring = 0; ring < rings; ring++) {
            for (var seg = 0; seg < segments; seg++) {
                var y0 = ring / rings;
                var y1 = (ring + 1) / rings;

                var angle0 = (seg / segments) * Math.PI * 2;
                var angle1 = ((seg + 1) / segments) * Math.PI * 2;

                var x0 = Math.cos(angle0) * radius;
                var z0 = Math.sin(angle0) * radius;
                var x1 = Math.cos(angle1) * radius;
                var z1 = Math.sin(angle1) * radius;

                vertices.push(x0, y0, z0, x1, y0, z1, x0, y1, z0);
                vertices.push(x1, y0, z1, x1, y1, z1, x0, y1, z0);
            }
        }

        return new Float32Array(vertices);
    }

    function generateCylinderCaps(segments) {
        var vertices = [];
        var radius = 0.5;

        // Top cap (y = 1)
        for (var seg = 0; seg < segments; seg++) {
            var angle0 = (seg / segments) * Math.PI * 2;
            var angle1 = ((seg + 1) / segments) * Math.PI * 2;

            var x0 = Math.cos(angle0) * radius;
            var z0 = Math.sin(angle0) * radius;
            var x1 = Math.cos(angle1) * radius;
            var z1 = Math.sin(angle1) * radius;

            vertices.push(0, 1, 0, x0, 1, z0, x1, 1, z1);
        }

        // Bottom cap (y = 0)
        for (var seg2 = 0; seg2 < segments; seg2++) {
            var angle0b = (seg2 / segments) * Math.PI * 2;
            var angle1b = ((seg2 + 1) / segments) * Math.PI * 2;

            var x0b = Math.cos(angle0b) * radius;
            var z0b = Math.sin(angle0b) * radius;
            var x1b = Math.cos(angle1b) * radius;
            var z1b = Math.sin(angle1b) * radius;

            vertices.push(0, 0, 0, x1b, 0, z1b, x0b, 0, z0b);
        }

        return new Float32Array(vertices);
    }

    function generateCylinderWireframe(segments) {
        var edges = [];
        var radius = 0.5;

        // Vertical edges
        for (var seg = 0; seg < segments; seg += segments / 8) {
            var angle = (seg / segments) * Math.PI * 2;
            var x = Math.cos(angle) * radius;
            var z = Math.sin(angle) * radius;
            edges.push(x, 0, z, x, 1, z);
        }

        // Top and bottom rings
        for (var seg2 = 0; seg2 < segments; seg2++) {
            var angle0 = (seg2 / segments) * Math.PI * 2;
            var angle1 = ((seg2 + 1) / segments) * Math.PI * 2;

            var x0 = Math.cos(angle0) * radius;
            var z0 = Math.sin(angle0) * radius;
            var x1 = Math.cos(angle1) * radius;
            var z1 = Math.sin(angle1) * radius;

            edges.push(x0, 1, z0, x1, 1, z1);
            edges.push(x0, 0, z0, x1, 0, z1);
        }

        return edges;
    }

    function hsvToCylinderPos(h, s, v) {
        var radius = 0.5;
        var angle = (0.25 - h) * Math.PI * 2;
        return [
            Math.cos(angle) * s * radius,
            v,
            -Math.sin(angle) * s * radius
        ];
    }

    function renderCylinder(canvas, refCanvas, colorA, colorB, t, hueDirection, spiralRevolutions, rotationX, rotationY, rotationZ, zoom) {
        if (!cylinderGl) return;

        var gl = cylinderGl;
        var refRect = refCanvas.getBoundingClientRect();
        var dpr = window.devicePixelRatio || 1;
        canvas.width = refRect.width * dpr;
        canvas.height = refRect.height * dpr;
        canvas.style.width = refRect.width + 'px';
        canvas.style.height = refRect.height + 'px';
        gl.viewport(0, 0, canvas.width, canvas.height);

        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);

        gl.clearColor(0.043, 0.051, 0.063, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        var aspect = canvas.width / canvas.height;
        var proj = Matrix.perspectiveMatrix(Math.PI / 4, aspect, 0.1, 100);
        var view = Matrix.translationMatrix(0, 0, -zoom);
        var rotX = Matrix.rotationXMatrix(rotationX);
        var rotY = Matrix.rotationYMatrix(rotationY);
        var rotZ = Matrix.rotationZMatrix(rotationZ);
        var center = Matrix.translationMatrix(0, -0.5, 0);

        var matrix = Matrix.multiplyMatrices(proj, view);
        matrix = Matrix.multiplyMatrices(matrix, rotX);
        matrix = Matrix.multiplyMatrices(matrix, rotY);
        matrix = Matrix.multiplyMatrices(matrix, rotZ);
        matrix = Matrix.multiplyMatrices(matrix, center);

        var hsvA = Color.rgb2hsv(colorA[0], colorA[1], colorA[2]);
        var hsvB = Color.rgb2hsv(colorB[0], colorB[1], colorB[2]);

        // Draw solid cylinder
        gl.disable(gl.BLEND);
        if (cylinderSolidProgram) {
            gl.useProgram(cylinderSolidProgram);

            var sideVertices = generateCylinderVertices(64, 32);
            var sideBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, sideBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, sideVertices, gl.STATIC_DRAW);

            var solidPosLoc = gl.getAttribLocation(cylinderSolidProgram, 'a_position');
            gl.enableVertexAttribArray(solidPosLoc);
            gl.vertexAttribPointer(solidPosLoc, 3, gl.FLOAT, false, 0, 0);

            var solidMatrixLoc = gl.getUniformLocation(cylinderSolidProgram, 'u_matrix');
            gl.uniformMatrix4fv(solidMatrixLoc, false, matrix);

            var clipEnabledLoc = gl.getUniformLocation(cylinderSolidProgram, 'u_clipEnabled');
            gl.uniform1f(clipEnabledLoc, 0.0);

            gl.drawArrays(gl.TRIANGLES, 0, sideVertices.length / 3);

            var capVertices = generateCylinderCaps(64);
            var capBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, capBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, capVertices, gl.STATIC_DRAW);
            gl.vertexAttribPointer(solidPosLoc, 3, gl.FLOAT, false, 0, 0);

            gl.drawArrays(gl.TRIANGLES, 0, capVertices.length / 3);
        }

        // Calculate hue values for T point positioning
        var hueA = hsvA[0];
        var hueB = hsvB[0];

        if (hueDirection === 'shortest') {
            var hueDiff = hueB - hueA;
            if (hueDiff > 0.5) hueA += 1;
            else if (hueDiff < -0.5) hueB += 1;
        } else if (hueDirection === 'clockwise') {
            if (hueB <= hueA) hueB += 1;
        } else if (hueDirection === 'counter') {
            if (hueB >= hueA) hueA += 1;
        } else if (hueDirection === 'spiralCW') {
            if (hueB <= hueA) hueB += 1;
            hueB += spiralRevolutions;
        } else if (hueDirection === 'spiralCCW') {
            if (hueB >= hueA) hueA += 1;
            hueA += spiralRevolutions;
        }

        // Draw points A, B, T
        gl.enable(gl.BLEND);
        gl.useProgram(cylinderPointProgram);

        var posA = hsvToCylinderPos(hsvA[0], hsvA[1], hsvA[2]);
        var posB = hsvToCylinderPos(hsvB[0], hsvB[1], hsvB[2]);

        var tHue = (hueA + (hueB - hueA) * t) % 1;
        var tSat = hsvA[1] + (hsvB[1] - hsvA[1]) * t;
        var tVal = hsvA[2] + (hsvB[2] - hsvA[2]) * t;
        var posT = hsvToCylinderPos(tHue < 0 ? tHue + 1 : tHue, tSat, tVal);

        var rgbA = [colorA[0] / 255, colorA[1] / 255, colorA[2] / 255];
        var rgbB = [colorB[0] / 255, colorB[1] / 255, colorB[2] / 255];
        var rgbT_color = Color.hsv2rgb(tHue < 0 ? tHue + 1 : tHue, tSat, tVal);
        var rgbT = [rgbT_color[0] / 255, rgbT_color[1] / 255, rgbT_color[2] / 255];

        var pointPosLoc = gl.getAttribLocation(cylinderPointProgram, 'a_position');
        var pointColorLoc = gl.getAttribLocation(cylinderPointProgram, 'a_color');
        var pointSizeLoc = gl.getAttribLocation(cylinderPointProgram, 'a_size');
        var pointGlowLoc = gl.getAttribLocation(cylinderPointProgram, 'a_hasGlow');
        var pointMatrixLoc = gl.getUniformLocation(cylinderPointProgram, 'u_matrix');

        var sizeScale = refRect.width / 512;
        var pointsAB_Positions = posA.concat(posB);
        var pointsAB_Colors = rgbA.concat(rgbB);
        var pointsAB_Sizes = [60.0 * dpr * sizeScale, 60.0 * dpr * sizeScale];
        var pointsAB_Glows = [1.0, 1.0];

        var abPosBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, abPosBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pointsAB_Positions), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(pointPosLoc);
        gl.vertexAttribPointer(pointPosLoc, 3, gl.FLOAT, false, 0, 0);

        var abColorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, abColorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pointsAB_Colors), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(pointColorLoc);
        gl.vertexAttribPointer(pointColorLoc, 3, gl.FLOAT, false, 0, 0);

        var abSizeBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, abSizeBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pointsAB_Sizes), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(pointSizeLoc);
        gl.vertexAttribPointer(pointSizeLoc, 1, gl.FLOAT, false, 0, 0);

        var abGlowBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, abGlowBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pointsAB_Glows), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(pointGlowLoc);
        gl.vertexAttribPointer(pointGlowLoc, 1, gl.FLOAT, false, 0, 0);

        gl.uniformMatrix4fv(pointMatrixLoc, false, matrix);
        gl.drawArrays(gl.POINTS, 0, 2);

        // Point T with glow
        var tPosBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tPosBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(posT), gl.STATIC_DRAW);
        gl.vertexAttribPointer(pointPosLoc, 3, gl.FLOAT, false, 0, 0);

        var tColorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tColorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rgbT), gl.STATIC_DRAW);
        gl.vertexAttribPointer(pointColorLoc, 3, gl.FLOAT, false, 0, 0);

        var tSizeBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tSizeBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([70.0 * dpr * sizeScale]), gl.STATIC_DRAW);
        gl.vertexAttribPointer(pointSizeLoc, 1, gl.FLOAT, false, 0, 0);

        var tGlowBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tGlowBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1.0]), gl.STATIC_DRAW);
        gl.vertexAttribPointer(pointGlowLoc, 1, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.POINTS, 0, 1);
    }

    // Export to namespace
    exports.initCylinder = initCylinder;
    exports.renderCylinder = renderCylinder;
    exports.hsvToCylinderPos = hsvToCylinderPos;
    exports.generateCylinderVertices = generateCylinderVertices;
    exports.generateCylinderCaps = generateCylinderCaps;
    exports.generateCylinderWireframe = generateCylinderWireframe;

})(window.ColorApp.Cylinder, window.ColorApp.Matrix, window.ColorApp.Color);
