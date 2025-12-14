import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { ExtractedTableData } from '../types';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const generateAndDownloadExcel = async (data: ExtractedTableData, filename: string) => {
  // 1. Create Workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('VisionSheet Data');

  // 2. Add Headers with Styling
  const headerRow = worksheet.addRow(data.headers);
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F46E5' } // Indigo-600
    };
    cell.font = {
      color: { argb: 'FFFFFFFF' },
      bold: true,
      size: 12
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } }
    };
  });

  // 3. Add Data
  data.rows.forEach(row => {
    worksheet.addRow(row);
  });

  // 4. Auto-width Columns
  worksheet.columns.forEach(column => {
    column.width = 25;
    column.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  // 5. Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename}_VisionSheet.xlsx`);
};