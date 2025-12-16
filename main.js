// =================================================================
// CẤU HÌNH MÔ HÌNH CHO TỪNG NGÓN TAY (CÓ OFFSET XY)
// =================================================================
const fingerSettings = {
    4: { file: 'NgonCai.glb', scale: 4.5, offsetX: 0, offsetY: 0, offsetZ: 0, rotX: Math.PI / 2, rotY: 0, rotZ: 0 },
    8: { file: 'NgonTro.glb', scale: 4.0, offsetX: 0, offsetY: 0, offsetZ: 0, rotX: Math.PI / 2, rotY: 0, rotZ: 0 },
    12: { file: 'NgonGiua.glb', scale: 4.0, offsetX: 0, offsetY: 0, offsetZ: 0, rotX: Math.PI / 2, rotY: 0, rotZ: 0 },
    16: { file: 'NgonApUt.glb', scale: 3.5, offsetX: 0, offsetY: 0, offsetZ: 0, rotX: Math.PI / 2, rotY: 0, rotZ: 0 },
    20: { file: 'NgonUt.glb', scale: 3.5, offsetX: 0, offsetY: 0, offsetZ: 0, rotX: Math.PI / 2, rotY: 0, rotZ: 0 },
};


const fingerBaseTips = {
    4: { tip: 4, base: 3, mid: 2 },
    8: { tip: 8, base: 5, mid: 6 },
    12: { tip: 12, base: 9, mid: 10 },
    16: { tip: 16, base: 13, mid: 14 },
    20: { tip: 20, base: 17, mid: 18 }
};

// =================================================================
// KHỞI TẠO CÁC BIẾN TOÀN CỤC
// =================================================================
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

// --- QUAN TRỌNG: đồng bộ kích thước buffer của canvas với CSS để tránh lệch toạ độ ---
const VIEW_SIZE = 480;
videoElement.width = VIEW_SIZE;
videoElement.height = VIEW_SIZE;
canvasElement.width = VIEW_SIZE;
canvasElement.height = VIEW_SIZE;

const dropArea = document.getElementById('drop-area');
const dropMessage = document.getElementById('drop-message');
const calibrationMessageEl = document.getElementById('drop-message');

// Three.js Variables
let scene, camera, renderer;
let fingerObjs = {};
const fingerIds = [4, 8, 12, 16, 20];

let currentMaterial;
const POS_SMOOTH = 0.7; // bám vừa
const ROT_SMOOTH = 0.45; // mượt hơn, giảm rung
let currentUVMapping = 'spherical';

// Logic Calibration
let isCalibrating = true;
let referenceFingerSize = 0.1;
const baseGlobalScale = 0.01;
let smoothedScaleFactor = 1.0;

// Tạo canvas 3D
const threeCanvas = document.createElement('canvas');
threeCanvas.width = VIEW_SIZE;
threeCanvas.height = VIEW_SIZE;
threeCanvas.style.width = '100%';
threeCanvas.style.height = '100%';
threeCanvas.style.position = 'absolute';
threeCanvas.style.top = '0';
threeCanvas.style.left = '0';
threeCanvas.style.pointerEvents = 'none';
threeCanvas.style.zIndex = '2';
document.getElementById('drop-area').appendChild(threeCanvas);

// 1. Setup Three.js Scene
scene = new THREE.Scene();

// ✅ FIX: dùng OrthographicCamera để mapping 2D->3D khớp pixel (tránh lệch do perspective)
camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
camera.position.z = 2;

renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, alpha: true, antialias: true }); // Thêm antialias cho mịn răng cưa
renderer.setSize(threeCanvas.width, threeCanvas.height, false);
renderer.setClearColor(0x000000, 0);

renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05; // Giúp màu sắc tươi và đúng chuẩn thực tế
renderer.physicallyCorrectLights = true;



// --- ổn định hướng xoay theo thời gian ---
let lastPalmN = new THREE.Vector3(0, 0, 1);

