// Lấy các phần tử HTML
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const dropArea = document.getElementById('drop-area');
const dropMessage = document.getElementById('drop-message');
const calibrationMessageEl = document.getElementById('drop-message'); // Dùng chung message element

// --- CÀI ĐẶT THREE.JS ---
let scene, camera, renderer, stlObject;
let currentMaterial; 
let lastPosition = new THREE.Vector3(); 
let smoothingFactor = 1; // <-- ĐÃ GIẢM TỪ 0.98 XUỐNG 0.2 ĐỂ PHẢN HỒI NHANH HƠN
let fingerCircle; 
let currentUVMapping = 'spherical'; 

// --- LOGIC CALIBRATION MỚI ---
let isCalibrating = true;
let referenceQuaternion = new THREE.Quaternion(); // <-- THAY THẾ CHO rotationOffset

// Tạo canvas riêng cho Three.js
const threeCanvas = document.createElement('canvas');
threeCanvas.width = 480;
threeCanvas.height = 480;
threeCanvas.style.position = 'absolute';
threeCanvas.style.top = '0';
threeCanvas.style.left = '0';
threeCanvas.style.pointerEvents = 'none';
document.getElementById('drop-area').appendChild(threeCanvas);

// 1. Khởi tạo Scene
scene = new THREE.Scene();

// 2. Khởi tạo Camera
camera = new THREE.PerspectiveCamera(70, 480/480, 0.1, 1000);
camera.position.z = 1.5; 

// 3. Khởi tạo Renderer
renderer = new THREE.WebGLRenderer({
    canvas: threeCanvas,
    alpha: true 
});
renderer.setSize(threeCanvas.width, threeCanvas.height);
renderer.setClearColor(0x000000, 0); 

// 4. Thêm ánh sáng
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(0, 1, 1);
scene.add(directionalLight);
const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight2.position.set(-1, 0, 1);
scene.add(directionalLight2);

// 5. Tải file GLB (ĐÃ THÊM AXESHELPER)
function loadGLBModel(modelPath = 'HoaVan.glb') {
    if (stlObject) {
        scene.remove(stlObject);
    }
    const loader = new THREE.GLTFLoader();
    loader.load(
        modelPath,
        (gltf) => {
            stlObject = gltf.scene; 
            stlObject.traverse((child) => {
                if (child.isMesh) {
                    child.geometry.computeBoundingBox();
                    const center = new THREE.Vector3();
                    child.geometry.boundingBox.getCenter(center);
                    child.geometry.translate(-center.x, -center.y, -center.z);
                    child.material = new THREE.MeshStandardMaterial({ 
                        color: 0xcccccc, 
                        side: THREE.DoubleSide,
                        metalness: 0.2, 
                        roughness: 0.8  
                    });
                    currentMaterial = child.material;
                }
            });
            stlObject.scale.set(0.01, 0.01, 0.01); 
            
            scene.add(stlObject);
            console.log('Mô hình GLB đã được tải thành công!');

            // ✅ CODE MỚI ĐỂ HIỂN THỊ TRỤC TỌA ĐỘ
            // Tạo một bộ trục (X=Đỏ, Y=Xanh lá, Z=Xanh dương)
            // Số 2 là "kích thước" (scale) của trục, bạn có thể tăng/giảm nếu nó quá to/nhỏ
            const axesHelper = new THREE.AxesHelper( 2 ); 
            // Gắn bộ trục vào vật thể (để nó xoay cùng vật thể)
            stlObject.add( axesHelper );
            // ✅ KẾT THÚC CODE MỚI

        },
        (xhr) => {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        (error) => {
            console.error('Lỗi khi tải mô hình GLB:', error);
            alert('Lỗi khi tải mô hình GLB.');
        }
    );
}
loadGLBModel('HoaVan.glb'); 

// --- CÀI ĐẶT MEDIAPIPE HANDS ---
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});
hands.setOptions({
    maxNumHands: 1, 
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
hands.onResults(onResults);

// --- BẮT ĐẦU CALIBRATION VÀ WEBCAM ---
// Hiển thị thông báo calibration
calibrationMessageEl.textContent = 'Giữ yên bàn tay trong 5 giây để lấy mẫu...';
calibrationMessageEl.style.opacity = 1;
calibrationMessageEl.style.color = 'white'; // Đảm bảo màu chữ là trắng

// Đặt hẹn giờ để kết thúc calibration
setTimeout(() => {
    isCalibrating = false;
    calibrationMessageEl.textContent = 'Đã lấy mẫu! Bắt đầu theo dõi.';
    console.log('Reference Quaternion đã được chốt:', referenceQuaternion);
    // Ẩn thông báo sau 2 giây
    setTimeout(() => {
        calibrationMessageEl.style.opacity = 0; 
    }, 2000);
}, 5000); // 5 giây


// Khởi tạo camera webcam
const webcam = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 480,
    height: 480
});
webcam.start();

