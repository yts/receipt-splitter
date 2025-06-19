import { useState } from 'react';
import { createWorker, type Worker } from 'tesseract.js';
import type { LineItem } from '../types';

interface Props {
  onImport: (items: LineItem[]) => void;
}

export function ReceiptScanner({ onImport }: Props) {
  const [isScanning, setIsScanning] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    let worker: Worker | null = null;
    
    try {
      // Initialize Tesseract worker
      worker = await createWorker('eng');
      
      // Read the image
      const result = await worker.recognize(file);
      const text = result.data.text;
        // Parse text to extract items and prices
      const lines = text.split('\n');
      const items: LineItem[] = [];
      
      const priceRegex = /\$?\d+\.\d{2}/;  // Matches price format like $12.99 or 12.99
      
      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;
        
        // Look for a price in the line
        const priceMatch = trimmedLine.match(priceRegex);
        if (!priceMatch) return;
        
        const price = parseFloat(priceMatch[0].replace('$', ''));
        if (isNaN(price)) return;
        
        // Extract item name (everything before the price)
        const name = trimmedLine.substring(0, priceMatch.index).trim();
        if (!name) return;
        
        items.push({
          name,
          price,
          category: '',  // User will need to categorize
          taxable: false // User will need to mark taxable items
        });
      });

      if (items.length > 0) {
        onImport(items);
      } else {
        alert('No items could be detected in the image. Please try another image or adjust the image quality.');
      }
    } catch (error) {
      console.error('Error scanning receipt:', error);
      alert('Error scanning receipt. Please try again with a clearer image.');    } finally {
      if (worker) {
        await worker.terminate();
      }
      setIsScanning(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        id="receipt-input"
        disabled={isScanning}
      />
      <label
        htmlFor="receipt-input"
        className={`px-4 py-2 text-white rounded-md shadow-sm cursor-pointer ${
          isScanning
            ? 'bg-gray-400'
            : 'bg-indigo-600 hover:bg-indigo-700'
        }`}
      >
        {isScanning ? 'Scanning...' : 'Import Receipt'}
      </label>
    </div>
  );
}
