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

export const parseExcelFile = async (file: File): Promise<ExtractedTableData> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) throw new Error("Excel file appears to be empty.");

  const headers: string[] = [];
  const rows: string[][] = [];

  worksheet.eachRow((row, rowNumber) => {
    const rowValues = (row.values as any[]).slice(1).map(val => val ? String(val) : ""); 
    if (rowNumber === 1) {
      rowValues.forEach(h => headers.push(h));
    } else {
      rows.push(rowValues);
    }
  });

  return { headers, rows, summary: "Data imported from Excel file." };
};

export const generateAndDownloadExcel = async (data: ExtractedTableData, filename: string) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('VisionSheet Data');

  // 1. Setup Columns
  const columns = data.headers.map(h => ({ header: h, key: h, width: 20 }));
  worksheet.columns = columns;

  // 2. Add Data Rows (With Number Detection Fix)
  data.rows.forEach(row => {
    const parsedRow = row.map(cell => {
      // Check if string looks like a number (and isn't empty)
      if (cell && !isNaN(Number(cell)) && cell.trim() !== "") {
        return Number(cell); 
      }
      return cell;
    });
    worksheet.addRow(parsedRow);
  });

  // 3. Styling
  const headerRow = worksheet.getRow(1);
  headerRow.height = 25;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E293B' } }; // Dark Blue
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: data.headers.length } };

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.border = { top: { style: 'thin', color: { argb: 'CBD5E1' } }, left: { style: 'thin', color: { argb: 'CBD5E1' } }, bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };
      cell.font = { name: 'Calibri', size: 11 };
      if (rowNumber % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } }; // Zebra
    });
  });

  // Auto-width
  worksheet.columns.forEach(column => {
    let maxLength = 0;
    column["eachCell"]!({ includeEmpty: true }, (cell) => {
      const len = cell.value ? cell.value.toString().length : 10;
      if (len > maxLength) maxLength = len;
    });
    column.width = maxLength < 10 ? 12 : (maxLength > 50 ? 50 : maxLength + 2);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename}_VisionSheet.xlsx`);
};