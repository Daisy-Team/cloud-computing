from flask import Flask, request, jsonify
import tensorflow as tf
import numpy as np
from PIL import Image
import uuid
from datetime import datetime
from werkzeug.utils import secure_filename
import io
import os
import firebase_admin
from firebase_admin import credentials, firestore

# Path ke file kredensial akun layanan
cred = credentials.Certificate("firestore-key.json")
firebase_admin.initialize_app(cred)

db = firestore.client()

app = Flask(__name__)

'''
News
1. Sudah bisa running, jalankan perintah `python app.py`
2. Konfigurasi postman
  a. Script test postman
    `pm.test("Response status is 201", function () {
        pm.response.to.have.status(201);
    });

    pm.test("Response time is less than 2 seconds", function () {
        pm.expect(pm.response.responseTime).to.be.below(2000);
    });

    pm.test("Response contains diagnosis", function () {
        var jsonData = pm.response.json();
        pm.expect(jsonData).to.have.property('treatment');
        pm.expect(jsonData).to.have.property('medicine');
    });
    `
  b. bagian body pilih tambahkan nilai key dengan nama image dan tipenya file, kemudian masukkan gambar
  c. host: http://127.0.0.1:5000 & endpoint /predict
3. 
Todo
1. Sesuaikan classes dengan index yang merupakan output dari tim ML (done)
2. Periksa response dari postman untuk bagian rekomendasi obat (done)
3. Tolong koneksikan dengan firestore (done)
4. [Opsional] Ubah classes menjadi index bases (menggunakan angka layaknya output dari tim ML)
'''

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

classes = [
  "Biduran",
  "Bisul",
  "Cacar Air",
  "Jerawat",
  "Kurap",
  "Normal",
  "Panu",
]

