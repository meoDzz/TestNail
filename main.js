// Lấy các phần tử HTML
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const dropArea = document.getElementById('drop-area');
const dropMessage = document.getElementById('drop-message');

// --- CÀI ĐẶT THREE.JS ---
let scene, camera, renderer, stlObject;
let currentMaterial; // Để lưu trữ material hiện tại của stlObject
let lastPosition = new THREE.Vector3(); // Để làm mượt chuyển động
let smoothingFactor = 0.1; // Hệ số làm mượt (0-1, càng nhỏ càng mượt)
let fingerCircle; // Vòng tròn tại đầu ngón tay
let currentUVMapping = 'spherical'; // Loại UV mapping hiện tại

// Tạo canvas riêng cho Three.js
const threeCanvas = document.createElement('canvas');
threeCanvas.width = 640;
threeCanvas.height = 480;
threeCanvas.style.position = 'absolute';
threeCanvas.style.top = '0';
threeCanvas.style.left = '0';
threeCanvas.style.pointerEvents = 'none';
document.getElementById('drop-area').appendChild(threeCanvas);

// 1. Khởi tạo Scene (Không gian 3D)
scene = new THREE.Scene();

// 2. Khởi tạo Camera (Góc nhìn)
camera = new THREE.PerspectiveCamera(75, threeCanvas.width / threeCanvas.height, 0.1, 1000);
camera.position.z = 1.5; // Đặt camera lùi lại một chút

// 3. Khởi tạo Renderer (Công cụ kết xuất)
renderer = new THREE.WebGLRenderer({
    canvas: threeCanvas,
    alpha: true // Cho phép nền trong suốt để thấy video
});
renderer.setSize(threeCanvas.width, threeCanvas.height);
renderer.setClearColor(0x000000, 0); // Nền trong suốt

// 4. Thêm ánh sáng
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Tăng cường độ ambient light
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Tăng cường độ directional light
directionalLight.position.set(0, 1, 1);
scene.add(directionalLight);

// Thêm thêm một directional light từ phía khác
const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight2.position.set(-1, 0, 1);
scene.add(directionalLight2);

// 5. Tải file STL
const loader = new THREE.STLLoader();
loader.load('HoaVan.STL', (geometry) => { // <-- THAY TÊN FILE CỦA BẠN VÀO ĐÂY
    currentMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ff00, // Màu xanh lá mặc định
        metalness: 0.1,
        roughness: 0.9,
        side: THREE.DoubleSide // Hiển thị cả hai mặt
    });
    stlObject = new THREE.Mesh(geometry, currentMaterial);

    // Tính toán hộp giới hạn để tìm tâm
    geometry.computeBoundingBox();
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    // Di chuyển hình học để tâm của nó nằm ở gốc tọa độ (0,0,0)
    geometry.center();
    
    // Tạo UV mapping cho STL (quan trọng!)
    geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    geometry.boundingBox.getSize(size);
    
    const uvAttribute = geometry.attributes.uv;
    if (!uvAttribute) {
        // Tạo UV coordinates dựa trên vị trí vertices với nhiều phương pháp
        const uvArray = new Float32Array(geometry.attributes.position.count * 2);
        const positions = geometry.attributes.position.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const y = positions[i + 1];
            const z = positions[i + 2];
            
            // Sử dụng spherical mapping để texture hiển thị tốt hơn
            const radius = Math.sqrt(x*x + y*y + z*z);
            if (radius > 0) {
                // Spherical coordinates
                const u = 0.5 + Math.atan2(z, x) / (2 * Math.PI);
                const v = 0.5 - Math.asin(y / radius) / Math.PI;
                
                uvArray[(i / 3) * 2] = u;
                uvArray[(i / 3) * 2 + 1] = v;
            } else {
                // Fallback cho trường hợp radius = 0
                uvArray[(i / 3) * 2] = 0.5;
                uvArray[(i / 3) * 2 + 1] = 0.5;
            }
        }
        
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
        console.log('Spherical UV mapping created for STL');
    }

    // Điều chỉnh kích thước và vị trí ban đầu
    stlObject.scale.set(0.012, 0.012, 0.012); // Tăng kích thước gấp 4 lần (0.003 * 4 = 0.012)
    stlObject.rotation.x = -Math.PI / 2; // Xoay cho phù hợp với hướng ngón tay

    scene.add(stlObject);
    
    // Tạo vòng tròn tại đầu ngón tay
    createFingerCircle();
    
    // Test texture đơn giản
    testTexture();
    
    console.log('STL file loaded successfully');
}, undefined, (error) => {
    console.error('Error loading STL file:', error);
    alert('Không thể tải file STL. Vui lòng kiểm tra đường dẫn file.');
});