function stabilizeQuatSign(currentQuat, targetQuat) {
    // nếu targetQuat ở phía đối diện trên hypersphere -> lật dấu để slerp mượt (tránh nhảy 180°)
    if (currentQuat.dot(targetQuat) < 0) {
        targetQuat.x *= -1;
        targetQuat.y *= -1;
        targetQuat.z *= -1;
        targetQuat.w *= -1;
    }
}
// --- ÁNH SÁNG (CẬP NHẬT MẠNH HƠN) ---

// 1. Đèn bán cầu (HemisphereLight): Giả lập ánh sáng bầu trời
// SkyColor (Trắng xanh), GroundColor (Xám đất), Intensity (Tăng lên 3.0)
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

// 2. Đèn hướng (DirectionalLight): Giả lập mặt trời
// Tăng cường độ lên 5.0 (vì đang dùng chế độ Physical)
const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(3, 10, 5); // Chiếu từ góc chéo trên cao
dirLight.castShadow = true;
scene.add(dirLight);

// 3. Đèn phụ (Fill Light): Chiếu vào mặt tối của móng tay
const fillLight = new THREE.DirectionalLight(0xffeedd, 1.0);
fillLight.position.set(-3, 0, 5);
scene.add(fillLight);

// =================================================================
// HÀM VẼ ĐIỂM
// =================================================================
function drawPoint(ctx, landmark, color, label) {
    const x = landmark.x * ctx.canvas.width;
    const y = landmark.y * ctx.canvas.height;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = "bold 12px Arial";
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.strokeText(label, 10, 5);
    ctx.fillText(label, 10, 5);
    ctx.restore();
}

// =================================================================
// HÀM TẢI MODEL
// =================================================================
function loadFingerModels() {
    const loader = new THREE.GLTFLoader();

    fingerIds.forEach(id => {
        if (fingerObjs[id]) {
            scene.remove(fingerObjs[id]);
            delete fingerObjs[id];
        }

        const config = fingerSettings[id];
        const fileName = config ? config.file : 'HoaVan.glb';

        loader.load(
            fileName,
            (gltf) => {
                const mesh = gltf.scene;

                mesh.traverse((child) => {
                    if (child.isMesh) {
                        child.geometry.computeVertexNormals();

                        // (Giữ nguyên logic material của bạn)
                        child.material = new THREE.MeshPhysicalMaterial({
                            color: 0xffffff,
                            metalness: 0.0,
                            roughness: 0.2,
                            clearcoat: 1.0,
                            clearcoatRoughness: 0.1,
                            reflectivity: 0.5,
                            envMapIntensity: 1.0,
                            emissive: 0xfff0e0,
                            emissiveIntensity: 0.1
                        });
                        if (id === 8) currentMaterial = child.material;

                        // Center geometry (giữ nguyên như bạn đang làm)
                        child.geometry.computeBoundingBox();
                        const bbox = child.geometry.boundingBox;
                        const center = new THREE.Vector3();
                        bbox.getCenter(center);
                        child.geometry.translate(-center.x, -center.y, -center.z);
                    }
                });

                const initialScale = baseGlobalScale * (config ? config.scale : 1.0);
                mesh.scale.set(initialScale, initialScale, initialScale);

                scene.add(mesh);
                fingerObjs[id] = mesh;
                console.log(`Đã tải: ${fileName} cho ngón ${id}`);
            },
            undefined,
            (error) => { console.warn(`Không tải được file ${fileName}`); }
        );
    });
}
loadFingerModels();

// =================================================================
// MEDIAPIPE & WEBCAM
// =================================================================
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
});
hands.onResults(onResults);

setTimeout(() => {
    isCalibrating = false;
    dropMessage.textContent = 'Thả ảnh vào đây';
}, 5000);

const webcam = new Camera(videoElement, {
    onFrame: async () => { await hands.send({ image: videoElement }); },
    width: VIEW_SIZE, height: VIEW_SIZE
});
webcam.start();

