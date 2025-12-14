# 👁️ VisionSheet

> **Turn messy photos into clean Excel spreadsheets instantly.**

VisionSheet uses **Google Gemini 1.5 Flash** to extract data from handwritten notes, receipts, and whiteboards, converting them into formatted, downloadable Excel files.

![VisionSheet Demo](image.png)
*(Tip: Replace this link with a screenshot of your 3D Robot UI later!)*

## 🚀 Key Features
- **🤖 AI Vision:** Uses Gemini 1.5 Flash to understand complex, messy tables.
- **✨ 3D Interactive UI:** Features a reactive 3D environment with floating elements.
- **📊 Smart Formatting:** Auto-colors headers, adjusts column widths, and validates data.
- **👀 Instant Preview:** Review the extracted table data before downloading.
- **🔒 Secure:** Built with `ExcelJS` (no vulnerable libraries) and secure API handling.

## 🛠️ Tech Stack
- **Backend:** Python (Flask), Google Generative AI SDK
- **Frontend:** React (Vite), TailwindCSS, Framer Motion (for 3D animations)
- **AI Model:** Gemini 1.5 Flash
- **Data Handling:** Pandas (Python) + ExcelJS (Frontend)

---

## 📦 How to Run This Project

Follow these steps to get VisionSheet running on your local machine.

### Prerequisites
1.  **Python** installed.
2.  **Node.js** installed.
3.  A **Google Gemini API Key** (Get it from [Google AI Studio](https://aistudio.google.com/)).

### 1. Clone the Repository
```bash
git clone  https://github.com/Chinmaygouda/VisionSheet.git
cd VisionSheet