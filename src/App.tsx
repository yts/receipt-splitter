import { useEffect, useState } from 'react';
import { TrashIcon } from 'lucide-react';
import type { CategoryTotals, LineItem } from './types';
import { type ReceiptState, getStateFromUrl, updateUrl } from './lib/url-state';
import { ReceiptScanner } from './components/ReceiptScanner';

const TAX_RATE_KEY = 'taxRate';
const CATEGORIES_KEY = 'categories';
const EMPTY_ITEM: LineItem = { name: '', price: 0, category: '', taxable: false };

function App() {
  // Load initial state from URL or defaults
  const initialState = getStateFromUrl() || {
    items: [EMPTY_ITEM], // Always start with an empty row
    taxRate: localStorage.getItem(TAX_RATE_KEY) || '',
    discountType: 'percentage' as const,
    discountValue: '',
  };

  // State
  const [items, setItems] = useState<LineItem[]>(initialState.items);
  const [taxRate, setTaxRate] = useState<string>(initialState.taxRate);
  const [discountType, setDiscountType] = useState<'percentage' | 'amount'>(initialState.discountType);
  const [discountValue, setDiscountValue] = useState<string>(initialState.discountValue);
  const [categoryTypeaheadIndex, setCategoryTypeaheadIndex] = useState<number | null>(null);

  // Ensure there's always an empty row at the end
  useEffect(() => {
    const lastItem = items[items.length - 1];
    const isLastItemEmpty = !lastItem.name && !lastItem.price && !lastItem.category && !lastItem.taxable;
    if (!isLastItemEmpty) {
      setItems(prev => [...prev, EMPTY_ITEM]);
    }
  }, [items]);

  // Sync state with URL - exclude the empty row from URL state
  useEffect(() => {
    const state: ReceiptState = {
      items: items.filter(item => item.name || item.price || item.category || item.taxable),
      taxRate,
      discountType,
      discountValue,
    };
    updateUrl(state);
  }, [items, taxRate, discountType, discountValue]);

  // Categories
  const [categories, setCategories] = useState<string[]>(() => {
    const stored = localStorage.getItem(CATEGORIES_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  }, [categories]);

  // Add imported items
  const handleImportedItems = (importedItems: LineItem[]) => {
    setItems(prev => {
      const currentItems = prev.slice(0, -1); // Remove the empty row
      return [...currentItems, ...importedItems, EMPTY_ITEM]; // Add imported items and a new empty row
    });
  };

  // Handle item changes
  const handleItemChange = (index: number, field: keyof LineItem, value: string | boolean | number) => {
    const updatedItems = [...items];
    if (field === 'price') {
      // Allow empty price field
      updatedItems[index] = { 
        ...items[index], 
        [field]: value === '' ? 0 : Number(value)
      };
    } else {
      updatedItems[index] = { ...items[index], [field]: value };
    }
    
    // If it's a category change and the category is new, add it to the list
    if (field === 'category' && typeof value === 'string' && value && !categories.includes(value)) {
      setCategories(prev => [...prev, value]);
    }
    
    setItems(updatedItems);
  };

  // Delete item
  const handleDeleteItem = (index: number) => {
    setItems(prev => {
      const newItems = prev.filter((_, i) => i !== index);
      // If we deleted the last non-empty row, make sure we still have an empty row
      const lastItem = newItems[newItems.length - 1];
      if (!lastItem || lastItem.name || lastItem.price || lastItem.category || lastItem.taxable) {
        newItems.push(EMPTY_ITEM);
      }
      return newItems;
    });
  };

  // Get category suggestions for a specific item
  const getCategorySuggestions = (value: string) => {
    return categories.filter(cat => cat.toLowerCase().includes(value.toLowerCase()));
  };

  const computeTotals = () => {
    const totals: CategoryTotals = {};
    const rate = parseFloat(taxRate) / 100;
    const dValue = parseFloat(discountValue) || 0;

    // Calculate initial subtotals
    items.forEach((item) => {
      if (!totals[item.category]) {
        totals[item.category] = { subtotal: 0, discount: 0, tax: 0, total: 0 };
      }
      totals[item.category].subtotal += item.price;
    });

    // Calculate total subtotal for percentage discount distribution
    const totalSubtotal = Object.values(totals).reduce((sum, val) => sum + val.subtotal, 0);

    // Apply discounts and calculate tax and totals
    Object.keys(totals).forEach((cat) => {
      // Calculate discount
      if (discountType === 'percentage') {
        totals[cat].discount = totals[cat].subtotal * (dValue / 100);
      } else {
        // Distribute flat discount proportionally
        totals[cat].discount = dValue * (totals[cat].subtotal / totalSubtotal);
      }

      const afterDiscount = totals[cat].subtotal - totals[cat].discount;

      // Calculate tax on discounted amount
      totals[cat].tax = items
        .filter(item => item.category === cat && item.taxable)
        .reduce((sum, item) => {
          const itemDiscount = item.price / totals[cat].subtotal * totals[cat].discount;
          return sum + ((item.price - itemDiscount) * rate);
        }, 0);

      // Calculate final total
      totals[cat].total = afterDiscount + totals[cat].tax;
    });

    return { totals };
  };

  const { totals: categoryTotals } = computeTotals();

  // Render
  return (
    <div className="max-w-2xl mx-auto p-2 sm:p-6 space-y-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-center">Receipt Splitter</h1>

      <div className="flex justify-end">
        <ReceiptScanner onImport={handleImportedItems} />
      </div>

      {/* Tax Rate and Discount Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex flex-col gap-2">
          <label htmlFor="taxRate" className="text-sm font-medium text-gray-700">Tax Rate (%)</label>
          <input
            id="taxRate"
            type="number"
            min="0"
            step="0.01"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            onBlur={() => localStorage.setItem(TAX_RATE_KEY, taxRate)}
            className="w-full sm:w-32 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="discount" className="text-sm font-medium text-gray-700">Discount</label>
          <div className="flex gap-2">
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'amount')}
              className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="percentage">%</option>
              <option value="amount">$</option>
            </select>
            <input
              id="discount"
              type="number"
              min="0"
              step="0.01"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder={discountType === 'percentage' ? 'Percentage' : 'Amount'}
            />
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="overflow-x-auto">
        <table className="w-full border mt-4 text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Price</th>
              <th className="p-2 text-left">Category</th>
              <th className="p-2 text-center">Taxable</th>
              <th className="p-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-t">
                <td className="p-2">
                  <input
                    value={item.name}
                    onChange={e => handleItemChange(idx, 'name', e.target.value)}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Item name"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price || ''} /* Display empty string instead of 0 */
                    onChange={e => handleItemChange(idx, 'price', e.target.value)}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Price"
                  />
                </td>
                <td className="p-2 relative">
                  <input
                    value={item.category}
                    onChange={e => {
                      handleItemChange(idx, 'category', e.target.value);
                      setCategoryTypeaheadIndex(idx);
                    }}
                    onBlur={() => {
                      // Delay hiding suggestions to allow clicking them
                      setTimeout(() => setCategoryTypeaheadIndex(null), 200);
                    }}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Category"
                  />
                  {categoryTypeaheadIndex === idx && item.category && (
                    <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-32 overflow-y-auto">
                      {getCategorySuggestions(item.category).map(cat => (
                        <div
                          key={cat}
                          className="px-2 py-1 hover:bg-gray-100 cursor-pointer"
                          onClick={() => {
                            handleItemChange(idx, 'category', cat);
                            setCategoryTypeaheadIndex(null);
                          }}
                        >
                          {cat}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={item.taxable}
                    onChange={e => handleItemChange(idx, 'taxable', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                </td>
                <td className="p-2 text-center">
                  {/* Only show delete button for non-empty rows */}
                  {(item.name || item.price || item.category || item.taxable) && (
                    <button
                      onClick={() => handleDeleteItem(idx)}
                      className="p-1 text-red-600 hover:text-red-700 rounded-full hover:bg-red-50"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals Section */}
      <div className="mt-8 overflow-x-auto">
        <h2 className="text-xl font-semibold mb-2 text-center sm:text-left">Totals</h2>
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">Category</th>
              <th className="p-2 text-left">Subtotal</th>
              <th className="p-2 text-left">Discount</th>
              <th className="p-2 text-left">Tax</th>
              <th className="p-2 text-left">Total</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(categoryTotals).map(([cat, val]) => (
              <tr key={cat} className="border-t">
                <td className="p-2">{cat}</td>
                <td className="p-2">${val.subtotal.toFixed(2)}</td>
                <td className="p-2">${val.discount.toFixed(2)}</td>
                <td className="p-2">${val.tax.toFixed(2)}</td>
                <td className="p-2">${val.total.toFixed(2)}</td>
              </tr>
            ))}
            <tr className="font-bold border-t">
              <td className="p-2">Total</td>
              <td className="p-2">
                ${Object.values(categoryTotals).reduce((sum, val) => sum + val.subtotal, 0).toFixed(2)}
              </td>
              <td className="p-2">
                ${Object.values(categoryTotals).reduce((sum, val) => sum + val.discount, 0).toFixed(2)}
              </td>
              <td className="p-2">
                ${Object.values(categoryTotals).reduce((sum, val) => sum + val.tax, 0).toFixed(2)}
              </td>
              <td className="p-2">
                ${Object.values(categoryTotals).reduce((sum, val) => sum + val.total, 0).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
