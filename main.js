// =================================================================
// CẤU HÌNH MÔ HÌNH CHO TỪNG NGÓN TAY (CÓ OFFSET XY)
// =================================================================
const fingerSettings = {
    // offsetX: Trái/Phải | offsetY: Dọc ngón tay | offsetZ: Độ cao
    4: { file: 'NgonCai.glb', scale: 4.5, offsetX: 0, offsetY: 0, offsetZ: 0.2 },
    8: { file: 'NgonTro.glb', scale: 4.0, offsetX: 0, offsetY: 0, offsetZ: 0.2 },
    12: { file: 'NgonGiua.glb', scale: 4.0, offsetX: 0, offsetY: 0, offsetZ: 0.2 },
    16: { file: 'NgonApUt.glb', scale: 3.5, offsetX: 0, offsetY: 0, offsetZ: 0.2 },
    20: { file: 'NgonUt.glb', scale: 3.5, offsetX: 0, offsetY: 0, offsetZ: 0.2 }
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
const dropArea = document.getElementById('drop-area');
const dropMessage = document.getElementById('drop-message');
const calibrationMessageEl = document.getElementById('drop-message');

// Three.js Variables
let scene, camera, renderer;
let fingerObjs = {};
const fingerIds = [4, 8, 12, 16, 20];

let currentMaterial;
let smoothingFactor = 0.99;
let currentUVMapping = 'spherical';

// Logic Calibration
let isCalibrating = true;
let referenceFingerSize = 0.1;
const baseGlobalScale = 0.01;
let smoothedScaleFactor = 1.0;

// Tạo canvas 3D
const threeCanvas = document.createElement('canvas');
threeCanvas.width = 480;
threeCanvas.height = 480;
threeCanvas.style.position = 'absolute';
threeCanvas.style.top = '0';
threeCanvas.style.left = '0';
threeCanvas.style.pointerEvents = 'none';
document.getElementById('drop-area').appendChild(threeCanvas);

// 1. Setup Three.js Scene
scene = new THREE.Scene();
camera = new THREE.PerspectiveCamera(70, 480 / 480, 0.1, 1000);
camera.position.z = 1.5;

renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, alpha: true, antialias: true }); // Thêm antialias cho mịn răng cưa
renderer.setSize(threeCanvas.width, threeCanvas.height);
renderer.setClearColor(0x000000, 0);

renderer.outputEncoding = THREE.sRGBEncoding; // Giúp màu sắc tươi và đúng chuẩn thực tế
renderer.physicallyCorrectLights = true;
// --- ÁNH SÁNG (CẬP NHẬT MẠNH HƠN) ---

// 1. Đèn bán cầu (HemisphereLight): Giả lập ánh sáng bầu trời
// SkyColor (Trắng xanh), GroundColor (Xám đất), Intensity (Tăng lên 3.0)
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2.0);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

// 2. Đèn hướng (DirectionalLight): Giả lập mặt trời
// Tăng cường độ lên 5.0 (vì đang dùng chế độ Physical)
const dirLight = new THREE.DirectionalLight(0xffffff, 3.0);
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
    const x = (1 - landmark.x) * ctx.canvas.width;
    const y = landmark.y * ctx.canvas.height;

    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "white";
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
                        child.geometry.computeBoundingBox();
                        const center = new THREE.Vector3();
                        child.geometry.boundingBox.getCenter(center);
                        child.geometry.translate(-center.x, -center.y, -center.z);

                        child.material = new THREE.MeshStandardMaterial({
                            color: 0xfff0e0,        // Màu trắng hơi hồng da (tự nhiên hơn trắng tinh)
                            side: THREE.DoubleSide,

                            // 1. CẤU HÌNH ĐỘ TRONG SUỐT ĐỤC (Milky)
                            transparent: true,      // Bắt buộc bật
                            opacity: 0.75,          // 0.0 là tàng hình, 1.0 là đục. 0.75 là vừa đẹp

                            // 2. ĐỘ BÓNG BỀ MẶT (GEL)
                            metalness: 0.0,
                            roughness: 0.3,         // Hơi nhám nhẹ để tạo độ lì của chất sừng bên trong

                            // 3. LỚP PHỦ BÓNG KÍNH BÊN NGOÀI (Clearcoat)
                            clearcoat: 1.0,         // Lớp sơn bóng phủ lên trên
                            clearcoatRoughness: 0.05, // Lớp phủ này láng mịn

                            // 4. HIỆU ỨNG PHẢN QUANG (Tùy chọn)
                            reflectivity: 0.5,      // Phản xạ ánh sáng vừa phải
                            ior: 1.45,              // Chỉ số khúc xạ của chất sừng/keratin

                            // Giúp móng sáng lên một chút trong bóng tối
                            emissive: 0xfff0e0,
                            emissiveIntensity: 0.1
                        });
                        if (id === 8) currentMaterial = child.material;
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
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
hands.onResults(onResults);

