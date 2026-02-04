# Plan Verification & Feature Gating

## Backend Protection (SECURE)

### 1. Protect Premium Routes
```javascript
// routes/invoice.js
const { requirePremium, requireBasic } = require('../middleware/subscription');

// Premium feature - E-way bill
router.post('/eway/generate', authenticate, requirePremium, ewayController.generate);

// Basic feature - Bulk export
router.get('/export', authenticate, requireBasic, invoiceController.export);
```

### 2. Get User Plan (Frontend)
```javascript
// On app load, fetch user plan
GET /api/users/profile
Headers: { Authorization: 'Bearer <token>' }

Response: {
  user: {
    id: "xxx",
    email: "user@example.com",
    name: "John Doe",
    plan: {
      tier: "premium",
      interval: "yearly",
      status: "active",
      expiry: "2027-01-15T00:00:00.000Z",
      isActive: true
    }
  }
}
```

## Frontend Implementation (React)

### 1. Auth Context with Plan
```javascript
// contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/users/profile', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    localStorage.setItem('token', data.token);
    await fetchProfile();
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshProfile: fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### 2. Plan Check Hook
```javascript
// hooks/usePlan.js
import { useAuth } from '../contexts/AuthContext';

export function usePlan() {
  const { user } = useAuth();

  const isPremium = user?.plan?.tier === 'premium' && user?.plan?.isActive;
  const isBasic = (user?.plan?.tier === 'basic' || user?.plan?.tier === 'premium') && user?.plan?.isActive;
  const isFree = !user?.plan?.isActive || user?.plan?.tier === 'free';

  const canAccess = (requiredPlan) => {
    if (requiredPlan === 'premium') return isPremium;
    if (requiredPlan === 'basic') return isBasic;
    return true;
  };

  return {
    tier: user?.plan?.tier || 'free',
    isPremium,
    isBasic,
    isFree,
    isActive: user?.plan?.isActive,
    expiry: user?.plan?.expiry,
    canAccess
  };
}
```

### 3. Feature Gate Component
```javascript
// components/FeatureGate.jsx
import { usePlan } from '../hooks/usePlan';
import { Link } from 'react-router-dom';

export default function FeatureGate({ requiredPlan, children, fallback }) {
  const { canAccess, tier } = usePlan();

  if (!canAccess(requiredPlan)) {
    return fallback || (
      <div className="upgrade-prompt">
        <h3>🔒 {requiredPlan === 'premium' ? 'Premium' : 'Paid'} Feature</h3>
        <p>Upgrade to {requiredPlan} plan to access this feature.</p>
        <Link to="/pricing" className="btn btn-primary">
          Upgrade Now
        </Link>
      </div>
    );
  }

  return children;
}
```

### 4. Usage Examples
```javascript
// Premium feature
<FeatureGate requiredPlan="premium">
  <button onClick={generateEwayBill}>Generate E-Way Bill</button>
</FeatureGate>

// Basic feature
<FeatureGate requiredPlan="basic">
  <button onClick={exportInvoices}>Export All Invoices</button>
</FeatureGate>

// Conditional rendering
function InvoiceActions() {
  const { isPremium } = usePlan();

  return (
    <div>
      <button>Download PDF</button>
      {isPremium && <button>Generate E-Way Bill</button>}
    </div>
  );
}
```

### 5. API Error Handling
```javascript
// services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data?.requiresUpgrade) {
      // Show upgrade modal
      window.dispatchEvent(new CustomEvent('show-upgrade-modal', {
        detail: {
          currentPlan: error.response.data.currentPlan,
          requiredPlan: error.response.data.requiredPlan
        }
      }));
    }
    return Promise.reject(error);
  }
);

export default api;
```

## Security Notes

1. **Never trust frontend** - Always verify plan on backend
2. **Store plan in DB only** - Never in localStorage
3. **Check expiry on every request** - Middleware handles this
4. **Refresh profile after payment** - Call `refreshProfile()` after subscription activation

## Plan Limits Example

```javascript
// middleware/limits.js
const LIMITS = {
  free: { invoices: 10, customers: 5 },
  basic: { invoices: 100, customers: 50 },
  premium: { invoices: Infinity, customers: Infinity }
};

const checkLimit = (resource) => async (req, res, next) => {
  const count = await prisma[resource].count({
    where: { userId: req.userId }
  });

  const limit = LIMITS[req.userPlan.tier][resource];
  
  if (count >= limit) {
    return res.status(403).json({
      error: `${resource} limit reached`,
      limit,
      current: count,
      requiresUpgrade: true
    });
  }
  
  next();
};
```
