import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { clearToken, getToken, setToken } from '../services/api';
import analytics from '../services/analytics';
import { Activity, ChecklistItem, Expense, Member, Trip, User } from '../types';
import { computeTripStatus, getTripImage, getInitials } from '../utils/helpers';

const TRIPS_CACHE_KEY = 'tripmate_trips_v2';
const USER_CACHE_KEY  = 'tripmate_user_v2';

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// ─── Context interface ────────────────────────────────────────────────────────

interface AppContextType {
  user: User | null;
  trips: Trip[];
  loading: boolean;
  isOnline: boolean;
  signIn: (emailOrPhone: string, password: string) => Promise<boolean>;
  signUp:  (email: string, username: string, phone: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  changePassword: (current: string, newPwd: string) => Promise<boolean>;
  refreshTrips: () => Promise<void>;
  getTrip: (id: string) => Trip | undefined;
  createTrip: (data: { name: string; startDate: string; endDate: string; description: string; destinations: string[]; memberPhones: string[]; image?: string }) => Promise<Trip>;
  deleteTrip: (id: string) => Promise<void>;
  addActivity: (tripId: string, data: Omit<Activity, 'id' | 'tripId'>) => Promise<void>;
  updateActivity: (tripId: string, actId: string, data: Partial<Activity>) => Promise<void>;
  deleteActivity: (tripId: string, actId: string) => Promise<void>;
  addChecklistItem: (tripId: string, data: Omit<ChecklistItem, 'id' | 'tripId'>) => Promise<void>;
  updateChecklistItem: (tripId: string, itemId: string, data: Partial<ChecklistItem>) => Promise<void>;
  deleteChecklistItem: (tripId: string, itemId: string) => Promise<void>;
  addExpense: (tripId: string, data: Omit<Expense, 'id' | 'tripId'>) => Promise<void>;
  updateExpense: (tripId: string, expId: string, data: Partial<Expense>) => Promise<void>;
  deleteExpense: (tripId: string, expId: string) => Promise<void>;
  addMember: (tripId: string, phone: string) => Promise<boolean>;
  removeMember: (tripId: string, memberId: string) => Promise<void>;
  promoteMember: (tripId: string, memberId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

// ─── Demo / Offline mock data ─────────────────────────────────────────────────

const MOCK_TRIPS: Trip[] = [
  {
    id: 'trip-1', name: 'Đà Lạt Summer 2025',
    startDate: '28/06/2025', endDate: '04/07/2025',
    description: 'Chuyến đi hè với những người bạn thân...', destinations: ['Đà Lạt'],
    memberCount: 4, status: 'UPCOMING',
    image: getTripImage(['Đà Lạt']),
    members: [
      { id: 'm1', name: 'Alex Nguyen', phone: '+84901234567', role: 'leader', initials: 'AN' },
      { id: 'm2', name: 'Bao Tran', phone: '+84912345678',  role: 'member', initials: 'BT' },
      { id: 'm3', name: 'Cô Nguyen', phone: '+84923456789', role: 'member', initials: 'CN' },
      { id: 'm4', name: 'Minh Le',   phone: '+84934567890', role: 'member', initials: 'ML' },
    ],
    activities: [
      { id: 'a1', tripId: 'trip-1', name: 'Khởi hành từ TP.HCM', location: 'Sân bay Tân Sơn Nhất', date: '28/06/2025', time: '06:00', type: ['Di chuyển'], participants: ['m1','m2','m3','m4'], note: '' },
      { id: 'a2', tripId: 'trip-1', name: 'Tham quan Hồ Xuân Hương', location: 'Trung tâm TP. Đà Lạt', date: '30/06/2025', time: '15:00', type: ['Tham quan'], participants: ['m1','m2','m3'], note: 'Mang theo ô vì trời có thể mưa.' },
      { id: 'a3', tripId: 'trip-1', name: 'Cáp treo Langbiang', location: 'Núi Langbiang', date: '01/07/2025', time: '08:00', type: ['Tham quan', 'Vui chơi'], participants: ['m1','m2','m3','m4'], note: 'Đặt vé trước online' },
    ],
    checklist: [
      { id: 'c1', tripId: 'trip-1', name: 'Lều cắm trại',    category: 'shared',   assignee: 'Alex', dueDate: '27/06/2025', note: '', completed: false },
      { id: 'c2', tripId: 'trip-1', name: 'Bộ sơ cứu',       category: 'shared',   assignee: 'Bao',  dueDate: '27/06/2025', note: '', completed: true  },
      { id: 'c3', tripId: 'trip-1', name: 'Máy ảnh',         category: 'personal', assignee: 'Cô',   dueDate: '27/06/2025', note: '', completed: false },
      { id: 'c4', tripId: 'trip-1', name: 'Đặt xe limousine',category: 'todo',     assignee: 'Minh', dueDate: '25/06/2025', note: '', completed: true  },
    ],
    expenses: [
      { id: 'e1', tripId: 'trip-1', name: 'Xe limousine',  amount: 1200000, category: 'Di chuyển', paidBy: 'Bao',  date: '28/06/2025', splitType: 'equal', participants: ['m1','m2','m3','m4'], splits: [] },
      { id: 'e2', tripId: 'trip-1', name: 'Khách sạn Ana', amount: 4800000, category: 'Chỗ ở',     paidBy: 'Alex', date: '29/06/2025', splitType: 'equal', participants: ['m1','m2','m3','m4'], splits: [] },
      { id: 'e3', tripId: 'trip-1', name: 'Vé cáp treo',   amount: 900000,  category: 'Vui chơi',  paidBy: 'Cô',   date: '01/07/2025', splitType: 'equal', participants: ['m1','m2','m3','m4'], splits: [] },
    ],
  },
  {
    id: 'trip-2', name: 'Phú Quốc Tour',
    startDate: '10/07/2025', endDate: '13/07/2025',
    description: 'Khám phá đảo ngọc Phú Quốc', destinations: ['Phú Quốc'],
    memberCount: 2, status: 'DONE',
    image: getTripImage(['Phú Quốc']),
    members: [
      { id: 'm5', name: 'Alex Nguyen', phone: '+84901234567', role: 'leader', initials: 'AN' },
      { id: 'm6', name: 'Bao Tran',    phone: '+84912345678', role: 'member', initials: 'BT' },
    ],
    activities: [], checklist: [], expenses: [],
  },
];

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [trips, setTrips]     = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);

  // ── Bootstrap ────────────────────────────────────────────────────────────────

  useEffect(() => { bootstrap(); }, []);

  const bootstrap = async () => {
    analytics.init();
    console.log('[App] Bootstrapping...');

    try {
      const token = await getToken();
      if (token) {
        try {
          const [userData, tripsData] = await Promise.all([api.auth.me(), api.trips.list()]);
          setUser(userData);
          setTrips(tripsData);
          setIsOnline(true);
          await Promise.all([
            AsyncStorage.setItem(USER_CACHE_KEY,  JSON.stringify(userData)),
            AsyncStorage.setItem(TRIPS_CACHE_KEY, JSON.stringify(tripsData)),
          ]);
          analytics.identify(userData.id, { email: userData.email });
          console.log('[App] Online – loaded', tripsData.length, 'trips for', userData.email);
        } catch (apiErr: any) {
          // Network error – try cache
          console.warn('[App] API unreachable, loading cache. Reason:', apiErr?.message);
          const [cu, ct] = await Promise.all([
            AsyncStorage.getItem(USER_CACHE_KEY),
            AsyncStorage.getItem(TRIPS_CACHE_KEY),
          ]);
          if (cu) setUser(JSON.parse(cu));
          setTrips(ct ? JSON.parse(ct) : MOCK_TRIPS);
          setIsOnline(false);
        }
      } else {
        // Not logged in – show mock data so app is usable in demo mode
        console.log('[App] No token – showing demo data');
        const ct = await AsyncStorage.getItem(TRIPS_CACHE_KEY);
        setTrips(ct ? JSON.parse(ct) : MOCK_TRIPS);
      }
    } catch (err: any) {
      console.error('[App] Bootstrap unexpected error:', err.message);
      setTrips(MOCK_TRIPS);
    } finally {
      setLoading(false);
    }
  };

  // ── Refresh trips ─────────────────────────────────────────────────────────────

  const refreshTrips = useCallback(async () => {
    if (!isOnline) {
      console.warn('[App] refreshTrips: offline, skipping');
      return;
    }
    try {
      const data = await api.trips.list();
      setTrips(data);
      await AsyncStorage.setItem(TRIPS_CACHE_KEY, JSON.stringify(data));
      console.log('[App] refreshTrips: loaded', data.length, 'trips');
    } catch (err: any) {
      console.error('[App] refreshTrips error:', err.message);
    }
  }, [isOnline]);

  // ── Auth ──────────────────────────────────────────────────────────────────────

  const signIn = async (emailOrPhone: string, password: string): Promise<boolean> => {
    console.log('[Auth] Attempting sign-in:', emailOrPhone);
    try {
      const { token, user: userData } = await api.auth.login(emailOrPhone, password);
      await setToken(token);
      setUser(userData);
      setIsOnline(true);
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
      const tripsData = await api.trips.list();
      setTrips(tripsData);
      await AsyncStorage.setItem(TRIPS_CACHE_KEY, JSON.stringify(tripsData));
      analytics.identify(userData.id, { email: userData.email });
      analytics.track('sign_in', { method: 'email_phone' });
      console.log('[Auth] Sign-in success:', userData.email);
      return true;
    } catch (err: any) {
      console.warn('[Auth] Sign-in failed:', err.message);
      // Offline demo fallback
      if (emailOrPhone === 'demo@tripmate.app' && password === 'Demo@123') {
        console.log('[Auth] Using offline demo credentials');
        const demoUser: User = {
          id: 'demo', email: 'demo@tripmate.app',
          username: 'Demo User', phone: '+84900000000',
        };
        setUser(demoUser);
        setTrips(MOCK_TRIPS);
        await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(demoUser));
        await AsyncStorage.setItem(TRIPS_CACHE_KEY, JSON.stringify(MOCK_TRIPS));
        return true;
      }
      return false;
    }
  };