// Calibration Timer
setTimeout(() => {
    isCalibrating = false;
    calibrationMessageEl.textContent = 'Đã lấy mẫu! Bắt đầu theo dõi.';
    setTimeout(() => { calibrationMessageEl.style.opacity = 0; }, 2000);
}, 5000);

const webcam = new Camera(videoElement, {
    onFrame: async () => { await hands.send({ image: videoElement }); },
    width: 480, height: 480
});
webcam.start();

function toVector3(p) {
    return new THREE.Vector3(-(p.x - 0.5) * 2, -(p.y - 0.5) * 2, (p.z) * 2);
}

function getFingerDirection(landmarks, tipId, baseId) {
    const vTip = toVector3(landmarks[tipId]);
    const vBase = toVector3(landmarks[baseId]);
    return new THREE.Vector3().subVectors(vTip, vBase).normalize();
}

// =================================================================
// XỬ LÝ KẾT QUẢ (CẬP NHẬT OFFSET XY)
// =================================================================
function onResults(results) {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.save();
    canvasCtx.scale(-1, 1);
    canvasCtx.translate(-canvasElement.width, 0);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.restore();

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        // Vẽ điểm 2D
        drawPoint(canvasCtx, landmarks[0], 'blue', 'Cổ Tay');
        // drawPoint(canvasCtx, landmarks[4], 'yellow', 'Cái');
        // drawPoint(canvasCtx, landmarks[8], 'red', 'Trỏ');
        // drawPoint(canvasCtx, landmarks[12], 'purple', 'Giữa');
        // drawPoint(canvasCtx, landmarks[16], 'cyan', 'Áp Út');
        // drawPoint(canvasCtx, landmarks[20], 'pink', 'Út');

        // Tính Scale Factor
        const p5 = landmarks[5], p8 = landmarks[8];
        const dx = p8.x - p5.x, dy = p8.y - p5.y;
        const currentPixelSize = Math.sqrt(dx * dx + dy * dy);

        if (isCalibrating) {
            referenceFingerSize = currentPixelSize;
        } else {
            const targetFactor = currentPixelSize / referenceFingerSize;
            smoothedScaleFactor = (smoothedScaleFactor * 0.9) + (targetFactor * 0.1);
        }

        // Cập nhật từng ngón
        const defaultUp = new THREE.Vector3(0, 1, 0);

        fingerIds.forEach(id => {
            const obj = fingerObjs[id];
            if (obj && landmarks[id]) {
                const p = landmarks[id];
                const config = fingerSettings[id];

                let baseId = (id === 4) ? 3 : fingerBaseTips[id].mid;

                // 1. Hướng Ngón tay
                const fingerDirection = getFingerDirection(landmarks, id, baseId);

                // 2. Rotation
                const finalQuaternion = new THREE.Quaternion().setFromUnitVectors(defaultUp, fingerDirection);

                // 3. Tính toán OFFSET (Dịch chuyển cục bộ)
                const offX = config.offsetX || 0;
                const offY = config.offsetY || 0;
                const offZ = config.offsetZ !== undefined ? config.offsetZ : 0.2;

                const localOffset = new THREE.Vector3(offX, offY, offZ);
                localOffset.applyQuaternion(finalQuaternion); // Xoay offset theo hướng ngón tay

                // 4. Áp dụng
                const vTip = toVector3(p);
                const targetPos = vTip.clone().add(localOffset);

                obj.position.lerp(targetPos, smoothingFactor);
                obj.quaternion.slerp(finalQuaternion, smoothingFactor);

                const configScale = config ? config.scale : 1.0;
                const finalS = baseGlobalScale * smoothedScaleFactor * configScale;
                obj.scale.set(finalS, finalS, finalS);
            }
        });
    }
    renderer.render(scene, camera);
}

// =================================================================
// TEXTURE & UV
// =================================================================
const dropZone = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');

function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
function highlight() { dropZone.classList.add('highlight'); dropMessage.style.opacity = '1'; }
function unhighlight() { dropZone.classList.remove('highlight'); dropMessage.style.opacity = '0'; }
function handleDrop(e) { handleFiles(e.dataTransfer.files); }

