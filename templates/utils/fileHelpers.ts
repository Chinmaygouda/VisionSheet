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
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + ['Bytes', 'KB', 'MB', 'GB'][i];
};

export const parseExcelFile = async (file: File): Promise<ExtractedTableData> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) throw new Error("Excel file empty");

  const headers: string[] = [];
  const rows: string[][] = [];

  worksheet.eachRow((row, rowNumber) => {
    const rowValues = (row.values as any[]).slice(1).map(val => val ? String(val) : "");
    if (rowNumber === 1) rowValues.forEach(h => headers.push(h));
    else rows.push(rowValues);
  });

  return { headers, rows, summary: "Imported from Excel" };
};

export const generateAndDownloadExcel = async (data: ExtractedTableData, filename: string) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('VisionSheet Data');

  // Columns
  worksheet.columns = data.headers.map(h => ({ header: h, key: h, width: 20 }));

  // Rows (Convert Numbers)
  data.rows.forEach(row => {
    const parsedRow = row.map(cell => (cell && !isNaN(Number(cell)) && cell.trim() !== "") ? Number(cell) : cell);
    worksheet.addRow(parsedRow);
  });

  // Styling
  const headerRow = worksheet.getRow(1);
  headerRow.height = 25;
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E293B' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  worksheet.eachRow((row, i) => {
    if (i === 1) return;
    row.eachCell(cell => {
      cell.border = { top: { style: 'thin', color: { argb: 'CBD5E1' } }, left: { style: 'thin', color: { argb: 'CBD5E1' } }, bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };
      if (i % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `${filename}.xlsx`);
};