info = {
  "Biduran": {
    "treatment": "Hindari alergen yang memicu biduran dan gunakan pakaian berbahan lembut.",
    "medicine": [
      {
        "obat": "Chlorphenamine Maleate (Kapsul)",
        "cara_pakai": "Minum 1 kapsul 1-2 kali sehari setelah makan sesuai dosis yang dianjurkan",
        "gambar": "https://drive.google.com/uc?id=1D_t0DCodAI62puqGi1f61CBSJlQWvhf4",
      },
      {
        "obat": "Cetirizine tablet",
        "cara_pakai": "Dewasa: 10mg sekali sehari, Anak: 2,5-5mg dua kali sehari. Dilarang memakai untuk anak dibawah 2 tahun",
        "gambar": "https://drive.google.com/uc?id=1Ckatcrsj_m685lP8blH4l7dc9YjHAPX3",
      },
    ]
  },
  "Bisul": {
    "treatment": "Kompres dengan kain bersih yang sudah direndam air hangat, hindari memecahkan bisul secara paksa.",
    "medicine": [
      {
        "obat": "Salep Hitam Ichtyol",
        "cara_pakai": "Oleskan 1-3 kali sehari pada kulit yang terkena bisul",
        "gambar": "https://drive.google.com/uc?id=1rcIo3VyabQ9M4SQjRAw97cEEUxPYAKws",
      },
      {
        "obat": "Acid Salicyl & Sulfur (Salep)",
        "cara_pakai": "Oleskan salep tipis pada area kulit yang terinfeksi 1-2 kali sehari setelah dibersihkan",
        "gambar": "https://drive.google.com/uc?id=13HO9qM7LEfrw_9wNnKSDHWFV_cT2dzi4",
      },
    ]
  },
  "Cacar Air": {
    "treatment": "Kompres dingin untuk meredakan gatal dan hindari menggaruk lesi kulit.",
    "medicine": [
      {
        "obat": "Calamine (Bedak/Lotion)",
        "cara_pakai": "Oleskan tipis pada area kulit yang teriritasi 2-3 kali sehari",
        "gambar": "https://drive.google.com/uc?id=1RWEzr-9Qw9BxKf7LuUrhq-6vWh5LGEpz",
      },
      {
        "obat": "Acid Salicyl (Bedak)",
        "cara_pakai": "Taburkan tipis pada area kulit yang terinfeksi 1-2 kali sehari",
        "gambar": "https://drive.google.com/uc?id=1qFBU1Cg8bMj8Mc0ESFQbK9OEFQMj4xtO",
      },
    ]
  },
  "Jerawat": {
    "treatment": "Cuci wajah dengan sabun ringan 2x sehari dan hindari penggunaan produk berminyak.",
    "medicine": [
      {
        "obat": "Vitamin E (Kapsul)",
        "cara_pakai": "Konsumsi 1 kapsul per hari setelah makan",
        "gambar": "https://drive.google.com/uc?id=1n7f4dEjU_tX9wgVvOiHZzH6A3ITnhY2V",
      },
      {
        "obat": "Benzoyl Peroxide",
        "cara_pakai": "Oleskan tipis 1-2 kali sehari pada area yang berjerawat.",
        "gambar": "https://drive.google.com/uc?id=1Ct76LfduWG3kQo2AfNsiPV4HPIE0ZGum",
      },
    ]
  },
  "Kurap": {
    "treatment": "Hindari pakaian ketat dan jaga area yang terinfeksi tetap kering.",
    "medicine": [
      {
        "obat": "Tolnaftate Cream",
        "cara_pakai": "Oleskan tipis-tipis pada area kulit yang terinfeksi 2× sehari setelah dibersihkan dan dikeringkan",
        "gambar": "https://drive.google.com/uc?id=1Ds4-fUp9FcW-GeBuh94TYmrhebRXmbtY",
      },
      {
        "obat": "Econazole Nitrate Cream 1%",
        "cara_pakai": "Oleskan tipis-tipis pada area kulit yang terinfeksi 1-2× sehari setelah kulit dibersihkan dan dikeringkan",
        "gambar": "https://drive.google.com/uc?id=1MLXPK9178VX1mhQI34qcSCucSb__PEws",
      },
    ]
  },
  "Normal": {
    "treatment" : "Kulit Anda dalam kondisi sehat. Jaga kebersihan kulit dengan rutin mandi dan gunakan pelembap yang sesuai dengan jenis kulit Anda.",
    "medicine": [
      {
        "asd"
      }
    ]
  },
  "Panu": {
    "treatment": "Jaga kulit tetap kering dan hindari berbagi handuk dengan orang lain.",
    "medicine": [
      {
        "obat": "Miconazole Cream 2% / Miconazole Nitrate 2%",
        "cara_pakai": "Oleskan 1-2 kali sehari setelah membersihkan dan mengeringkan kulit",
        "gambar": "https://drive.google.com/uc?id=17JnAFKQpoAsinfQiHZVrIxTlR52HVJ77",
      },
      {
        "obat": "Selenium Sulfida Lotion",
        "cara_pakai": "Oleskan dan biarkan 10-15 menit, bilas dengan air hangat 2-3 kali seminggu",
        "gambar": "https://drive.google.com/uc?id=19AEtbZPTd4-f7fL21FBMbcLaXB4AwVOI",
      },
    ]
  }
}

# Load the model
model = tf.keras.models.load_model('model.h5')

@app.route('/predict', methods=['POST'])
def predict():
    try:
        file = request.files['image']
        
        if 'image' not in request.files:
            return jsonify({"error": "No image file uploaded"}), 400
        
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400
        
        if model is None:
            return jsonify({
                'error': 'Model not found'
            }), 500
        
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        file.save(filepath)
        image = Image.open(filepath).convert('RGB')
        image = image.resize((224, 224))  # Resize to match your model's input size
        image_array = np.array(image) / 255.0  # Normalize
        image_tensor = np.expand_dims(image_array, axis=0)  # Add batch dimension
        
        # predictions
        predictions = model.predict(image_tensor)
        confidence = float(np.max(predictions)) * 100
        class_index = np.argmax(predictions, axis=1)[0]
        label = classes[class_index]

        treatment = info[label]["treatment"]
        medicine = info[label]["medicine"]

        id = str(uuid.uuid4())
        createdAt = datetime.utcnow().isoformat()
        os.remove(filepath)

        # Data yang akan dikirim ke Firestore
        data = {
            "id": id,
            "label": label,
            "confidence": confidence,
            "treatment": treatment,
            "medicine": medicine,
            "createdAt": createdAt
        }

        # Simpan ke Firestore
        db.collection('predictions').document(id).set(data)

        return jsonify(data), 201

    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500
  
@app.route('/health', methods=['GET'])
def health():
  return jsonify({
    'status': 'ok bisa'
  })

# Run app
if __name__ == '__main__':
  app.run(debug=True)