// --- CÀI ĐẶT MEDIAPIPE HANDS ---
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 1, // Theo dõi tối đa 1 bàn tay
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// Xử lý kết quả từ MediaPipe
hands.onResults(onResults);

// Khởi tạo camera webcam
const webcam = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480
});
webcam.start();

// Hàm tạo vòng tròn tại đầu ngón tay
function createFingerCircle() {
    const circleGeometry = new THREE.RingGeometry(0.02, 0.03, 32);
    const circleMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff0000, // Màu đỏ
        transparent: true,
        opacity: 0.8
    });
    fingerCircle = new THREE.Mesh(circleGeometry, circleMaterial);
    fingerCircle.rotation.x = -Math.PI / 2; // Nằm ngang
    scene.add(fingerCircle);
}

// Hàm test texture đơn giản
function testTexture() {
    // Tạo texture đơn giản bằng code
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Vẽ pattern đơn giản
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(128, 0, 128, 128);
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(0, 128, 128, 128);
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(128, 128, 128, 128);
    
    // Tạo texture từ canvas
    const testTexture = new THREE.CanvasTexture(canvas);
    testTexture.wrapS = THREE.RepeatWrapping;
    testTexture.wrapT = THREE.RepeatWrapping;
    testTexture.flipY = false;
    
    // Áp dụng texture test
    setTimeout(() => {
        if (stlObject) {
            const testMaterial = new THREE.MeshBasicMaterial({
                map: testTexture,
                color: 0xffffff,
                side: THREE.DoubleSide
            });
            stlObject.material = testMaterial;
            currentMaterial = testMaterial;
            console.log('Test texture applied with MeshBasicMaterial');
        }
    }, 1000); // Đợi 1 giây để đảm bảo STL đã load xong
}

// Hàm thay đổi UV mapping
function changeUVMapping() {
    if (!stlObject) {
        alert('Mô hình STL chưa được tải!');
        return;
    }
    
    const geometry = stlObject.geometry;
    const positions = geometry.attributes.position.array;
    const uvArray = new Float32Array(positions.length / 3 * 2);
    
    // Thay đổi loại UV mapping
    if (currentUVMapping === 'spherical') {
        currentUVMapping = 'planar';
        console.log('Switching to planar UV mapping');
        
        // Planar mapping (phẳng)
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const y = positions[i + 1];
            const z = positions[i + 2];
            
            // Sử dụng X và Y coordinates
            const u = (x - geometry.boundingBox.min.x) / (geometry.boundingBox.max.x - geometry.boundingBox.min.x);
            const v = (y - geometry.boundingBox.min.y) / (geometry.boundingBox.max.y - geometry.boundingBox.min.y);
            
            uvArray[(i / 3) * 2] = u;
            uvArray[(i / 3) * 2 + 1] = v;
        }
    } else if (currentUVMapping === 'planar') {
        currentUVMapping = 'cylindrical';
        console.log('Switching to cylindrical UV mapping');
        
        // Cylindrical mapping (hình trụ)
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const y = positions[i + 1];
            const z = positions[i + 2];
            
            const u = 0.5 + Math.atan2(z, x) / (2 * Math.PI);
            const v = (y - geometry.boundingBox.min.y) / (geometry.boundingBox.max.y - geometry.boundingBox.min.y);
            
            uvArray[(i / 3) * 2] = u;
            uvArray[(i / 3) * 2 + 1] = v;
        }
    } else {
        currentUVMapping = 'spherical';
        console.log('Switching to spherical UV mapping');
        
        // Spherical mapping (hình cầu)
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const y = positions[i + 1];
            const z = positions[i + 2];
            
            const radius = Math.sqrt(x*x + y*y + z*z);
            if (radius > 0) {
                const u = 0.5 + Math.atan2(z, x) / (2 * Math.PI);
                const v = 0.5 - Math.asin(y / radius) / Math.PI;
                
                uvArray[(i / 3) * 2] = u;
                uvArray[(i / 3) * 2 + 1] = v;
            } else {
                uvArray[(i / 3) * 2] = 0.5;
                uvArray[(i / 3) * 2 + 1] = 0.5;
            }
        }
    }
    
    // Cập nhật UV coordinates
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
    
    // Áp dụng lại texture hiện tại nếu có
    if (currentMaterial && currentMaterial.map) {
        console.log('Reapplying texture with new UV mapping');
        // Force material update
        currentMaterial.needsUpdate = true;
    }
    
    alert(`Đã chuyển sang UV mapping: ${currentUVMapping}`);
}

