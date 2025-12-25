import { ExtractedTableData } from '../types';

const getApiUrl = () => {
  const host = window.location.hostname;
  
  // 1. Localhost Development
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://127.0.0.1:5000/convert';
  }

  // 2. Google Cloud Run (Judges)
  // Cloud Run URLs end in .run.app -> Backend is on same server (relative path)
  if (host.includes('run.app')) {
    return '/convert'; 
  }

  // 3. Vercel/Public (Users)
  // REPLACE THIS with your specific Render Backend URL found in the Render Dashboard
  return 'https://visionsheet-backend.onrender.com/convert'; 
};

export const extractTableFromImage = async (base64: string, fileType: string): Promise<ExtractedTableData> => {
  const res = await fetch(base64);
  const blob = await res.blob();
  const file = new File([blob], "image", { type: fileType });

  const formData = new FormData();
  formData.append('file', file);

  // 1. Get Custom Key from Local Storage
  const customKey = localStorage.getItem('visionSheet_apiKey') || '';

  // DEBUG: Check console to see if key is being sent
  if (customKey) console.log("🔑 Sending User Custom Key...");

  const response = await fetch(getApiUrl(), {
    method: 'POST',
    headers: {
        // 2. Send header ONLY if key exists
        // Note: We do NOT set Content-Type here; fetch sets it automatically for FormData
        ...(customKey ? { 'x-user-api-key': customKey } : {})
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    
    // 3. Special Flag for UI (Quota Exceeded)
    if (response.status === 429) {
        throw new Error("QUOTA_EXCEEDED"); 
    }
    throw new Error(errorData.error || 'Failed to process image');
  }

  return await response.json();
};