// =================================================================
// HÀM ONRESULTS (Giữ nguyên logic cũ của bạn để gỡ rối)
// =================================================================
function onResults(results) {
    // 1. Xóa canvas 2D cũ
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // 2. Vẽ video frame lên canvas 2D (hiệu ứng gương)
    canvasCtx.save();
    canvasCtx.scale(-1, 1);
    canvasCtx.translate(-canvasElement.width, 0);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.restore();

    // 3. Xử lý logic 3D nếu phát hiện bàn tay
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        // Lấy các điểm mốc cần thiết
        const p0 = landmarks[0];  // Cổ tay (Wrist)
        const p5 = landmarks[5];  // Gốc ngón trỏ (Index MCP)
        const p8 = landmarks[8];  // Đầu ngón trỏ (Index TIP)
        const p9 = landmarks[9];  // Gốc ngón giữa
        const p17 = landmarks[17]; // Gốc ngón út (Pinky MCP)

        // Chuyển đổi tọa độ MediaPipe (0-1) sang tọa độ 3D của Three.js
        // Lật X và Y để khớp với camera
        const v0 = new THREE.Vector3(-(p0.x - 0.5) * 2, -(p0.y - 0.5) * 2, (p0.z) * 2);
        const v5 = new THREE.Vector3(-(p5.x - 0.5) * 2, -(p5.y - 0.5) * 2, (p5.z) * 2);
        const v8 = new THREE.Vector3(-(p8.x - 0.5) * 2, -(p8.y - 0.5) * 2, (p8.z) * 2);
        const v9 = new THREE.Vector3(-(p9.x - 0.5) * 2, -(p9.y - 0.5) * 2, (p9.z) * 2);
        const v17 = new THREE.Vector3(-(p17.x - 0.5) * 2, -(p17.y - 0.5) * 2, (p17.z) * 2);


        // --- CẬP NHẬT VỊ TRÍ VẬT THỂ ---
        if (stlObject) {
            // 1. Cập nhật vị trí - dính vào đầu ngón trỏ (v8)
            const targetPosition = v8.clone().add(new THREE.Vector3(0, 0, 0.2)); 
            stlObject.position.lerp(targetPosition, smoothingFactor);

            // --- CẬP NHẬT XOAY ---
            
            // 2. Tính toán các vector cơ sở (basis vectors)
            
            // Trục Y (Lên) của vật thể = Hướng của ngón tay
            const yAxis = new THREE.Vector3().subVectors(v8, v5).normalize();

            // Trục Z (Tới) của vật thể = Pháp tuyến của lòng bàn tay
            const vecA = new THREE.Vector3().subVectors(v5, v0);
            const vecB = new THREE.Vector3().subVectors(v17, v0);
            const zAxis = new THREE.Vector3().crossVectors(vecA, vecB).normalize();

            // Đảm bảo trục Z luôn hướng ra khỏi lòng bàn tay (hướng về camera)
            const wristToMiddleFinger = new THREE.Vector3().subVectors(v9, v0);
            if (zAxis.dot(wristToMiddleFinger) < 0) {
                zAxis.negate(); // Đảo ngược nếu nó đang hướng vào trong
            }

            // Trục X (Ngang) = Trục Y cross Trục Z
            const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();

            // Cần chuẩn hóa lại zAxis sau khi tính xAxis để đảm bảo trực giao hoàn toàn
            zAxis.crossVectors(xAxis, yAxis).normalize();


            // 3. Tạo ma trận xoay từ các vector cơ sở đã chuẩn hóa
            // Map Trục X vật thể (chiều dài) -> yAxis (hướng dọc ngón tay)
            // Map Trục Y vật thể (chiều cao) -> zAxis (hướng pháp tuyến)
            // Map Trục Z vật thể (chiều sâu) -> xAxis (hướng ngang ngón tay)
            const rotationMatrix = new THREE.Matrix4().makeBasis(yAxis, zAxis, xAxis); // <-- Đây là logic cũ của bạn
            
            const currentTargetQuaternion = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);

            // 4. Xử lý Calibration và Tracking
            if (isCalibrating) {
                // Nếu đang trong 5 giây đầu, liên tục cập nhật tư thế tham chiếu
                referenceQuaternion.copy(currentTargetQuaternion);
            } else {
                // Đã qua 5 giây, bắt đầu xoay tương đối
                const deltaRotation = new THREE.Quaternion().multiplyQuaternions(
                    currentTargetQuaternion, 
                    referenceQuaternion.clone().invert()
                );

                // Áp dụng góc xoay
                stlObject.quaternion.slerp(deltaRotation, smoothingFactor);
            }
        }
    }

    // 5. Kết xuất cảnh 3D
    renderer.render(scene, camera);
}