// Hàm reset texture về màu gốc
function resetTexture() {
    if (!stlObject) {
        alert('Mô hình STL chưa được tải!');
        return;
    }
    
    const defaultMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00, // Màu xanh lá mặc định
        side: THREE.DoubleSide
    });
    
    stlObject.material = defaultMaterial;
    currentMaterial = defaultMaterial;
    
    console.log('Texture reset to default color');
    alert('Đã reset texture về màu gốc');
}

function onResults(results) {
    // Xóa canvas 2D cũ
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Lật ảnh ngang để hiển thị như gương
    canvasCtx.save();
    canvasCtx.scale(-1, 1);
    canvasCtx.translate(-canvasElement.width, 0);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.restore();

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        // Lấy tọa độ các điểm mốc của ngón trỏ
        // Điểm 5: Gốc ngón trỏ (MCP)
        // Điểm 8: Đỉnh ngón trỏ (TIP)
        // Điểm 6: Khớp PIP (giữa ngón tay)
        const indexFingerMCP = landmarks[5];
        const indexFingerPIP = landmarks[6];
        const indexFingerTIP = landmarks[8];

        // Vẽ vòng tròn tại đầu ngón tay trên canvas 2D
        canvasCtx.save();
        canvasCtx.scale(-1, 1);
        canvasCtx.translate(-canvasElement.width, 0);
        
        // Vẽ vòng tròn đỏ tại đầu ngón tay
        canvasCtx.beginPath();
        canvasCtx.arc(
            indexFingerTIP.x * canvasElement.width, 
            indexFingerTIP.y * canvasElement.height, 
            15, // Bán kính vòng tròn
            0, 
            2 * Math.PI
        );
        canvasCtx.strokeStyle = '#ff0000';
        canvasCtx.lineWidth = 3;
        canvasCtx.stroke();
        canvasCtx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        canvasCtx.fill();
        
        canvasCtx.restore();

        // --- CẬP NHẬT VỊ TRÍ VÀ HƯỚNG CỦA MÔ HÌNH STL ---
        if (stlObject) {
            // 1. Cập nhật vị trí - dính vào đỉnh ngón tay
            // Tọa độ từ MediaPipe là (0, 1), cần chuyển đổi sang không gian 3D của Three.js
            const targetPosition = new THREE.Vector3(
                (indexFingerTIP.x - 0.5) * 2, // Chuyển x về (-1, 1)
                -(indexFingerTIP.y - 0.5) * 2, // Chuyển y về (-1, 1) và đảo ngược
                (indexFingerTIP.z) * 2 + 0.2 // Tăng offset để vật thể không bị che khuất
            );
            
            // Làm mượt chuyển động bằng cách interpolate
            stlObject.position.lerp(targetPosition, smoothingFactor);

            // 2. Cập nhật hướng - làm cho mô hình song song với ngón tay
            // Tạo vector chỉ hướng từ khớp PIP đến đỉnh ngón tay (chính xác hơn)
            const direction = new THREE.Vector3();
            direction.set(
                indexFingerTIP.x - indexFingerPIP.x,
                indexFingerTIP.y - indexFingerPIP.y,
                indexFingerTIP.z - indexFingerPIP.z
            ).normalize();

            // Sử dụng ma trận lookAt để xoay đối tượng theo hướng ngón tay
            const lookAtTarget = new THREE.Vector3().addVectors(stlObject.position, direction);
            stlObject.lookAt(lookAtTarget);
            
            // Điều chỉnh xoay để mô hình hiển thị đúng hướng và dính chặt vào ngón tay
            stlObject.rotateX(-Math.PI / 2);
            stlObject.rotateZ(Math.PI / 6); // Xoay để mô hình hiển thị đẹp hơn
            
            // Lưu vị trí hiện tại để làm mượt lần sau
            lastPosition.copy(stlObject.position);
        }

        // Cập nhật vị trí vòng tròn 3D (nếu có)
        if (fingerCircle) {
            const circlePosition = new THREE.Vector3(
                (indexFingerTIP.x - 0.5) * 2,
                -(indexFingerTIP.y - 0.5) * 2,
                (indexFingerTIP.z) * 2 + 0.15
            );
            fingerCircle.position.copy(circlePosition);
        }
    }

    // Kết xuất cảnh 3D
    renderer.render(scene, camera);
}


