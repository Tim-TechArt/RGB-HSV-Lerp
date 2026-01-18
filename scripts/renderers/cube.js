// ============================================
// 3D RGB Cube Visualization
// ============================================

window.ColorApp = window.ColorApp || {};
window.ColorApp.Cube = {};

(function(exports, Matrix) {
    'use strict';

    // Cube state
    var cubeGl, cubeProgram, cubePointProgram, cubeSolidProgram;

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

    var solidCubeVS = `
        attribute vec3 a_position;
        uniform mat4 u_matrix;
        varying vec3 v_color;
        varying vec3 v_position;
        void main() {
            gl_Position = u_matrix * vec4(a_position, 1.0);
            v_color = a_position;
            v_position = a_position;
        }
    `;

    var solidCubeFS = `
        precision mediump float;
        varying vec3 v_color;
        varying vec3 v_position;
        uniform vec3 u_planePoint;
        uniform vec3 u_planeNormal;
        uniform float u_clipEnabled;
        uniform float u_clipToCube;
        void main() {
            if (u_clipToCube > 0.5) {
                if (v_position.x < 0.0 || v_position.x > 1.0 ||
                    v_position.y < 0.0 || v_position.y > 1.0 ||
                    v_position.z < 0.0 || v_position.z > 1.0) {
                    discard;
                }
            }
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

    function createProgramCube(gl, vs, fs) {
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

    function initCube(canvas) {
        cubeGl = canvas.getContext('webgl');
        if (!cubeGl) {
            console.error('WebGL not supported for cube');
            return null;
        }

        cubeProgram = createProgramCube(cubeGl, lineVS, lineFS);
        cubePointProgram = createProgramCube(cubeGl, pointVS, pointFS);
        cubeSolidProgram = createProgramCube(cubeGl, solidCubeVS, solidCubeFS);

        cubeGl.enable(cubeGl.BLEND);
        cubeGl.blendFunc(cubeGl.SRC_ALPHA, cubeGl.ONE_MINUS_SRC_ALPHA);

        return cubeGl;
    }

    function generateSolidCubeVertices() {
        var corners = [
            [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
            [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]
        ];

        var faces = [
            [0, 1, 2, 3],
            [5, 4, 7, 6],
            [4, 0, 3, 7],
            [1, 5, 6, 2],
            [3, 2, 6, 7],
            [4, 5, 1, 0]
        ];

        var vertices = [];

        for (var i = 0; i < faces.length; i++) {
            var face = faces[i];
            var c0 = corners[face[0]];
            var c1 = corners[face[1]];
            var c2 = corners[face[2]];
            var c3 = corners[face[3]];

            vertices.push.apply(vertices, c0.concat(c1, c2));
            vertices.push.apply(vertices, c0.concat(c2, c3));
        }

        return new Float32Array(vertices);
    }

    function calculatePlaneVectors(rgbA, rgbB) {
        var abDir = Matrix.vec3Normalize(Matrix.vec3Sub(rgbB, rgbA));

        var up = [0, 1, 0];
        var perpDir = Matrix.vec3Cross(abDir, up);
        var perpLen = Math.sqrt(perpDir[0]*perpDir[0] + perpDir[1]*perpDir[1] + perpDir[2]*perpDir[2]);
        if (perpLen < 0.001) {
            up = [1, 0, 0];
            perpDir = Matrix.vec3Cross(abDir, up);
        }
        perpDir = Matrix.vec3Normalize(perpDir);

        var normal = Matrix.vec3Normalize(Matrix.vec3Cross(abDir, perpDir));

        return { abDir: abDir, perpDir: perpDir, normal: normal };
    }

    function generateCrossSectionVertices(rgbA, rgbB, resolution) {
        resolution = resolution || 32;
        var vertices = [];
        var planeVectors = calculatePlaneVectors(rgbA, rgbB);
        var abDir = planeVectors.abDir;
        var perpDir = planeVectors.perpDir;

        var mid = Matrix.vec3Scale(Matrix.vec3Add(rgbA, rgbB), 0.5);
        var extent = 1.0;

        for (var i = 0; i < resolution; i++) {
            for (var j = 0; j < resolution; j++) {
                var tAB1 = -extent + (i / resolution) * (extent * 2);
                var tAB2 = -extent + ((i + 1) / resolution) * (extent * 2);
                var tPerp1 = -extent + (j / resolution) * (extent * 2);
                var tPerp2 = -extent + ((j + 1) / resolution) * (extent * 2);

                var p00 = Matrix.vec3Add(Matrix.vec3Add(mid, Matrix.vec3Scale(abDir, tAB1)), Matrix.vec3Scale(perpDir, tPerp1));
                var p10 = Matrix.vec3Add(Matrix.vec3Add(mid, Matrix.vec3Scale(abDir, tAB2)), Matrix.vec3Scale(perpDir, tPerp1));
                var p01 = Matrix.vec3Add(Matrix.vec3Add(mid, Matrix.vec3Scale(abDir, tAB1)), Matrix.vec3Scale(perpDir, tPerp2));
                var p11 = Matrix.vec3Add(Matrix.vec3Add(mid, Matrix.vec3Scale(abDir, tAB2)), Matrix.vec3Scale(perpDir, tPerp2));

                vertices.push.apply(vertices, p00.concat(p10, p11));
                vertices.push.apply(vertices, p00.concat(p11, p01));
            }
        }

        return new Float32Array(vertices);
    }

    function renderCube(canvas, refCanvas, colorA, colorB, t, rotationX, rotationY, rotationZ, zoom) {
        if (!cubeGl) return;

        var gl = cubeGl;
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
        var center = Matrix.translationMatrix(-0.5, -0.5, -0.5);

        var matrix = Matrix.multiplyMatrices(proj, view);
        matrix = Matrix.multiplyMatrices(matrix, rotY);
        matrix = Matrix.multiplyMatrices(matrix, rotX);
        matrix = Matrix.multiplyMatrices(matrix, rotZ);
        matrix = Matrix.multiplyMatrices(matrix, center);

        var rgbA = [colorA[0] / 255, colorA[1] / 255, colorA[2] / 255];
        var rgbB = [colorB[0] / 255, colorB[1] / 255, colorB[2] / 255];

        var planeVectors = calculatePlaneVectors(rgbA, rgbB);
        var planeNormal = planeVectors.normal;
        var planeMid = Matrix.vec3Scale(Matrix.vec3Add(rgbA, rgbB), 0.5);

        // Draw solid cube with clipping
        gl.disable(gl.BLEND);
        if (cubeSolidProgram) {
            gl.useProgram(cubeSolidProgram);

            var solidVertices = generateSolidCubeVertices();
            var solidBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, solidBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, solidVertices, gl.STATIC_DRAW);

            var solidPosLoc = gl.getAttribLocation(cubeSolidProgram, 'a_position');
            gl.enableVertexAttribArray(solidPosLoc);
            gl.vertexAttribPointer(solidPosLoc, 3, gl.FLOAT, false, 0, 0);

            var solidMatrixLoc = gl.getUniformLocation(cubeSolidProgram, 'u_matrix');
            gl.uniformMatrix4fv(solidMatrixLoc, false, matrix);

            var planePointLoc = gl.getUniformLocation(cubeSolidProgram, 'u_planePoint');
            gl.uniform3fv(planePointLoc, planeMid);

            var planeNormalLoc = gl.getUniformLocation(cubeSolidProgram, 'u_planeNormal');
            gl.uniform3fv(planeNormalLoc, planeNormal);

            var clipEnabledLoc = gl.getUniformLocation(cubeSolidProgram, 'u_clipEnabled');
            var clipToCubeLoc = gl.getUniformLocation(cubeSolidProgram, 'u_clipToCube');

            gl.uniform1f(clipEnabledLoc, 1.0);
            gl.uniform1f(clipToCubeLoc, 0.0);

            gl.drawArrays(gl.TRIANGLES, 0, 36);

            gl.uniform1f(clipEnabledLoc, 0.0);
            gl.uniform1f(clipToCubeLoc, 0.0);
        }

        // Draw cube edges
        var cubeEdges = [
            0,0,0, 1,0,0,   1,0,0, 1,0,1,   1,0,1, 0,0,1,   0,0,1, 0,0,0,
            0,1,0, 1,1,0,   1,1,0, 1,1,1,   1,1,1, 0,1,1,   0,1,1, 0,1,0,
            0,0,0, 0,1,0,   1,0,0, 1,1,0,   1,0,1, 1,1,1,   0,0,1, 0,1,1
        ];
        var edgeColors = cubeEdges.slice();

        gl.useProgram(cubeProgram);

        var posBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cubeEdges), gl.STATIC_DRAW);

        var posLoc = gl.getAttribLocation(cubeProgram, 'a_position');
        var colorLoc = gl.getAttribLocation(cubeProgram, 'a_color');
        var matrixLoc = gl.getUniformLocation(cubeProgram, 'u_matrix');

        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

        var colorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(edgeColors), gl.STATIC_DRAW);

        gl.enableVertexAttribArray(colorLoc);
        gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

        gl.uniformMatrix4fv(matrixLoc, false, matrix);

        gl.drawArrays(gl.LINES, 0, 24);

        // Draw line from A to B
        gl.depthMask(false);
        var linePositions = rgbA.concat(rgbB);
        var lineColors = rgbA.concat(rgbB);

        var lineBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(linePositions), gl.STATIC_DRAW);
        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

        var lineColorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, lineColorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineColors), gl.STATIC_DRAW);
        gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

        gl.lineWidth(3.0);
        gl.drawArrays(gl.LINES, 0, 2);
        gl.depthMask(true);

        // Draw cross-section plane
        if (cubeSolidProgram) {
            gl.useProgram(cubeSolidProgram);
            gl.depthMask(false);

            var crossSectionVertices = generateCrossSectionVertices(rgbA, rgbB, 40);
            var crossSectionBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, crossSectionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, crossSectionVertices, gl.STATIC_DRAW);

            var solidPosLoc2 = gl.getAttribLocation(cubeSolidProgram, 'a_position');
            gl.enableVertexAttribArray(solidPosLoc2);
            gl.vertexAttribPointer(solidPosLoc2, 3, gl.FLOAT, false, 0, 0);

            var solidMatrixLoc2 = gl.getUniformLocation(cubeSolidProgram, 'u_matrix');
            gl.uniformMatrix4fv(solidMatrixLoc2, false, matrix);

            var clipEnabledLoc2 = gl.getUniformLocation(cubeSolidProgram, 'u_clipEnabled');
            var clipToCubeLoc2 = gl.getUniformLocation(cubeSolidProgram, 'u_clipToCube');
            gl.uniform1f(clipEnabledLoc2, 0.0);
            gl.uniform1f(clipToCubeLoc2, 1.0);

            gl.drawArrays(gl.TRIANGLES, 0, crossSectionVertices.length / 3);
            gl.depthMask(true);
        }

        // Draw points A, B, and T
        gl.enable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.useProgram(cubePointProgram);

        var rgbT = [
            rgbA[0] + (rgbB[0] - rgbA[0]) * t,
            rgbA[1] + (rgbB[1] - rgbA[1]) * t,
            rgbA[2] + (rgbB[2] - rgbA[2]) * t
        ];

        var pointPosLoc = gl.getAttribLocation(cubePointProgram, 'a_position');
        var pointColorLoc = gl.getAttribLocation(cubePointProgram, 'a_color');
        var pointSizeLoc = gl.getAttribLocation(cubePointProgram, 'a_size');
        var pointGlowLoc = gl.getAttribLocation(cubePointProgram, 'a_hasGlow');
        var pointMatrixLoc = gl.getUniformLocation(cubePointProgram, 'u_matrix');

        var sizeScale = refRect.width / 512;
        var pointsAB_Positions = rgbA.concat(rgbB);
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

        // Point T
        var tPosBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tPosBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rgbT), gl.STATIC_DRAW);
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
    exports.initCube = initCube;
    exports.renderCube = renderCube;
    exports.generateSolidCubeVertices = generateSolidCubeVertices;
    exports.calculatePlaneVectors = calculatePlaneVectors;
    exports.generateCrossSectionVertices = generateCrossSectionVertices;

})(window.ColorApp.Cube, window.ColorApp.Matrix);
