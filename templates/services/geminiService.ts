import { ExtractedTableData } from '../types';

const getApiUrl = () => {
  const host = window.location.hostname;
  
  // 1. Localhost Development
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://127.0.0.1:5000/convert';
  }

  // 2. Google Cloud Run (Judges)
  // Cloud Run URLs end in .run.app -> Backend is on same server
  if (host.includes('run.app')) {
    return '/convert'; 
  }

  // 3. Vercel/Public (Users)
  // Point to Render Backend
  // REPLACE THIS WITH YOUR RENDER URL LATER
  return 'https://visionsheet-backend.onrender.com'; 
};

export const extractTableFromImage = async (base64: string, fileType: string): Promise<ExtractedTableData> => {
  const res = await fetch(base64);
  const blob = await res.blob();
  const file = new File([blob], "image", { type: fileType });

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(getApiUrl(), {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to process image');
  }

  return await response.json();
};