// --- XỬ LÝ KÉO THẢ (DRAG & DROP) ---

// Ngăn chặn hành vi mặc định của trình duyệt khi kéo thả
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Thêm/Xóa highlight khi kéo file vào/ra
['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
});

function highlight(e) {
    dropArea.classList.add('highlight');
}

function unhighlight(e) {
    dropArea.classList.remove('highlight');
}

// Xử lý khi file được thả
dropArea.addEventListener('drop', handleDrop, false);

// Xử lý khi chọn file từ button
const fileInput = document.getElementById('file-input');
fileInput.addEventListener('change', function(e) {
    console.log('File input changed');
    const files = e.target.files;
    if (files && files.length > 0) {
        handleFiles(files);
    }
});

function handleDrop(e) {
    console.log('Drop event triggered');
    let dt = e.dataTransfer;
    let files = dt.files;
    
    console.log('DataTransfer files:', files);
    console.log('DataTransfer items:', dt.items);

    // Thử xử lý bằng DataTransferItemList nếu files rỗng
    if (files.length === 0 && dt.items && dt.items.length > 0) {
        console.log('Using DataTransferItemList');
        const item = dt.items[0];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            const file = item.getAsFile();
            console.log('File from DataTransferItem:', file);
            handleFiles([file]);
            return;
        }
    }

    handleFiles(files);
}

function handleFiles(files) {
    console.log('Files dropped:', files);
    if (!files || files.length === 0) {
        console.log('No files found');
        return;
    }

    const file = files[0];
    console.log('File info:', {
        name: file.name,
        type: file.type,
        size: file.size
    });
    
    if (!file.type.startsWith('image/')) {
        alert('Vui lòng kéo thả một file ảnh (jpg, png)! File hiện tại: ' + file.type);
        return;
    }

    console.log('Loading image file...');
    const reader = new FileReader();
    reader.onload = function(e) {
        const imageUrl = e.target.result;
        console.log('Image loaded successfully, applying texture...');
        applyTextureToSTL(imageUrl);
    };
    reader.onerror = function(e) {
        console.error('Error reading file:', e);
        alert('Lỗi khi đọc file ảnh!');
    };
    reader.readAsDataURL(file); // Đọc file dưới dạng URL dữ liệu
}

// Hàm áp dụng texture vào mô hình STL
function applyTextureToSTL(imageUrl) {
    console.log('applyTextureToSTL called with:', imageUrl.substring(0, 50) + '...');
    
    if (!stlObject) {
        console.warn("Mô hình STL chưa được tải. Không thể áp dụng texture.");
        alert('Mô hình STL chưa được tải. Vui lòng đợi một chút và thử lại.');
        return;
    }

    console.log('STL object found, loading texture...');
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(imageUrl, (texture) => {
        console.log('Texture loaded successfully:', texture);
        
        // Cập nhật material của stlObject
        // Nếu đã có texture cũ, giải phóng nó để tránh rò rỉ bộ nhớ
        if (currentMaterial.map) {
            currentMaterial.map.dispose();
        }
        
        // Cấu hình texture
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2); // Lặp lại texture 2x2 để dễ nhìn thấy
        texture.flipY = false; // Quan trọng: không lật texture
        
        // Tạo material mới - thử MeshBasicMaterial trước (không cần lighting)
        const newMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            color: 0xffffff, // Màu trắng để texture hiển thị rõ
            side: THREE.DoubleSide
        });
        
        console.log('Using MeshBasicMaterial for better texture visibility');
        
        // Thay thế material cũ
        stlObject.material = newMaterial;
        currentMaterial = newMaterial; // Cập nhật reference
        
        console.log('Texture applied successfully!');
        alert('Hoa văn đã được áp dụng thành công!');
    }, undefined, (err) => {
        console.error('Lỗi khi tải texture:', err);
        alert('Không thể tải ảnh làm texture. Vui lòng thử lại với ảnh khác.\nLỗi: ' + err.message);
    });
}