# Integration Guide: Adding Compliance Hub to App

This guide shows how to integrate the Compliance Hub components into the main Tally Automation application.

## Step-by-Step Integration

### 1. Import ComplianceHub Component

Add this import at the top of `client/src/App.jsx` with the other lazy-loaded components:

```jsx
const ComplianceHub = lazy(() => import("./components/ComplianceHub"));
```

### 2. Add Navigation Item

Add this entry to the `navigation` array in `App.jsx`:

```jsx
const navigation = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "clients", label: "Clients", icon: Users },
  { id: "bank", label: "Bank Statement", icon: Landmark },
  { id: "invoice", label: "Invoice Processor", icon: Receipt },
  { id: "recommendations", label: "Speedy Recommendations", icon: Sparkles },
  { id: "gst", label: "GST Reconciliation", icon: ShieldCheck },
  { id: "compliance", label: "Compliance Hub", icon: ShieldCheck },  // ADD THIS LINE
  { id: "history", label: "History", icon: History },
  { id: "settings", label: "Settings", icon: Settings },
];
```

You may want to use a different icon. Available icons from lucide-react:
- `FileText` - for documents
- `CheckSquare` - for checklists
- `BarChart3` - for analytics
- `Zap` - for critical alerts
- `TrendingUp` - for progress

### 3. Add Page Rendering Logic

Find the section in `App.jsx` where conditional rendering happens (around line 2700-3200). Add this block for compliance:

```jsx
{activePage === "compliance" && (
  <Suspense fallback={<AddOnLoadingCard />}>
    <ComplianceHub 
      companyData={{
        companyName: settingsForm.companyName || "Your Company",
        clientId: bankProcessingConfig.clientId,
      }}
    />
  </Suspense>
)}
```

### 4. Optional: Add Compliance State Management

For managing compliance data across the app, you may want to add state variables in the `App` component:

```jsx
// Add to main state declarations
const [complianceData, setComplianceData] = useState({
  gstStatus: null,
  tdsStatus: null,
  complianceScore: null,
});
```

### 5. Update Recharts Dependency (if needed)

The TDSManager component uses Recharts for charts. Ensure it's installed:

```bash
cd client
npm install recharts
```

## Component Props

### ComplianceHub Props

```jsx
<ComplianceHub 
  companyData={{
    companyName: string,           // Company name for display
    clientId: string,              // Optional: company/client ID
    gstinNumber: string,           // Optional: GSTIN
    fiscalYear: number,            // Optional: FY year (default: current)
  }}
/>
```

### ComplianceScorecard Props

```jsx
<ComplianceScorecard 
  companyData={{
    companyName: string,
    companyId: string,
  }}
  refreshInterval={3600000}        // Auto-refresh interval in ms (default: 1 hour)
/>
```

### TDSManager Props

```jsx
<TDSManager 
  year={number}                    // Fiscal year (e.g., 2024)
/>
```

### ComplianceChecklist Props

```jsx
<ComplianceChecklist 
  companyData={{
    companyName: string,
    companyId: string,
  }}
  onUpdate={(category, taskId) => {}} // Callback when task updates
/>
```

## API Integration

The components make API calls to the backend. Ensure these endpoints are properly implemented:

```
POST   /api/compliance/scorecard
GET    /api/compliance/tds-summary/{companyId}/{fy}
GET    /api/compliance/checklist/{companyId}/{fy}
```

The compliance routes are already registered in `server/src/app.js`, so no additional backend setup should be needed.

## Styling & Customization

### Using Custom Theme Colors

The components use Tailwind utility classes. To customize colors, update Tailwind config in `client/tailwind.config.js`:

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        'compliance-green': '#10b981',
        'compliance-orange': '#f59e0b',
        'compliance-red': '#ef4444',
      }
    }
  }
}
```

### Dash Board Title

To customize the page title that appears when Compliance Hub is active, the app automatically uses:

```jsx
const pageTitle = navigation.find((item) => item.id === activePage)?.label || "Dashboard";
// Result: "Compliance Hub"
```

## Mobile Responsiveness

The components are fully responsive and follow the existing mobile-first design patterns in the app:

- Grid layouts use `lg:grid-cols-X` for responsive breakpoints
- Overflowable content uses horizontal scrolling on small screens
- Touch-friendly button and input sizes maintained

## Testing the Integration

1. **Start the Development Server**:
```bash
cd client
npm run dev
```

2. **Verify Navigation Item**:
   - Check sidebar for "Compliance Hub" menu item
   - Icon should appear correctly

3. **Click Navigation Item**:
   - Should render ComplianceHub component
   - Check browser console for any API errors

4. **Test API Endpoints**:
   - Open DevTools Network tab
   - Navigate to Compliance Hub
   - Verify requests to `/api/compliance/*` complete

## Common Issues & Solutions

### Issue: ComplianceHub Not Appearing
**Solution**: 
- Verify import statement is correct
- Check navigation array includes compliance entry
- Ensure conditional rendering block is present
- Check browser console for errors

### Issue: "Cannot find module 'recharts'"
**Solution**:
```bash
cd client && npm install recharts
```

### Issue: API 404 Errors
**Solution**:
- Verify server is running
- Check compliance routes in `server/src/routes/complianceRoutes.js`
- Ensure routes are mounted in `server/src/app.js`
- Restart server after changes

### Issue: Styling Not Applied
**Solution**:
- Clear browser cache (Ctrl+Shift+Delete)
- Verify Tailwind CSS is processing files
- Check for CSS conflicts with existing styles

## Performance Optimization

### Reduce Initial Load Time
Use React.memo for chart components:

```jsx
const MemoizedTDSManager = React.memo(TDSManager);
```

### Lazy Load Tabs
Load tab content only when tab is active:

```jsx
{activeTab === 'tds' && <TDSManager year={selectedFY} />}
```

### Cache API Data
Consider implementing cache for scorecard:

```jsx
const [cacheTime, setCacheTime] = useState(Date.now());
const shouldRefresh = Date.now() - cacheTime > 3600000; // 1 hour
```

## Next Steps

1. **Test Locally**: Run the app and verify all components render correctly
2. **Connect APIs**: Ensure backend compliance endpoints are working
3. **Add Company Data**: Populate company information for realistic testing
4. **Set Up Notifications**: Add toast notifications for compliance alerts
5. **Export Reports**: Implement PDF export functionality

## Deployment Checklist

before deploying to production:

- [ ] All API endpoints tested and working
- [ ] Mock data replaced with real company data
- [ ] Error handling in place for failed API calls
- [ ] Authentication properly implemented
- [ ] Mobile responsiveness verified
- [ ] Performance metrics acceptable
- [ ] Accessibility standards met
- [ ] Security review completed

## Support & Documentation

For detailed information about individual components, see:
- [COMPLIANCE_FEATURES.md](./COMPLIANCE_FEATURES.md) - Feature overview
- Component JSDoc comments - Implementation details
- API Documentation - Backend specifications

