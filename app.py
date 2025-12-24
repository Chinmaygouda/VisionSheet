import os
import json
import datetime
import google.generativeai as genai
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from PIL import Image
from dotenv import load_dotenv

load_dotenv()

# Setup App to serve React build files (for Google Cloud)
app = Flask(__name__, static_folder='templates/dist', static_url_path='/')
CORS(app, resources={r"/*": {"origins": "*"}})

# --- API KEY & MODEL ---
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("❌ ERROR: API Key not found in Environment Variables!")

genai.configure(api_key=api_key)

def get_model():
    # Auto-select the best available model
    try:
        for m in genai.list_models():
            if 'flash' in m.name and 'generateContent' in m.supported_generation_methods:
                return genai.GenerativeModel(m.name)
    except:
        pass
    return genai.GenerativeModel('gemini-1.5-flash-001')

model = get_model()

# --- RATE LIMITER (5 Requests/Day/IP) ---
user_usage = {}

def check_limit(user_ip):
    today = datetime.date.today().isoformat()
    if user_ip not in user_usage:
        user_usage[user_ip] = {'count': 0, 'date': today}
    
    user_data = user_usage[user_ip]
    if user_data['date'] != today:
        user_data['count'] = 0
        user_data['date'] = today
    
    if user_data['count'] >= 5:
        return False
    
    user_data['count'] += 1
    return True

@app.route('/convert', methods=['POST'])
def convert():
    user_ip = request.headers.get('X-Forwarded-For', request.remote_addr)

    if not check_limit(user_ip):
        return jsonify({
            "error": "Daily limit reached (5/5). Try again tomorrow!",
            "limitReached": True
        }), 429

    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    try:
        image = Image.open(file)
        prompt = """
        Analyze this image. Extract tabular data into this JSON structure:
        {
            "headers": ["Col1", "Col2"],
            "rows": [["Val1", "Val2"], ["Val3", "Val4"]],
            "summary": "1-sentence summary."
        }
        CRITICAL: Return empty string "" for blank cells. Do not skip data.
        """

        response = model.generate_content([prompt, image])
        cleaned_text = response.text.replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned_text)
        return jsonify(data)

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

# --- SERVE FRONTEND (For Google Cloud) ---
@app.route('/')
def serve():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory(app.static_folder, path)

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host='0.0.0.0', port=port)