function handleFiles(files) {
    if (files.length > 0 && files[0].type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => applyTextureToAll(e.target.result);
        reader.readAsDataURL(files[0]);
    }
}

// function applyTextureToAll(imageDataUrl) {
//     const textureLoader = new THREE.TextureLoader();
//     textureLoader.load(imageDataUrl, (texture) => {
//         texture.wrapS = THREE.RepeatWrapping;
//         texture.wrapT = THREE.RepeatWrapping;
//         fingerIds.forEach(id => {
//             const obj = fingerObjs[id];
//             if (obj) {
//                 obj.traverse((child) => {
//                     if (child.isMesh) {
//                         child.material = new THREE.MeshStandardMaterial({
//                             map: texture,
//                             side: THREE.DoubleSide,
//                             metalness: 0.1,
//                             roughness: 0.9
//                         });
//                         updateUVs(child.geometry, currentUVMapping);
//                     }
//                 });
//             }
//         });
//     });
// }


function applyTextureToAll(imageDataUrl) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(imageDataUrl, (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        // Giữ nguyên màu sắc gốc của ảnh texture
        texture.encoding = THREE.sRGBEncoding;

        fingerIds.forEach(id => {
            const obj = fingerObjs[id];
            if (obj) {
                obj.traverse((child) => {
                    if (child.isMesh) {
                        // Sử dụng MeshPhysicalMaterial để giữ độ bóng
                        child.material = new THREE.MeshPhysicalMaterial({
                            map: texture,             // Áp texture vào
                            color: 0xffffff,          // Màu nền trắng để texture chuẩn màu
                            side: THREE.DoubleSide,

                            metalness: 0.3,
                            roughness: 0.2,           // Tăng nhẹ roughness khi có hình để đỡ bị chói lóa mất hình

                            clearcoat: 1.0,           // Vẫn giữ lớp phủ bóng
                            clearcoatRoughness: 0.1,
                            reflectivity: 0.8
                        });
                        updateUVs(child.geometry, currentUVMapping);
                    }
                });
            }
        });
    });
}



['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => {
    dropZone.addEventListener(e, preventDefaults, false);
    document.body.addEventListener(e, preventDefaults, false);
});
['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, highlight, false));
['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, unhighlight, false));
dropZone.addEventListener('drop', handleDrop, false);
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

function changeUVMapping() {
    if (currentUVMapping === 'spherical') currentUVMapping = 'planar';
    else if (currentUVMapping === 'planar') currentUVMapping = 'cylindrical';
    else currentUVMapping = 'spherical';

    fingerIds.forEach(id => {
        const obj = fingerObjs[id];
        if (obj) {
            obj.traverse((child) => {
                if (child.isMesh) updateUVs(child.geometry, currentUVMapping);
            });
        }
    });
    console.log("UV Mapping changed to:", currentUVMapping);
}

function updateUVs(geometry, type) {
    if (!geometry.attributes.uv) {
        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox;
        const pos = geometry.attributes.position;
        const uvArray = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
            const u = (x - bbox.min.x) / (bbox.max.x - bbox.min.x);
            const v = (y - bbox.min.y) / (bbox.max.y - bbox.min.y);
            if (type === 'planar') { uvArray[i * 2] = u; uvArray[i * 2 + 1] = v; }
            else if (type === 'spherical') {
                const r = Math.sqrt(x * x + y * y + z * z);
                const phi = Math.atan2(y, x);
                const theta = Math.acos(z / r);
                uvArray[i * 2] = phi / (2 * Math.PI) + 0.5;
                uvArray[i * 2 + 1] = theta / Math.PI;
            } else if (type === 'cylindrical') {
                const phi = Math.atan2(z, x);
                uvArray[i * 2] = (phi / (2 * Math.PI)) + 0.5;
                uvArray[i * 2 + 1] = v;
            }
        }
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
    }
    geometry.attributes.uv.needsUpdate = true;
}

function resetTexture() {
    fingerIds.forEach(id => {
        const obj = fingerObjs[id];
        if (obj) {
            obj.traverse((child) => {
                if (child.isMesh) {
                    child.material = new THREE.MeshStandardMaterial({
                        color: 0xcccccc,
                        side: THREE.DoubleSide,
                        metalness: 0.2,
                        roughness: 0.8
                    });
                }
            });
        }
    });
}