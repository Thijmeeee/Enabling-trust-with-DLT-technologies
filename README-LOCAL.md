# Digital Product Passport (DPP) Demo

This application demonstrates a fully functional Digital Product Passport system with local in-memory data storage.

## How to Use

1. **Start the application:**
   ```powershell
   npm run dev
   ```

2. **Open in browser:**
   - Go to http://localhost:5173/

3. **Initialize demo data:**
   - Click on the "Initialize Data" button
   - This creates demo products (a window with glass and frame components)

4. **Explore the application:**
   - View the product list in the dashboard
   - Click on products to see details
   - Use the "Demo Scenarios" to create new products
   - Check the "Watcher Monitor" for system alerts

## Important Limitations

⚠️ **Data is temporary** - All data is stored in memory and will be lost on page refresh
⚠️ **No persistence** - There is no real database, so data is not persisted
⚠️ **Demo purposes** - This is intended as a demonstration of functionality

## Project Structure

- `/src/lib/localData.ts` - In-memory data store
- `/src/lib/mockDataGeneratorLocal.ts` - Generates demo data
- `/src/lib/dppManagerLocal.ts` - DPP management functions
- `/src/lib/watcherLocal.ts` - Monitoring and alerting system
- `/src/components/` - React components for the UI

## Features

### Dashboard
- List of all DPPs
- Search and filter functionality
- Statistics overview

### DPP Details
- Complete product information
- Hierarchical component structure
- DID documents
- Verifiable Credentials
- Anchoring events
- Witness attestations

### Watcher Monitor
- Real-time monitoring alerts
- Hierarchy integrity checks
- Data validation

### Demo Scenarios
- Automated scenarios to create new products
- Demonstrates the complete DPP creation process

## Technologies

- **React** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

## For Production Use

If you want to make this system production-ready:
1. Implement a real database (PostgreSQL, MongoDB, etc.)
2. Add authentication
3. Implement API endpoints
4. Add data persistence
5. Implement proper error handling
6. Add logging and monitoring
