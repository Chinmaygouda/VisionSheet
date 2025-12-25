import os
import json
import datetime
import google.generativeai as genai
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from PIL import Image
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='templates/dist', static_url_path='/')

CORS(app, resources={r"/*": {"origins": "*"}}, 
     methods=["GET", "POST", "OPTIONS"], 
     allow_headers=["Content-Type", "Authorization", "x-user-api-key"])

# --- SYSTEM CONFIG ---
SYSTEM_API_KEY = os.getenv("GOOGLE_API_KEY")

# --- 🧠 INTELLIGENT MODEL SELECTOR ---
def get_auto_model(api_key):
    """
    1. Connects to Google.
    2. Downloads list of ALL models allowed for this Key.
    3. Picks the best one automatically (Prioritizing Flash for speed).
    """
    try:
        genai.configure(api_key=api_key)
        
        # 1. Get all models that support content generation (Chat/Vision)
        available_models = []
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                # We only want "Gemini" models, not old PaLM/Bison ones
                if 'gemini' in m.name:
                    available_models.append(m.name)
        
        # print(f"📋 Found {len(available_models)} models.") 

        # 2. define Priority Strategy (Best -> Good -> Okay)
        # We prefer "Flash" because it is fast and cheap for image processing.
        # We prefer "2.5" > "2.0" > "1.5" because they are smarter.
        priorities = [
            "gemini-2.5-flash",       # Newest & Fastest
            "gemini-2.0-flash",       # Very fast
            "gemini-1.5-flash",       # Stable standard
            "gemini-flash",           # Generic Flash alias
            "gemini-2.5-pro",         # Smart but slower
            "gemini-1.5-pro",         # Stable smart
            "gemini-pro"              # Legacy
        ]

        # 3. Find the best match
        for priority in priorities:
            # Look for a model in the available list that contains this priority string
            match = next((m for m in available_models if priority in m), None)
            if match:
                print(f"✅ Auto-Selected Best Model: {match}")
                return genai.GenerativeModel(match)

        # 4. If no priority match, just take the first available Gemini model
        if available_models:
            fallback = available_models[0]
            print(f"⚠️ No priority match. Using first available: {fallback}")
            return genai.GenerativeModel(fallback)

    except Exception as e:
        print(f"⚠️ Model scan error: {e}")

    # 5. Absolute Last Resort (Hardcoded)
    print("⚠️ Scan failed completely. Forcing 'gemini-1.5-flash'")
    return genai.GenerativeModel('gemini-1.5-flash')


# --- RATE LIMITER ---
user_usage = {}

def check_system_limit(user_ip):
    today = datetime.date.today().isoformat()
    if user_ip not in user_usage:
        user_usage[user_ip] = {'count': 0, 'date': today}
    
    user_data = user_usage[user_ip]
    if user_data['date'] != today:
        user_data['count'] = 0
        user_data['date'] = today
    
    if user_data['count'] >= 5: return False
    user_data['count'] += 1
    return True

@app.route('/convert', methods=['POST'])
def convert():
    user_key = request.headers.get('x-user-api-key')
    active_key = None

    if user_key and len(user_key) > 30:
        active_key = user_key
        print("🔑 Using User Key")
    else:
        user_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        if not check_system_limit(user_ip):
            return jsonify({"error": "Limit Reached", "limitReached": True}), 429
        active_key = SYSTEM_API_KEY

    if not active_key:
         return jsonify({"error": "No API Key found"}), 500

    if 'file' not in request.files: return jsonify({"error": "No file"}), 400
    file = request.files['file']

    try:
        # --- 1. Auto-Select Model ---
        model = get_auto_model(active_key)
        
        # --- 2. Process Image ---
        image = Image.open(file)
        if image.width > 1500 or image.height > 1500:
            image.thumbnail((1500, 1500))

        prompt = """
        Analyze this image. Extract tabular data into this JSON structure:
        {
            "headers": ["Col1", "Col2"],
            "rows": [["Val1", "Val2"], ["Val3", "Val4"]],
            "summary": "1-sentence summary."
        }
        CRITICAL RULES:
        1. Return ONLY valid JSON.
        2. If a cell is blank, return empty string "". Do not skip.
        3. Maintain row structure.
        """

        response = model.generate_content([prompt, image])
        
        cleaned_text = response.text.replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned_text)
        return jsonify(data)

    except Exception as e:
        err = str(e)
        print(f"🔥 Error: {err}")
        if "429" in err: return jsonify({"error": "Quota Exceeded. Try a different key."}), 429
        if "404" in err: return jsonify({"error": "Model Not Found during generation."}), 500
        return jsonify({"error": f"Failed: {err}"}), 500

# --- SERVE FRONTEND ---
@app.route('/')
def serve():
    if os.path.exists(app.static_folder):
        return send_from_directory(app.static_folder, 'index.html')
    return "Backend Running", 200

@app.route('/<path:path>')
def static_proxy(path):
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host='0.0.0.0', port=port)