  const signUp = async (email: string, username: string, phone: string, password: string): Promise<boolean> => {
    console.log('[Auth] Attempting registration:', email);
    try {
      const { token, user: userData } = await api.auth.register(email, username, phone, password);
      await setToken(token);
      setUser(userData);
      setIsOnline(true);
      setTrips([]);
      analytics.identify(userData.id, { email: userData.email });
      analytics.track('sign_up');
      console.log('[Auth] Registration success:', email);
      return true;
    } catch (err: any) {
      console.error('[Auth] Registration error:', err?.data?.error || err.message);
      throw err; // Let the form handle the error message
    }
  };

  const signOut = async () => {
    console.log('[Auth] Signing out');
    await clearToken();
    await AsyncStorage.multiRemove([USER_CACHE_KEY, TRIPS_CACHE_KEY]);
    setUser(null);
    setTrips(MOCK_TRIPS);
    setIsOnline(false);
    analytics.reset();
  };

  const updateUser = async (data: Partial<User>) => {
    try {
      if (isOnline) {
        const updated = await api.auth.updateProfile(data);
        setUser(updated);
        await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(updated));
        console.log('[Auth] Profile updated');
      } else if (user) {
        console.warn('[Auth] updateUser: offline, updating local only');
        const updated = { ...user, ...data };
        setUser(updated);
        await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(updated));
      }
    } catch (err: any) {
      console.error('[Auth] updateUser error:', err.message);
      throw err;
    }
  };

  const changePassword = async (current: string, newPwd: string): Promise<boolean> => {
    try {
      await api.auth.changePassword(current, newPwd);
      analytics.track('change_password');
      console.log('[Auth] Password changed');
      return true;
    } catch (err: any) {
      console.error('[Auth] changePassword error:', err?.data?.error || err.message);
      return false;
    }
  };

  // ── Trip helpers ──────────────────────────────────────────────────────────────

  const getTrip = (id: string): Trip | undefined => {
    const t = trips.find(t => t.id === id);
    if (!t) {
      console.warn('[App] getTrip: not found id=', id);
      return undefined;
    }
    return { ...t, status: computeTripStatus(t.startDate, t.endDate) };
  };

  /** Optimistic local update + persist cache */
  const updateLocalTrip = (id: string, updater: (t: Trip) => Trip) => {
    setTrips(prev => {
      const next = prev.map(t => (t.id === id ? updater(t) : t));
      AsyncStorage.setItem(TRIPS_CACHE_KEY, JSON.stringify(next)).catch(e =>
        console.warn('[Cache] setItem error:', e.message)
      );
      return next;
    });
  };

  // ── Trips CRUD ────────────────────────────────────────────────────────────────

  const createTrip = async (data: { name: string; startDate: string; endDate: string; description: string; destinations: string[]; memberPhones: string[] }): Promise<Trip> => {
    analytics.track('create_trip', { name: data.name, destinations: data.destinations });
    if (isOnline) {
      try {
        const trip = await api.trips.create(data);
        setTrips(prev => [trip, ...prev]);
        await AsyncStorage.setItem(TRIPS_CACHE_KEY, JSON.stringify([trip, ...trips]));
        console.log('[Trip] Created online:', trip.id);
        return trip;
      } catch (err: any) {
        console.error('[Trip] createTrip API error:', err?.data?.error || err.message);
        throw err;
      }
    }
    // Offline
    console.warn('[Trip] createTrip: offline, creating locally');
    const newTrip: Trip = {
      id: uid(), ...data,
      memberCount: 1 + data.memberPhones.length,
      status: 'UPCOMING',
      image: getTripImage(data.destinations),
      members: [
        { id: uid(), name: user?.username || 'Bạn', phone: user?.phone || '', role: 'leader', initials: getInitials(user?.username || 'B') },
        ...data.memberPhones.map(p => ({ id: uid(), name: p, phone: p, role: 'member' as const, initials: p.slice(-2) })),
      ],
      activities: [], checklist: [], expenses: [],
    };
    setTrips(prev => [newTrip, ...prev]);
    return newTrip;
  };

  const deleteTrip = async (id: string) => {
    setTrips(prev => prev.filter(t => t.id !== id));
    await AsyncStorage.setItem(TRIPS_CACHE_KEY, JSON.stringify(trips.filter(t => t.id !== id)));
    if (isOnline) {
      try {
        await api.trips.delete(id);
        analytics.track('delete_trip', { tripId: id });
        console.log('[Trip] Deleted online:', id);
      } catch (err: any) {
        console.error('[Trip] deleteTrip error:', err.message);
      }
    }
  };

  // ── Activities ────────────────────────────────────────────────────────────────

  const addActivity = async (tripId: string, data: Omit<Activity, 'id' | 'tripId'>) => {
    if (!data.name?.trim()) {
      console.warn('[Activity] addActivity: name is required');
      throw new Error('Tên hoạt động là bắt buộc');
    }
    const tempId = uid();
    updateLocalTrip(tripId, t => ({ ...t, activities: [...t.activities, { id: tempId, tripId, ...data }] }));
    if (isOnline) {
      try {
        const act = await api.activities.add(tripId, data);
        updateLocalTrip(tripId, t => ({ ...t, activities: t.activities.map(a => a.id === tempId ? { ...act, id: act.id || act._id || tempId } : a) }));
        analytics.track('add_activity', { tripId, name: data.name });
        console.log('[Activity] Added:', data.name, 'to trip', tripId);
      } catch (err: any) {
        console.error('[Activity] addActivity API error:', err.message);
      }
    }
  };

  const updateActivity = async (tripId: string, actId: string, data: Partial<Activity>) => {
    updateLocalTrip(tripId, t => ({ ...t, activities: t.activities.map(a => a.id === actId ? { ...a, ...data } : a) }));
    if (isOnline) {
      try { await api.activities.update(tripId, actId, data); }
      catch (err: any) { console.error('[Activity] updateActivity error:', err.message); }
    }
  };

  const deleteActivity = async (tripId: string, actId: string) => {
    updateLocalTrip(tripId, t => ({ ...t, activities: t.activities.filter(a => a.id !== actId) }));
    if (isOnline) {
      try { await api.activities.delete(tripId, actId); analytics.track('delete_activity', { tripId, actId }); }
      catch (err: any) { console.error('[Activity] deleteActivity error:', err.message); }
    }
  };

  // ── Checklist ─────────────────────────────────────────────────────────────────

  const addChecklistItem = async (tripId: string, data: Omit<ChecklistItem, 'id' | 'tripId'>) => {
    if (!data.name?.trim()) {
      console.warn('[Checklist] addChecklistItem: name is required');
      throw new Error('Tên mục là bắt buộc');
    }
    const tempId = uid();
    updateLocalTrip(tripId, t => ({ ...t, checklist: [...t.checklist, { id: tempId, tripId, ...data }] }));
    if (isOnline) {
      try {
        const item = await api.checklist.add(tripId, data);
        updateLocalTrip(tripId, t => ({ ...t, checklist: t.checklist.map(c => c.id === tempId ? { ...item, id: item.id || item._id || tempId } : c) }));
        console.log('[Checklist] Added:', data.name);
      } catch (err: any) {
        console.error('[Checklist] addChecklistItem API error:', err.message);
      }
    }
  };

  const updateChecklistItem = async (tripId: string, itemId: string, data: Partial<ChecklistItem>) => {
    updateLocalTrip(tripId, t => ({ ...t, checklist: t.checklist.map(c => c.id === itemId ? { ...c, ...data } : c) }));
    if (isOnline) {
      try { await api.checklist.update(tripId, itemId, data); }
      catch (err: any) { console.error('[Checklist] updateChecklistItem error:', err.message); }
    }
  };

  const deleteChecklistItem = async (tripId: string, itemId: string) => {
    updateLocalTrip(tripId, t => ({ ...t, checklist: t.checklist.filter(c => c.id !== itemId) }));
    if (isOnline) {
      try { await api.checklist.delete(tripId, itemId); }
      catch (err: any) { console.error('[Checklist] deleteChecklistItem error:', err.message); }
    }
  };

  // ── Expenses ──────────────────────────────────────────────────────────────────

  const addExpense = async (tripId: string, data: Omit<Expense, 'id' | 'tripId'>) => {
    if (!data.name?.trim()) {
      console.warn('[Expense] addExpense: name is required');
      throw new Error('Tên khoản chi là bắt buộc');
    }
    if (!data.amount || data.amount <= 0) {
      console.warn('[Expense] addExpense: invalid amount', data.amount);
      throw new Error('Số tiền phải lớn hơn 0');
    }
    const tempId = uid();
    updateLocalTrip(tripId, t => ({ ...t, expenses: [...t.expenses, { id: tempId, tripId, ...data }] }));
    if (isOnline) {
      try {
        const exp = await api.expenses.add(tripId, data);
        updateLocalTrip(tripId, t => ({ ...t, expenses: t.expenses.map(e => e.id === tempId ? { ...exp, id: exp.id || exp._id || tempId } : e) }));
        analytics.track('add_expense', { tripId, amount: data.amount, category: data.category });
        console.log('[Expense] Added:', data.name, data.amount, 'đ');
      } catch (err: any) {
        console.error('[Expense] addExpense API error:', err.message);
      }
    }
  };

  const updateExpense = async (tripId: string, expId: string, data: Partial<Expense>) => {
    updateLocalTrip(tripId, t => ({ ...t, expenses: t.expenses.map(e => e.id === expId ? { ...e, ...data } : e) }));
    if (isOnline) {
      try { await api.expenses.update(tripId, expId, data); }
      catch (err: any) { console.error('[Expense] updateExpense error:', err.message); }
    }
  };

  const deleteExpense = async (tripId: string, expId: string) => {
    updateLocalTrip(tripId, t => ({ ...t, expenses: t.expenses.filter(e => e.id !== expId) }));
    if (isOnline) {
      try { await api.expenses.delete(tripId, expId); }
      catch (err: any) { console.error('[Expense] deleteExpense error:', err.message); }
    }
  };

  // ── Members ───────────────────────────────────────────────────────────────────

  const addMember = async (tripId: string, phone: string): Promise<boolean> => {
    if (!phone.trim()) {
      console.warn('[Member] addMember: phone is required');
      return false;
    }
    const trip = trips.find(t => t.id === tripId);
    if (trip?.members.find(m => m.phone === phone)) {
      console.warn('[Member] addMember: phone already a member:', phone);
      return false;
    }
    if (isOnline) {
      try {
        await api.members.add(tripId, phone);
        await refreshTrips();
        analytics.track('add_member', { tripId, phone });
        console.log('[Member] Added phone:', phone, 'to trip:', tripId);
        return true;
      } catch (err: any) {
        console.error('[Member] addMember API error:', err?.data?.error || err.message);
        return false;
      }
    }
    // Offline
    console.warn('[Member] addMember: offline, adding locally');
    updateLocalTrip(tripId, t => ({
      ...t,
      members: [...t.members, { id: uid(), name: phone, phone, role: 'member', initials: phone.slice(-2) }],
    }));
    return true;
  };

  const removeMember = async (tripId: string, memberId: string) => {
    updateLocalTrip(tripId, t => ({ ...t, members: t.members.filter(m => m.id !== memberId) }));
    if (isOnline) {
      try { await api.members.remove(tripId, memberId); }
      catch (err: any) { console.error('[Member] removeMember error:', err.message); }
    }
  };

  const promoteMember = async (tripId: string, memberId: string) => {
    updateLocalTrip(tripId, t => ({
      ...t,
      members: t.members.map(m => ({
        ...m,
        role: m.id === memberId ? 'leader' : (m.role === 'leader' ? 'member' : m.role),
      })) as Member[],
    }));
    if (isOnline) {
      try { await api.members.promote(tripId, memberId); }
      catch (err: any) { console.error('[Member] promoteMember error:', err.message); }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <AppContext.Provider value={{
      user, trips, loading, isOnline,
      signIn, signUp, signOut, updateUser, changePassword, refreshTrips,
      getTrip, createTrip, deleteTrip,
      addActivity, updateActivity, deleteActivity,
      addChecklistItem, updateChecklistItem, deleteChecklistItem,
      addExpense, updateExpense, deleteExpense,
      addMember, removeMember, promoteMember,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