// function toVector3(p) {
//     // p.x, p.y: [0..1] trong hệ toạ độ ảnh (KHÔNG mirror).
//     // Màn hình đang được mirror khi vẽ canvas 2D, nên 3D cũng mirror theo X để khớp.
//     const x = 1 - 2 * p.x;        // mirror: trái<->phải
//     const y = 1 - 2 * p.y;        // y: trên=+1, dưới=-1
//     const z = p.z * 0.5;          // z nhỏ lại cho dễ kiểm soát
//     return new THREE.Vector3(x, y, z);
// }

const Z_SCALE = 2.2; // tăng/giảm: 1.5 ~ 3.0 tùy bạn

function toVector3(p) {
    const x = 1 - 2 * p.x;     // mirror theo canvas
    const y = 1 - 2 * p.y;
    const z = -p.z * Z_SCALE;  // NOTE: Mediapipe z thường âm khi gần camera, nên mình đảo dấu
    return new THREE.Vector3(x, y, z);
}


function getFingerDirection(landmarks, tipId, baseId) {
    const vTip = toVector3(landmarks[tipId]);
    const vBase = toVector3(landmarks[baseId]);
    return new THREE.Vector3().subVectors(vTip, vBase).normalize();
}

function getPalmNormal(landmarks) {
    const wrist = toVector3(landmarks[0]);
    const indexMcp = toVector3(landmarks[5]);
    const middleMcp = toVector3(landmarks[9]);
    const pinkyMcp = toVector3(landmarks[17]);

    // dùng vector ngang bàn tay + vector dọc lòng bàn tay => normal ổn định hơn
    const across = new THREE.Vector3().subVectors(pinkyMcp, indexMcp).normalize();
    const upPalm = new THREE.Vector3().subVectors(middleMcp, wrist).normalize();

    return new THREE.Vector3().crossVectors(across, upPalm).normalize();
}


function computeScaleFactor(landmarks) {
    const wrist = landmarks[0];
    const indexMcp = landmarks[5];
    const dx = wrist.x - indexMcp.x;
    const dy = wrist.y - indexMcp.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (isCalibrating) {
        referenceFingerSize = (referenceFingerSize * 0.9) + (dist * 0.1);
        return 1.0;
    }
    return dist / referenceFingerSize;
}

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // ✅ Mirror 1 lần ở đây (đừng mirror video bằng CSS nữa)
    canvasCtx.scale(-1, 1);
    canvasCtx.translate(-canvasElement.width, 0);

    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        let palmN = getPalmNormal(landmarks);

        // khóa dấu: nếu palmN mới quay ngược 180° so với frame trước thì flip lại
        if (palmN.dot(lastPalmN) < 0) palmN.negate();

        // smooth để giảm rung
        lastPalmN.lerp(palmN, 0.25).normalize();

        // (tuỳ bạn bật/tắt debug)
        drawPoint(canvasCtx, landmarks[0], 'blue', 'Cổ Tay');

        const scaleFactor = computeScaleFactor(landmarks);
        smoothedScaleFactor = smoothedScaleFactor * 0.85 + scaleFactor * 0.15;

        fingerIds.forEach((fingerId) => {
            const obj = fingerObjs[fingerId];
            const config = fingerSettings[fingerId];
            const ids = fingerBaseTips[fingerId];
            if (!obj || !config || !ids) return;

            const vTip = toVector3(landmarks[ids.tip]);
            const vBase = toVector3(landmarks[ids.base]);
            const vMid = toVector3(landmarks[ids.mid]);

            // --- khóa roll theo lòng bàn tay để móng luôn "dọc" theo ngón ---
            const palmN = getPalmNormal(landmarks); // nếu thấy móng lật mặt trong/ngoài, thử .negate()

            // Hướng ngón: base -> tip (ổn định hơn lấy tip-base)
            const fingerDir = new THREE.Vector3().subVectors(vTip, vBase).normalize();

            // dùng palm normal đã được ổn định để khóa roll theo bàn tay
            let xAxis = new THREE.Vector3().crossVectors(lastPalmN, fingerDir).normalize();
            if (xAxis.lengthSq() < 1e-8) xAxis.set(1, 0, 0);

            let yAxis = new THREE.Vector3().crossVectors(fingerDir, xAxis).normalize();

            // dựng basis
            const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, fingerDir);
            const finalQuaternion = new THREE.Quaternion().setFromRotationMatrix(m);

            // correction theo local model (nếu bạn có rotX/rotY/rotZ)
            const corr = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(config.rotX || 0, config.rotY || 0, config.rotZ || 0)
            );
            finalQuaternion.multiply(corr);

            // ✅ chống nhảy 180° do quaternion đổi dấu
            stabilizeQuatSign(obj.quaternion, finalQuaternion);


            // Offset theo local (tắt offset mặc định để khớp tọa độ trước)
            const localOffset = new THREE.Vector3(config.offsetX, config.offsetY, config.offsetZ);
            localOffset.applyQuaternion(finalQuaternion);

            const targetPos = new THREE.Vector3().addVectors(vTip, localOffset);

            obj.position.lerp(targetPos, POS_SMOOTH);
