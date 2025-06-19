import { useEffect, useState, useRef } from 'react';
import type { CategoryTotals, LineItem } from './types';
import { type ReceiptState, getStateFromUrl, updateUrl } from './lib/url-state';
import { ReceiptScanner } from './components/ReceiptScanner';

const TAX_RATE_KEY = 'taxRate';
const CATEGORIES_KEY = 'categories';

function App() {
  // Load initial state from URL or defaults
  const initialState = getStateFromUrl() || {
    items: [],
    taxRate: localStorage.getItem(TAX_RATE_KEY) || '',
    discountType: 'percentage' as const,
    discountValue: '',
  };

  // State
  const [items, setItems] = useState<LineItem[]>(initialState.items);
  const [taxRate, setTaxRate] = useState<string>(initialState.taxRate);
  const [discountType, setDiscountType] = useState<'percentage' | 'amount'>(initialState.discountType);
  const [discountValue, setDiscountValue] = useState<string>(initialState.discountValue);

  // Sync state with URL
  useEffect(() => {
    const state: ReceiptState = {
      items,
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

  // Line Items
  const [itemInput, setItemInput] = useState<LineItem>({ name: '', price: 0, category: '', taxable: false });
  const [categoryTypeahead, setCategoryTypeahead] = useState<string[]>([]);
  const categoryInputRef = useRef<HTMLInputElement>(null);

  // Editing state
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editInput, setEditInput] = useState<LineItem | null>(null);

  // Handle item input changes
  const handleItemChange = (field: keyof LineItem, value: string | boolean) => {
    setItemInput((prev) => ({ ...prev, [field]: value }));
    if (field === 'category' && typeof value === 'string') {
      setCategoryTypeahead(categories.filter((cat) => cat.toLowerCase().includes(value.toLowerCase())));
    }
  };

  // Add item
  const handleAddItem = () => {
    if (!itemInput.category) return;
    setItems((prev) => [...prev, { ...itemInput, price: Number(itemInput.price) }]);
    if (itemInput.category && !categories.includes(itemInput.category)) {
      setCategories((prev) => [...prev, itemInput.category]);
    }
    setItemInput({ name: '', price: 0, category: '', taxable: false });
    setCategoryTypeahead([]);
  };

  // Start editing an item
  const handleEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditInput({ ...items[idx] });
  };

  // Save edited item
  const handleSave = (idx: number) => {
    if (!editInput) return;
    const updatedItems = [...items];
    updatedItems[idx] = { ...editInput, price: Number(editInput.price) };
    setItems(updatedItems);
    setEditingIdx(null);
    setEditInput(null);
  };

  // Cancel editing
  const handleCancel = () => {
    setEditingIdx(null);
    setEditInput(null);
  };

  // Handle edit input changes
  const handleEditInputChange = (field: keyof LineItem, value: string | boolean) => {
    if (!editInput) return;
    setEditInput((prev) => prev ? { ...prev, [field]: value } : null);
  };

  // Add function to handle imported receipt items
  const handleImportedItems = (importedItems: LineItem[]) => {
    setItems(prev => [...prev, ...importedItems]);
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

      {/* Add ReceiptScanner component */}
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
      {/* Line Item Entry */}
      <div className="flex flex-col gap-2 border p-2 sm:p-4 rounded-lg">
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <input
            placeholder="Item Name (optional)"
            value={itemInput.name}
            onChange={(e) => handleItemChange('name', e.target.value)}
            className="w-full sm:w-40 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
          <input
            placeholder="Price"
            type="number"
            min="0"
            value={itemInput.price}
            onChange={(e) => handleItemChange('price', e.target.value)}
            className="w-full sm:w-24 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
          <div className="relative w-full sm:w-32">
            <input
              ref={categoryInputRef}
              placeholder="Category"
              value={itemInput.category}
              onChange={(e) => handleItemChange('category', e.target.value)}
              className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 w-full"
              autoComplete="off"
            />
            {categoryTypeahead.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-32 overflow-y-auto">
                {categoryTypeahead.map((cat) => (
                  <div
                    key={cat}
                    className="px-2 py-1 hover:bg-gray-100 cursor-pointer"
                    onClick={() => {
                      handleItemChange('category', cat);
                      setCategoryTypeahead([]);
                      categoryInputRef.current?.blur();
                    }}
                  >
                    {cat}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <input
              id="taxable"
              type="checkbox"
              checked={itemInput.taxable}
              onChange={(e) => handleItemChange('taxable', e.target.checked)}
              className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="taxable" className="text-sm font-medium text-gray-700">Taxable</label>
          </div>
          <button
            onClick={handleAddItem}
            className="w-full sm:w-auto ml-0 sm:ml-2 px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Add Item
          </button>
        </div>
      </div>
      {/* Items List */}
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
            {items.map((item, idx) => {
              if (editingIdx === idx) {
                return (
                  <tr key={idx} className="border-t">
                    <td className="p-2">
                      <input
                        value={editInput?.name || ''}
                        onChange={e => handleEditInputChange('name', e.target.value)}
                        className="w-full border-gray-300 rounded-md shadow-sm"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        value={editInput?.price || 0}
                        onChange={e => handleEditInputChange('price', e.target.value)}
                        className="w-full border-gray-300 rounded-md shadow-sm"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        value={editInput?.category || ''}
                        onChange={e => handleEditInputChange('category', e.target.value)}
                        className="w-full border-gray-300 rounded-md shadow-sm"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!editInput?.taxable}
                        onChange={e => handleEditInputChange('taxable', e.target.checked)}
                      />
                    </td>
                    <td className="p-2 flex flex-col sm:flex-row gap-2">
                      <button
                        className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 w-full sm:w-auto"
                        onClick={() => handleSave(idx)}
                      >
                        Save
                      </button>
                      <button
                        className="px-2 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 w-full sm:w-auto"
                        onClick={handleCancel}
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                );
              } else {
                return (
                  <tr key={idx} className="border-t">
                    <td className="p-2">{item.name}</td>
                    <td className="p-2">${item.price.toFixed(2)}</td>
                    <td className="p-2">{item.category}</td>
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={item.taxable}
                        onChange={e => {
                          const updatedItems = [...items];
                          updatedItems[idx] = { ...item, taxable: e.target.checked };
                          setItems(updatedItems);
                        }}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                    </td>
                    <td className="p-2">
                      <button
                        className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 w-full sm:w-auto"
                        onClick={() => handleEdit(idx)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              }
            })}
          </tbody>
        </table>
      </div>
      {/* Totals Section */}
      <div className="mt-8 overflow-x-auto">
        <h2 className="text-xl font-semibold mb-2 text-center sm:text-left">Totals</h2>
        <table className="w-full border text-sm">
          <thead>            <tr className="bg-gray-100">
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
