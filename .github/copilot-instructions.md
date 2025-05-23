<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

- Do NOT use shadcn/ui. Use only native HTML elements, React, and Tailwind CSS for all UI components.
- This is a Vite + React + TypeScript project for a receipt splitter app.
- The app should include:
  - A tax rate input (persisted in local storage)
  - Receipt line item entry (name, price, category, taxable checkbox)
  - Categories with typeahead and local storage
  - A Totals section (total cost, total per category, After Tax columns that update automatically as items are added/edited)
  - Each item row should have Edit/Save and Cancel buttons for inline editing