obj.quaternion.slerp(finalQuaternion, ROT_SMOOTH);

            const s = baseGlobalScale * config.scale * smoothedScaleFactor;
            obj.scale.set(s, s, s);
        });
    }

    canvasCtx.restore();

    renderer.render(scene, camera);
}

// =================================================================
// KÉO THẢ TEXTURE
// =================================================================
dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.classList.add('highlight');
});
dropArea.addEventListener('dragleave', () => {
    dropArea.classList.remove('highlight');
});
dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.classList.remove('highlight');
    handleFiles(e.dataTransfer.files);
});

document.getElementById('file-input').addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function handleFiles(files) {
    if (files.length > 0 && files[0].type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => applyTextureToAll(e.target.result);
        reader.readAsDataURL(files[0]);
    }
}

function applyTextureToAll(imageDataUrl) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(imageDataUrl, (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        fingerIds.forEach(id => {
            const obj = fingerObjs[id];
            if (!obj) return;

            obj.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.map = texture;
                    child.material.needsUpdate = true;
                }
            });
        });
        console.log("Đã áp texture cho tất cả ngón.");
    });
}

function resetTexture() {
    fingerIds.forEach(id => {
        const obj = fingerObjs[id];
        if (!obj) return;

        obj.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.map = null;
                child.material.needsUpdate = true;
            }
        });
    });
    console.log("Đã reset texture.");
}

// =================================================================
// UV MAPPING (giữ nguyên logic bạn đang có)
// =================================================================
function changeUVMapping() {
    currentUVMapping = (currentUVMapping === 'spherical') ? 'cylindrical' : 'spherical';

    fingerIds.forEach(id => {
        const obj = fingerObjs[id];
        if (!obj) return;

        obj.traverse((child) => {
            if (child.isMesh) {
                updateUVs(child.geometry, currentUVMapping);
                child.geometry.attributes.uv.needsUpdate = true;
            }
        });
    });

    console.log("Đổi UV Mapping:", currentUVMapping);
}

function updateUVs(geometry, mode) {
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;
    const size = new THREE.Vector3();
    bbox.getSize(size);

    const positions = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    if (!uv) {
        const uvs = new Float32Array(positions.count * 2);
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    }

    const uvs = geometry.attributes.uv.array;

    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);

        let u = 0, v = 0;

        if (mode === 'spherical') {
            const nx = (x - bbox.min.x) / size.x - 0.5;
            const ny = (y - bbox.min.y) / size.y - 0.5;
            const nz = (z - bbox.min.z) / size.z - 0.5;

            const theta = Math.atan2(nz, nx);
            const phi = Math.acos(ny / Math.sqrt(nx * nx + ny * ny + nz * nz));

            u = (theta + Math.PI) / (2 * Math.PI);
            v = phi / Math.PI;
        } else {
            const angle = Math.atan2(z, x);
            u = (angle + Math.PI) / (2 * Math.PI);
            v = (y - bbox.min.y) / size.y;
        }

        uvs[i * 2] = u;
        uvs[i * 2 + 1] = v;
    }
}
