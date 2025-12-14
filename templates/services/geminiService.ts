import { ExtractedTableData } from '../types';

export const extractTableFromImage = async (base64: string, fileType: string): Promise<ExtractedTableData> => {
  
  // Convert Base64 back to file blob to send to Python
  const res = await fetch(base64);
  const blob = await res.blob();
  const file = new File([blob], "image", { type: fileType });

  const formData = new FormData();
  formData.append('file', file);

  // Send to Python
  const response = await fetch('http://localhost:5000/convert', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to process image');
  }

  // Get JSON data for preview
  const data: ExtractedTableData = await response.json();
  return data;
};