import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
print(f"🔑 Testing Key: ...{api_key[-5:] if api_key else 'None'}")

genai.configure(api_key=api_key)

print("\n📡 Connecting to Google to list available models...")
try:
    count = 0
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"  ✅ AVAILABLE: {m.name}")
            count += 1
    
    if count == 0:
        print("  ❌ No models found! Your API Key might be invalid or has no access.")
        
except Exception as e:
    print(f"  ❌ Error listing models: {e}")