// --- XỬ LÝ KÉO THẢ (DRAG & DROP) ---
// (Các hàm này được lấy từ file README.md và các hàm Three.js chuẩn)

const dropZone = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');

// Ngăn chặn hành vi mặc định
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Làm nổi vùng thả
function highlight(e) {
    dropZone.classList.add('highlight');
    dropMessage.style.opacity = '1';
}

// Bỏ làm nổi vùng thả
function unhighlight(e) {
    dropZone.classList.remove('highlight');
    dropMessage.style.opacity = '0';
}

// Xử lý file được thả
function handleDrop(e) {
    let dt = e.dataTransfer;
    let files = dt.files;
    handleFiles(files);
}

// Xử lý file (từ kéo thả hoặc input)
function handleFiles(files) {
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                applyTextureToSTL(e.target.result);
            };
            reader.readAsDataURL(file);
        } else {
            alert("Chỉ chấp nhận file ảnh (.jpg, .png)");
        }
    }
}

// Áp dụng texture cho mô hình STL
function applyTextureToSTL(imageDataUrl) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(imageDataUrl, (texture) => {
        // Cần lặp lại texture nếu UV mapping yêu cầu
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        if (stlObject) {
            stlObject.traverse((child) => {
                if (child.isMesh) {
                    // Tạo vật liệu mới với texture
                    child.material = new THREE.MeshStandardMaterial({ 
                        map: texture,
                        side: THREE.DoubleSide,
                        metalness: 0.1,
                        roughness: 0.9
                    });
                    currentMaterial = child.material;
                    // Cập nhật UV mapping ngay lập tức
                    updateUVs(child.geometry, currentUVMapping);
                }
            });
        }
    });
}

// Xử lý các sự kiện kéo thả
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false); // Cho toàn trang
});
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
});
['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
});
dropZone.addEventListener('drop', handleDrop, false);

// Xử lý chọn file
fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

// --- CÁC HÀM ĐIỀU KHIỂN (BUTTONS) ---

// Thay đổi UV Mapping
function changeUVMapping() {
    if (currentUVMapping === 'spherical') {
        currentUVMapping = 'planar';
    } else if (currentUVMapping === 'planar') {
        currentUVMapping = 'cylindrical';
    } else {
        currentUVMapping = 'spherical';
    }
    
    if (stlObject) {
        stlObject.traverse((child) => {
            if (child.isMesh) {
                updateUVs(child.geometry, currentUVMapping);
            }
        });
    }
    console.log("UV Mapping changed to:", currentUVMapping);
}

// Cập nhật UVs
function updateUVs(geometry, type) {
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;
    const position = geometry.attributes.position;
    const uvArray = new Float32Array(position.count * 2);

    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const y = position.getY(i);
        const z = position.getZ(i);
        
        // Chuẩn hóa tọa độ về (0, 1)
        const u = (x - bbox.min.x) / (bbox.max.x - bbox.min.x);
        const v = (y - bbox.min.y) / (bbox.max.y - bbox.min.y);
        const w = (z - bbox.min.z) / (bbox.max.z - bbox.min.z);

        if (type === 'planar') {
            // Chiếu phẳng lên mặt XY
            uvArray[i * 2] = u;
            uvArray[i * 2 + 1] = v;
        } else if (type === 'spherical') {
            // Chiếu hình cầu
            const r = Math.sqrt(x*x + y*y + z*z);
            const phi = Math.atan2(y, x);
            const theta = Math.acos(z / r);
            
            uvArray[i * 2] = phi / (2 * Math.PI) + 0.5;
            uvArray[i * 2 + 1] = theta / Math.PI;
        } else if (type === 'cylindrical') {
            // Chiếu hình trụ (quanh trục Y)
            const phi = Math.atan2(z, x);
            
            uvArray[i * 2] = (phi / (2 * Math.PI)) + 0.5;
            uvArray[i * 2 + 1] = v; // v (chiều cao)
        }
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
    geometry.attributes.uv.needsUpdate = true;
}

// Reset Texture
function resetTexture() {
    if (stlObject) {
        stlObject.traverse((child) => {
            if (child.isMesh) {
                // Trả về vật liệu màu xám ban đầu
                child.material = new THREE.MeshStandardMaterial({ 
                    color: 0xcccccc, 
                    side: THREE.DoubleSide,
                    metalness: 0.2, 
                    roughness: 0.8  
                });
                currentMaterial = child.material;
            }
        });
    }
}