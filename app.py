import os
import json
import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# --- API KEY CONFIGURATION ---
api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    # If .env fails, paste your key here for testing
    api_key = "AIzaSy_YOUR_KEY_HERE"

genai.configure(api_key=api_key)

# --- CRITICAL FIX: AUTO-DETECT MODEL ---
def find_best_model():
    """
    Asks Google: 'What models do I have access to?'
    And picks the best one for images.
    """
    print("🔍 Scanning your API key for available models...")
    try:
        # Get all models your key can see
        all_models = list(genai.list_models())
        
        # 1. Look for Flash (Fastest)
        for m in all_models:
            if 'flash' in m.name and 'generateContent' in m.supported_generation_methods:
                print(f"✅ FOUND FLASH: {m.name}")
                return genai.GenerativeModel(m.name)
        
        # 2. Look for Pro (Smarter)
        for m in all_models:
            if 'pro' in m.name and 'vision' not in m.name and 'generateContent' in m.supported_generation_methods:
                print(f"✅ FOUND PRO: {m.name}")
                return genai.GenerativeModel(m.name)

        # 3. Look for Legacy Vision (Old Reliable)
        for m in all_models:
            if 'vision' in m.name and 'generateContent' in m.supported_generation_methods:
                print(f"✅ FOUND LEGACY VISION: {m.name}")
                return genai.GenerativeModel(m.name)

    except Exception as e:
        print(f"⚠️ Could not list models (Error: {e})")

    # 4. If all else fails, force the specific ID that usually works
    print("⚠️ Auto-detect failed. Forcing 'gemini-1.5-flash-001'")
    return genai.GenerativeModel('gemini-1.5-flash-001')

# Initialize the model using the auto-finder
model = find_best_model()

@app.route('/convert', methods=['POST'])
def convert():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    try:
        image = Image.open(file)

        prompt = """
        Analyze this image (table, receipt, or whiteboard). 
        Extract the tabular data into this exact JSON structure:
        {
            "headers": ["Column1", "Column2", "Column3"],
            "rows": [
                ["Row1-Val1", "Row1-Val2", "Row1-Val3"],
                ["Row2-Val1", "Row2-Val2", "Row2-Val3"]
            ],
            "summary": "A 1-sentence insight about this data."
        }
        Return ONLY valid JSON. Do not use Markdown code blocks.
        """

        response = model.generate_content([prompt, image])
        
        cleaned_text = response.text.replace("```json", "").replace("```", "").strip()
        
        try:
            data = json.loads(cleaned_text)
        except json.JSONDecodeError:
            print(f"AI Output (Not JSON): {cleaned_text}")
            return jsonify({"error": "AI could not read the table. Try a clearer image."}), 500
        
        return jsonify(data)

    except Exception as e:
        print(f"Server Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host='0.0.0.0', port=port)