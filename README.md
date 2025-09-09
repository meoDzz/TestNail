# Nail CAD - Hand Tracking với 3D STL và Texture

Một ứng dụng web sử dụng MediaPipe để theo dõi bàn tay và hiển thị mô hình 3D STL với khả năng áp dụng texture hoa văn.

## ✨ Tính năng

- 🖐️ **Hand Tracking**: Theo dõi bàn tay real-time sử dụng MediaPipe
- 🎯 **3D Object Tracking**: Gắn mô hình STL lên ngón tay index
- 🎨 **Texture Mapping**: Kéo thả ảnh để làm hoa văn cho mô hình 3D
- 🔄 **UV Mapping**: 3 loại UV mapping (Spherical, Planar, Cylindrical)
- 📱 **Responsive**: Hoạt động trên trình duyệt web

## 🚀 Cách sử dụng

### 1. Chạy local
```bash
# Clone repository
git clone <your-repo-url>
cd nail-cad

# Chạy server đơn giản
python -m http.server 8000

# Hoặc sử dụng Node.js
npx http-server -p 8000
```

### 2. Truy cập
Mở trình duyệt và truy cập: `http://localhost:8000`

### 3. Sử dụng
1. **Cho phép camera** khi được hỏi
2. **Đưa bàn tay vào khung hình** - mô hình STL sẽ theo dõi ngón tay index
3. **Kéo thả ảnh** vào vùng camera hoặc click "Chọn ảnh từ máy tính"
4. **Thay đổi UV Mapping** để tìm cách hiển thị phù hợp nhất

## 🛠️ Công nghệ sử dụng

- **Three.js**: Rendering 3D và xử lý STL files
- **MediaPipe**: Hand tracking và computer vision
- **HTML5 Canvas**: Xử lý video và 2D graphics
- **JavaScript ES6+**: Logic chính của ứng dụng

## 📁 Cấu trúc project

```
nail-cad/
├── index.html          # Giao diện chính
├── main.js            # Logic chính và xử lý 3D
├── style.css          # Styling
├── HoaVan.STL         # Mô hình 3D STL
├── images.jpg         # Ảnh mẫu
├── download.jpg       # Ảnh test
├── .gitignore         # Git ignore rules
└── README.md          # Documentation
```

## 🎮 Controls

- **Drag & Drop**: Kéo thả file ảnh (.jpg, .png) vào vùng camera
- **Button "Chọn ảnh từ máy tính"**: Chọn file ảnh từ máy tính
- **Button "Thay đổi UV Mapping"**: Chuyển đổi giữa 3 loại UV mapping
- **Button "Reset Texture"**: Quay về màu gốc

## 🔧 UV Mapping Types

1. **Spherical**: Phù hợp cho mô hình tròn, cầu
2. **Planar**: Phù hợp cho mô hình phẳng, có bề mặt rõ ràng  
3. **Cylindrical**: Phù hợp cho mô hình dài, hình trụ

## 📋 Yêu cầu hệ thống

- **Trình duyệt**: Chrome, Firefox, Edge, Safari (hỗ trợ WebGL)
- **Camera**: Webcam để tracking bàn tay
- **Kết nối**: Internet để tải MediaPipe models

## 🐛 Troubleshooting

### Camera không hoạt động
- Kiểm tra quyền truy cập camera trong trình duyệt
- Đảm bảo không có ứng dụng khác đang sử dụng camera

### Mô hình STL không hiển thị
- Kiểm tra file `HoaVan.STL` có trong thư mục
- Mở Console (F12) để xem lỗi

### Texture không hiển thị
- Thử các loại UV mapping khác nhau
- Đảm bảo file ảnh là .jpg hoặc .png
- Kiểm tra Console để xem log debug

## 📝 License

MIT License - Xem file LICENSE để biết thêm chi tiết.

## 🤝 Contributing

Mọi đóng góp đều được chào đón! Hãy tạo issue hoặc pull request.

## 📞 Liên hệ

Nếu có vấn đề hoặc câu hỏi, hãy tạo issue trên GitHub.
