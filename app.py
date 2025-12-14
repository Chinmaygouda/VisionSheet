import os
import json
import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
from dotenv import load_dotenv  # <--- Import this to read .env files

# 1. Load the secret .env file
load_dotenv()

app = Flask(__name__)
# Allow CORS so React can talk to Python
CORS(app, resources={r"/*": {"origins": "*"}})

# --- API KEY CONFIGURATION ---
# Get key securely from environment variables.
# This prevents hackers from seeing your key on GitHub.
api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    print("❌ CRITICAL ERROR: API Key not found! Make sure you created a '.env' file with GOOGLE_API_KEY inside.")

genai.configure(api_key=api_key)

# Use the stable Gemini 1.5 Flash model
model = genai.GenerativeModel('gemini-1.5-flash')

@app.route('/convert', methods=['POST'])
def convert():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    try:
        image = Image.open(file)

        # Prompt Gemini to return JSON data
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
        
        # Clean up if Gemini adds ```json ... ```
        cleaned_text = response.text.replace("```json", "").replace("```", "").strip()
        
        # Parse text into real JSON
        try:
            data = json.loads(cleaned_text)
        except json.JSONDecodeError:
            # Fallback if AI returns bad JSON
            print(f"Bad JSON received: {cleaned_text}")
            return jsonify({"error": "AI failed to generate valid data. Try a clearer image."}), 500
        
        return jsonify(data)

    except Exception as e:
        print(f"Server Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host='0.0.0.0', port=port)