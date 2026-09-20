import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useState,} from 'react';
import api, { clearToken, getToken, setToken } from '../services/api';
import analytics from '../services/analytics';
import { Activity, ChecklistItem, Expense, Member, Trip, User } from '../types';
import {computeTripStatus, getTripImage, getInitials, daysUntil} from "../utils/helpers";import { logAction, logError, logInfo, logWarn, logDebug } from '../utils/logger';

const TRIPS_CACHE_KEY = 'tripmate_trips_v2';
const USER_CACHE_KEY  = 'tripmate_user_v2';

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

export type Notif = {
  id: string;
  tripId: string;
  type: string;
  title: string;
  body: string;
  time: string;
  icon: any;
  iconBg: string;
  iconColor: string;
  read: boolean;
};

// ─── Context interface ────────────────────────────────────────────────────────

interface AppContextType {
  user: User | null;
  trips: Trip[];
  loading: boolean;
  isOnline: boolean;
  notifications: Notif[];
  readIds: Set<string>;
  unreadCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  signIn: (emailOrPhone: string, password: string) => Promise<boolean>;
  signUp: (
    email: string,
    username: string,
    phone: string,
    password: string,
  ) => Promise<boolean>;
  signOut: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  changePassword: (
    current: string,
    newPwd: string,
  ) => Promise<{
    success: boolean;
    message: string;
  }>;
  deleteAccount: () => Promise<boolean>;
  refreshTrips: () => Promise<void>;
  getTrip: (id: string) => Trip | undefined;
  createTrip: (data: {
    name: string;
    startDate: string;
    endDate: string;
    description: string;
    destinations: string[];
    memberPhones: string[];
    image?: string;
  }) => Promise<Trip>;
  deleteTrip: (id: string) => Promise<void>;
  joinTrip: (inviteCode: string) => Promise<Trip | null>;
  findUser: (query: string) => Promise<any | null>;
  updateTrip: (
    id: string,
    data: Partial<{
      name: string;
      startDate: string;
      endDate: string;
      description: string;
      destinations: string[];
      image?: string;
    }>,
  ) => Promise<void>;
  addActivity: (
    tripId: string,
    data: Omit<Activity, "id" | "tripId">,
  ) => Promise<void>;
  updateActivity: (
    tripId: string,
    actId: string,
    data: Partial<Activity>,
  ) => Promise<void>;
  deleteActivity: (tripId: string, actId: string) => Promise<void>;
  addChecklistItem: (
    tripId: string,
    data: Omit<ChecklistItem, "id" | "tripId">,
  ) => Promise<void>;
  updateChecklistItem: (
    tripId: string,
    itemId: string,
    data: Partial<ChecklistItem>,
  ) => Promise<void>;
  deleteChecklistItem: (tripId: string, itemId: string) => Promise<void>;
  addExpense: (
    tripId: string,
    data: Omit<Expense, "id" | "tripId">,
  ) => Promise<void>;
  updateExpense: (
    tripId: string,
    expId: string,
    data: Partial<Expense>,
  ) => Promise<void>;
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
    inviteCode: 'DALAT1',
    image: getTripImage(['Đà Lạt']),
    members: [
      { id: 'm1', name: 'Alex Nguyen', phone: '+84901234567', role: 'leader', initials: 'AN' },
      { id: 'm2', name: 'Bao Tran',    phone: '+84912345678', role: 'member', initials: 'BT' },
      { id: 'm3', name: 'Cô Nguyen',  phone: '+84923456789', role: 'member', initials: 'CN' },
      { id: 'm4', name: 'Minh Le',     phone: '+84934567890', role: 'member', initials: 'ML' },
    ],
    activities: [
      { id: 'a1', tripId: 'trip-1', name: 'Khởi hành từ TP.HCM', location: 'Sân bay Tân Sơn Nhất', date: '28/06/2025', time: '06:00', type: ['Di chuyển'], participants: ['m1','m2','m3','m4'], note: '' },
      { id: 'a2', tripId: 'trip-1', name: 'Tham quan Hồ Xuân Hương', location: 'Trung tâm TP. Đà Lạt', date: '30/06/2025', time: '15:00', type: ['Tham quan'], participants: ['m1','m2','m3'], note: 'Mang theo ô vì trời có thể mưa.' },
    ],
    checklist: [
      { id: 'c1', tripId: 'trip-1', name: 'Lều cắm trại',     category: 'shared',   assignee: 'Alex', dueDate: '27/06/2025', note: '', completed: false },
      { id: 'c2', tripId: 'trip-1', name: 'Bộ sơ cứu',        category: 'shared',   assignee: 'Bao',  dueDate: '27/06/2025', note: '', completed: true  },
      { id: 'c3', tripId: 'trip-1', name: 'Đặt xe limousine', category: 'todo',     assignee: 'Minh', dueDate: '25/06/2025', note: '', completed: true  },
    ],
    expenses: [
      { id: 'e1', tripId: 'trip-1', name: 'Xe limousine',  amount: 1200000, category: 'Di chuyển', paidBy: 'm2',  date: '28/06/2025', splitType: 'equal', participants: ['m1','m2','m3','m4'], splits: [] },
      { id: 'e2', tripId: 'trip-1', name: 'Khách sạn Ana', amount: 4800000, category: 'Chỗ ở',     paidBy: 'm1', date: '29/06/2025', splitType: 'equal', participants: ['m1','m2','m3','m4'], splits: [] },
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
    const [readIds, setReadIds] = useState<Set<string>>(() => new Set());

    // Reset read status when the account changes.
    useEffect(() => {
      setReadIds(new Set());
    }, [user?.id]);

    const notifications: Notif[] = useMemo(() => {
        const list: Notif[] = [];
        trips.forEach(trip => {
          const status = computeTripStatus(trip.startDate, trip.endDate);
          const days   = daysUntil(trip.startDate);
    
          if (status === 'ONGOING') {
            list.push({
              id: `ongoing-${trip.id}`, tripId: trip.id, type: 'ongoing',
              title: `Chuyến đi đang diễn ra`,
              body: `"${trip.name}" đang trong hành trình. Chúc bạn có chuyến đi vui vẻ!`,
              time: 'Hôm nay',
              icon: 'airplane', iconBg: '#EFF6FF', iconColor: '#3B82F6', read: false,
            });
          }
          if (status === 'UPCOMING' && days > 0 && days <= 7) {
            list.push({
              id: `upcoming-${trip.id}`, tripId: trip.id, type: 'reminder',
              title: `Còn ${days} ngày nữa khởi hành!`,
              body: `"${trip.name}" sẽ bắt đầu vào ${trip.startDate}. Hãy kiểm tra checklist của bạn.`,
              time: days <= 1 ? 'Hôm nay' : `${days} ngày trước`,
              icon: 'time', iconBg: '#FEF3C7', iconColor: '#F59E0B', read: false,
            });
          }
          if (status === 'DONE') {
            list.push({
              id: `done-${trip.id}`, tripId: trip.id, type: 'done',
              title: `Chuyến đi hoàn thành`,
              body: `"${trip.name}" đã kết thúc. Hãy xem tổng kết chi phí!`,
              time: trip.endDate,
              icon: 'checkmark-circle', iconBg: '#ECFDF5', iconColor: '#10B981', read: false,
            });
          }
          const pending = trip.checklist.filter(c => !c.completed).length;
          if (pending > 0 && status === 'UPCOMING' && days <= 3 && days >= 0) {
            list.push({
              id: `checklist-${trip.id}`, tripId: trip.id, type: 'checklist',
              title: `Còn ${pending} mục chưa hoàn thành`,
              body: `Checklist của "${trip.name}" vẫn còn ${pending} việc cần làm trước khi đi.`,
              time: 'Vừa xong',
              icon: 'checkbox-outline', iconBg: '#F3E8FF', iconColor: '#8B5CF6', read: false,
            });
          }
          const total = trip.expenses.reduce((s, e) => s + e.amount, 0);
          if (total > 0 && status === 'DONE') {
            list.push({
              id: `expense-${trip.id}`, tripId: trip.id, type: 'expense',
              title: `Tổng kết chi phí`,
              body: `Chuyến "${trip.name}" tốn ${total.toLocaleString('vi-VN')} đ — ${trip.members.length} người tham gia.`,
              time: trip.endDate,
              icon: 'wallet', iconBg: '#FEE2E2', iconColor: '#EF4444', read: false,
            });
          }
        });
    
        if (list.length === 0) {
          list.push({
            id: 'welcome', tripId: '', type: 'welcome',
            title: 'Chào mừng đến với TripMate! 🎉',
            body: 'Tạo chuyến đi đầu tiên của bạn và bắt đầu lên kế hoạch cùng bạn bè.',
            time: 'Hôm nay',
            icon: 'sparkles', iconBg: '#EFF6FF', iconColor: '#1B4F8A', read: false,
          });
        }
        return list;
      }, [trips]);

    const unreadCount = notifications.filter(
      (notification) => !readIds.has(notification.id),
    ).length;

    const markNotificationRead = (id: string) => {
      setReadIds((previous) => {
        if (previous.has(id)) return previous;
        return new Set([...previous, id]);
      });
    };

    const markAllNotificationsRead = () => {
      setReadIds(
        (previous) =>
          new Set([
            ...previous,
            ...notifications.map((notification) => notification.id),
          ]),
      );
    };
    // ── Bootstrap ────────────────────────────────────────────────────────────────

    useEffect(() => { bootstrap(); }, []);

    const bootstrap = async () => {
      analytics.init();
      logInfo('App', 'Bootstrapping...');
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
            logInfo('App', `Online – loaded ${tripsData.length} trips for ${userData.email}`);
          } catch (apiErr: any) {
            logWarn('App', 'API unreachable, loading cache. Reason: ' + apiErr?.message);
            const [cu, ct] = await Promise.all([
              AsyncStorage.getItem(USER_CACHE_KEY),
              AsyncStorage.getItem(TRIPS_CACHE_KEY),
            ]);
            if (cu) setUser(JSON.parse(cu));
            setTrips(ct ? JSON.parse(ct) : MOCK_TRIPS);
            setIsOnline(false);
          }
        } else {
          logInfo('App', 'No token – showing demo data');
          const ct = await AsyncStorage.getItem(TRIPS_CACHE_KEY);
          setTrips(ct ? JSON.parse(ct) : MOCK_TRIPS);
        }
      } catch (err: any) {
        logError('App', 'Bootstrap unexpected error', err);
        setTrips(MOCK_TRIPS);
      } finally {
        setLoading(false);
      }
    };

  // ── Refresh trips ─────────────────────────────────────────────────────────────

  const refreshTrips = useCallback(async () => {
    if (!isOnline) {
      logWarn('App', 'refreshTrips: offline, skipping');
      return;
    }
    try {
      const data = await api.trips.list();
      setTrips(data);
      await AsyncStorage.setItem(TRIPS_CACHE_KEY, JSON.stringify(data));
      logInfo('App', `refreshTrips: loaded ${data.length} trips`);
    } catch (err: any) {
      logError('App', 'refreshTrips error', err);
    }
  }, [isOnline]);

  // ── Auth ──────────────────────────────────────────────────────────────────────

  const signIn = async (emailOrPhone: string, password: string): Promise<boolean> => {
    if (!emailOrPhone.trim()) {
      logWarn('Auth', 'signIn: emailOrPhone is empty');
      return false;
    }
    if (!password) {
      logWarn('Auth', 'signIn: password is empty');
      return false;
    }
    logAction('Auth', 'Attempting sign-in: ' + emailOrPhone);
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
      logInfo('Auth', 'Sign-in success: ' + userData.email);
      return true;
    } catch (err: any) {
      logWarn('Auth', 'Sign-in failed: ' + (err?.data?.error || err.message));
      // Offline demo fallback
      if (emailOrPhone === 'demo@tripmate.app' && password === 'Demo@123') {
        logInfo('Auth', 'Using offline demo credentials');
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
    if (!email.trim() || !username.trim() || !phone.trim() || !password) {
      logWarn('Auth', 'signUp: missing required fields');
      throw new Error('Vui lòng điền đầy đủ thông tin');
    }
    if (password.length < 6) {
      logWarn('Auth', 'signUp: password too short');
      throw new Error('Mật khẩu phải có ít nhất 6 ký tự');
    }
    logAction('Auth', 'Attempting registration: ' + email);
    try {
      const { token, user: userData } = await api.auth.register(email, username, phone, password);
      await setToken(token);
      setUser(userData);
      setIsOnline(true);
      setTrips([]);
      analytics.identify(userData.id, { email: userData.email });
      analytics.track('sign_up');
      logInfo('Auth', 'Registration success: ' + email);
      return true;
    } catch (err: any) {
      logError('Auth', 'Registration error', err?.data?.error || err.message);
      throw err;
    }
  };

  const signOut = async () => {
    logAction('Auth', 'Signing out user: ' + (user?.email || 'unknown'));
    try {
      // 1. Xóa token (SecureStore trên native, localStorage trên web)
      await clearToken();

      // 2. Xóa AsyncStorage cache
      await AsyncStorage.multiRemove([USER_CACHE_KEY, TRIPS_CACHE_KEY]);

      // 3. Trên web (localhost) token dùng localStorage — xóa thêm để chắc chắn
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('tripmate_token');
        window.localStorage.removeItem(USER_CACHE_KEY);
        window.localStorage.removeItem(TRIPS_CACHE_KEY);
        // Xóa tất cả key của tripmate trong localStorage
        Object.keys(window.localStorage)
          .filter(k => k.startsWith('tripmate_'))
          .forEach(k => window.localStorage.removeItem(k));
      }

      // 4. Reset state
      setUser(null);
      setTrips([]);
      setIsOnline(false);
      analytics.reset();
      logInfo('Auth', 'Signed out successfully — all storage cleared');
    } catch (err: any) {
      logError('Auth', 'signOut error', err);
      // Dù lỗi vẫn phải clear state
      setUser(null);
      setTrips([]);
      setIsOnline(false);
    }
  };

  const updateUser = async (data: Partial<User>) => {
    if (!user) {
      logWarn('Auth', 'updateUser: no user logged in');
      return;
    }
    try {
      if (isOnline) {
        const updated = await api.auth.updateProfile(data);
        setUser(updated);
        await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(updated));
        logInfo('Auth', 'Profile updated');
      } else {
        logWarn('Auth', 'updateUser: offline, updating local only');
        const updated = { ...user, ...data };
        setUser(updated);
        await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(updated));
      }
    } catch (err: any) {
      logError('Auth', 'updateUser error', err);
      throw err;
    }
  };

  const changePassword = async (
  current: string,
  newPwd: string
): Promise<{
  success: boolean;
  message: string;
}> => {
  if (!current || !newPwd) {
    logWarn(
      'Auth',
      'changePassword: missing fields'
    );

    return {
      success: false,
      message: 'Vui lòng nhập đầy đủ thông tin',
    };
  }

  if (newPwd.length < 6) {
    logWarn(
      'Auth',
      'changePassword: new password too short'
    );

    return {
      success: false,
      message:
        'Mật khẩu mới phải có ít nhất 6 ký tự',
    };
  }

  if (current === newPwd) {
    logWarn(
      'Auth',
      'changePassword: new password same as current'
    );

    return {
      success: false,
      message:
        'Mật khẩu mới không được trùng mật khẩu cũ',
    };
  }

  try {
    console.log('Changing password...');

    await api.auth.changePassword(
      current,
      newPwd
    );

    analytics.track('change_password');

    logInfo(
      'Auth',
      'Password changed successfully'
    );

    return {
      success: true,
      message: 'Đổi mật khẩu thành công',
    };
  } catch (err: any) {
    logError(
      'Auth',
      'changePassword error',
      err?.data?.error || err.message
    );

    return {
      success: false,
      message:
        err?.response?.data?.message ||
        'Mật khẩu hiện tại không đúng',
    };
  }
};

const deleteAccount = async (): Promise<boolean> => {
  try {
    if (!user) {
      logWarn(
        'Auth',
        'deleteAccount: no user'
      );

      return false;
    }

    console.log(
      'Deleting account:',
      user.id
    );

    if (isOnline) {
      await api.auth.deleteAccount();
    }

    await signOut();

    analytics.track('delete_account');

    logInfo(
      'Auth',
      'Account deleted successfully'
    );

    return true;
  } catch (err: any) {
    logError(
      'Auth',
      'deleteAccount error',
      err?.response?.data || err.message
    );

    return false;
  }
};


  // ── Update trip ───────────────────────────────────────────────────────────────

  const updateTrip = async (id: string, data: Partial<{
    name: string; startDate: string; endDate: string;
    description: string; destinations: string[]; image?: string;
  }>) => {
    if (!id) {
      logWarn('Trip', 'updateTrip: id is required');
      return;
    }
    if (data.name !== undefined && !data.name.trim()) {
      logWarn('Trip', 'updateTrip: name cannot be empty');
      throw new Error('Tên chuyến đi không được trống');
    }
    logAction('Trip', `updateTrip: ${id}`, data);
    updateLocalTrip(id, t => ({ ...t, ...data, ...(data.image ? { image: data.image } : {}) }));
    if (isOnline) {
      try {
        await api.trips.update(id, data);
        logInfo('Trip', `Updated trip ${id}`);
      } catch (err: any) {
        logError('Trip', 'updateTrip API error', err?.data?.error || err.message);
      }
    }
  };

  // ── User search ───────────────────────────────────────────────────────────────

  /**
   * Find a user by phone number, email, or keyword.
   * Returns the user object or null if not found / offline.
   */
  const findUser = async (query: string): Promise<any | null> => {
    const q = query.trim();
    if (!q) {
      logWarn('Users', 'findUser: empty query');
      return null;
    }
    if (!isOnline) {
      logWarn('Users', 'findUser: offline – cannot search users');
      return null;
    }
    logAction('Users', `findUser: "${q}"`);
    try {
      const isEmail = q.includes('@');
      const isPhone = /^[0-9+\-\s]{7,}$/.test(q);

      let result: any = null;
      if (isEmail) {
        result = await api.users.findByEmail(q);
      } else if (isPhone) {
        result = await api.users.findByPhone(q);
      } else {
        const results = await api.users.search(q);
        result = results?.[0] || null;
      }

      if (result) {
        logInfo('Users', `findUser: found user "${result.username || result.email}"`);
      } else {
        logWarn('Users', `findUser: no result for "${q}"`);
      }
      return result;
    } catch (err: any) {
      // 404 = not found (not an error)
      if (err?.status === 404 || err?.response?.status === 404) {
        logInfo('Users', `findUser: not found for "${q}"`);
        return null;
      }
      logError('Users', 'findUser API error', err?.data?.error || err.message);
      return null;
    }
  };

  // ── Trip helpers ──────────────────────────────────────────────────────────────

  const getTrip = (id: string): Trip | undefined => {
    const t = trips.find(t => t.id === id);
    if (!t) {
      logWarn('App', `getTrip: not found id=${id}`);
      return undefined;
    }
    return { ...t, status: computeTripStatus(t.startDate, t.endDate) };
  };

  /** Optimistic local update + persist cache */
  const updateLocalTrip = (id: string, updater: (t: Trip) => Trip) => {
    setTrips(prev => {
      const next = prev.map(t => (t.id === id ? updater(t) : t));
      AsyncStorage.setItem(TRIPS_CACHE_KEY, JSON.stringify(next)).catch(e =>
        logWarn('Cache', 'setItem error: ' + e.message)
      );
      return next;
    });
  };

  // ── Trips CRUD ────────────────────────────────────────────────────────────────

  const createTrip = async (data: {
    name: string; startDate: string; endDate: string;
    description: string; destinations: string[]; memberPhones: string[]; image?: string;
  }): Promise<Trip> => {
    if (!data.name?.trim()) {
      logWarn('Trip', 'createTrip: name is required');
      throw new Error('Tên chuyến đi là bắt buộc');
    }
    if (!data.startDate || !data.endDate) {
      logWarn('Trip', 'createTrip: missing dates');
      throw new Error('Ngày bắt đầu và kết thúc là bắt buộc');
    }
    if (!data.destinations || data.destinations.length === 0) {
      logWarn('Trip', 'createTrip: no destinations');
      throw new Error('Vui lòng chọn ít nhất một điểm đến');
    }
    analytics.track('create_trip', { name: data.name, destinations: data.destinations });
    if (isOnline) {
      try {
        const trip = await api.trips.create(data);
        setTrips(prev => [trip, ...prev]);
        await AsyncStorage.setItem(TRIPS_CACHE_KEY, JSON.stringify([trip, ...trips]));
        logInfo('Trip', `Created online: ${trip.id} – "${trip.name}"`);
        return trip;
      } catch (err: any) {
        logError('Trip', 'createTrip API error', err?.data?.error || err.message);
        throw err;
      }
    }
    logWarn('Trip', 'createTrip: offline, creating locally');
    const newTrip: Trip = {
      id: uid(), ...data,
      memberCount: 1 + data.memberPhones.length,
      status: 'UPCOMING',
      image: data.image || getTripImage(data.destinations),
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
    logAction('Trip', `deleteTrip: ${id}`);
    setTrips(prev => prev.filter(t => t.id !== id));
    await AsyncStorage.setItem(TRIPS_CACHE_KEY, JSON.stringify(trips.filter(t => t.id !== id)));
    if (isOnline) {
      try {
        await api.trips.delete(id);
        analytics.track('delete_trip', { tripId: id });
        logInfo('Trip', `Deleted: ${id}`);
      } catch (err: any) {
        logError('Trip', 'deleteTrip error', err.message);
      }
    }
  };

  const joinTrip = async (inviteCode: string): Promise<Trip | null> => {
    if (!inviteCode.trim()) {
      logWarn('Trip', 'joinTrip: inviteCode is empty');
      return null;
    }
    logAction('Trip', `joinTrip: ${inviteCode}`);
    const found = trips.find(t => (t.inviteCode || '').toUpperCase() === inviteCode.toUpperCase());
    if (found) {
      logWarn('Trip', `joinTrip: already a member of trip ${found.id}`);
      return found;
    }
    if (isOnline) {
      try {
        const trip = await api.trips.join(inviteCode);
        const normalized = { ...trip, id: trip.id || trip._id };
        setTrips(prev => {
          if (prev.find(t => t.id === normalized.id)) return prev;
          const next = [...prev, normalized];
          AsyncStorage.setItem(TRIPS_CACHE_KEY, JSON.stringify(next));
          return next;
        });
        analytics.track('join_trip', { inviteCode });
        logInfo('Trip', `Joined trip: ${normalized.id}`);
        return normalized;
      } catch (err: any) {
        logError('Trip', 'joinTrip error', err?.data?.error || err.message);
        return null;
      }
    }
    logWarn('Trip', 'joinTrip: offline, cannot join');
    return null;
  };

  // ── Activities ────────────────────────────────────────────────────────────────

  const addActivity = async (tripId: string, data: Omit<Activity, 'id' | 'tripId'>) => {
    if (!data.name?.trim()) {
      logWarn('Activity', 'addActivity: name is required');
      throw new Error('Tên hoạt động là bắt buộc');
    }
    if (!tripId) {
      logWarn('Activity', 'addActivity: tripId is required');
      throw new Error('Không xác định được chuyến đi');
    }
    const tempId = uid();
    updateLocalTrip(tripId, t => ({ ...t, activities: [...t.activities, { id: tempId, tripId, ...data }] }));
    if (isOnline) {
      try {
        const act = await api.activities.add(tripId, data);
        updateLocalTrip(tripId, t => ({ ...t, activities: t.activities.map(a => a.id === tempId ? { ...act, id: act.id || act._id || tempId } : a) }));
        analytics.track('add_activity', { tripId, name: data.name });
        logInfo('Activity', `Added: "${data.name}" to trip ${tripId}`);
      } catch (err: any) {
        logError('Activity', 'addActivity API error', err.message);
      }
    }
  };

  const updateActivity = async (tripId: string, actId: string, data: Partial<Activity>) => {
    if (!tripId || !actId) {
      logWarn('Activity', 'updateActivity: missing tripId or actId');
      return;
    }
    updateLocalTrip(tripId, t => ({ ...t, activities: t.activities.map(a => a.id === actId ? { ...a, ...data } : a) }));
    if (isOnline) {
      try { await api.activities.update(tripId, actId, data); }
      catch (err: any) { logError('Activity', 'updateActivity error', err.message); }
    }
  };

  const deleteActivity = async (tripId: string, actId: string) => {
    logAction('Activity', `deleteActivity: ${actId} from trip ${tripId}`);
    updateLocalTrip(tripId, t => ({ ...t, activities: t.activities.filter(a => a.id !== actId) }));
    if (isOnline) {
      try { await api.activities.delete(tripId, actId); analytics.track('delete_activity', { tripId, actId }); }
      catch (err: any) { logError('Activity', 'deleteActivity error', err.message); }
    }
  };

  // ── Checklist ─────────────────────────────────────────────────────────────────

  const addChecklistItem = async (tripId: string, data: Omit<ChecklistItem, 'id' | 'tripId'>) => {
    if (!data.name?.trim()) {
      logWarn('Checklist', 'addChecklistItem: name is required');
      throw new Error('Tên mục là bắt buộc');
    }
    const tempId = uid();
    updateLocalTrip(tripId, t => ({ ...t, checklist: [...t.checklist, { id: tempId, tripId, ...data }] }));
    if (isOnline) {
      try {
        const item = await api.checklist.add(tripId, data);
        updateLocalTrip(tripId, t => ({ ...t, checklist: t.checklist.map(c => c.id === tempId ? { ...item, id: item.id || item._id || tempId } : c) }));
        logInfo('Checklist', `Added: "${data.name}"`);
      } catch (err: any) {
        logError('Checklist', 'addChecklistItem API error', err.message);
      }
    }
  };

  const updateChecklistItem = async (tripId: string, itemId: string, data: Partial<ChecklistItem>) => {
    if (!tripId || !itemId) {
      logWarn('Checklist', 'updateChecklistItem: tripId and itemId are required', { tripId, itemId });
      return;
    }
    updateLocalTrip(tripId, t => ({ ...t, checklist: t.checklist.map(c => c.id === itemId ? { ...c, ...data } : c) }));
    if (isOnline) {
      try { await api.checklist.update(tripId, itemId, data); }
      catch (err: any) { logError('Checklist', 'updateChecklistItem error', err.message); }
    }
  };

  const deleteChecklistItem = async (tripId: string, itemId: string) => {
    if (!tripId || !itemId) {
      logWarn('Checklist', 'deleteChecklistItem: tripId and itemId are required', { tripId, itemId });
      return;
    }
    updateLocalTrip(tripId, t => ({ ...t, checklist: t.checklist.filter(c => c.id !== itemId) }));
    if (isOnline) {
      try { await api.checklist.delete(tripId, itemId); }
      catch (err: any) { logError('Checklist', 'deleteChecklistItem error', err.message); }
    }
  };

  // ── Expenses ──────────────────────────────────────────────────────────────────

  const addExpense = async (tripId: string, data: Omit<Expense, 'id' | 'tripId'>) => {
    if (!data.name?.trim()) {
      logWarn('Expense', 'addExpense: name is required');
      throw new Error('Tên khoản chi là bắt buộc');
    }
    if (!data.amount || data.amount <= 0) {
      logWarn('Expense', `addExpense: invalid amount ${data.amount}`);
      throw new Error('Số tiền phải lớn hơn 0');
    }
    if (!data.paidBy?.trim()) {
      logWarn('Expense', 'addExpense: paidBy is required');
      throw new Error('Vui lòng chọn người trả');
    }
    const tempId = uid();
    updateLocalTrip(tripId, t => ({ ...t, expenses: [...t.expenses, { id: tempId, tripId, ...data }] }));
    if (isOnline) {
      try {
        const exp = await api.expenses.add(tripId, data);
        updateLocalTrip(tripId, t => ({ ...t, expenses: t.expenses.map(e => e.id === tempId ? { ...exp, id: exp.id || exp._id || tempId } : e) }));
        analytics.track('add_expense', { tripId, amount: data.amount, category: data.category });
        logInfo('Expense', `Added: "${data.name}" – ${data.amount.toLocaleString('vi-VN')}đ`);
      } catch (err: any) {
        logError('Expense', 'addExpense API error', err.message);
      }
    }
  };

  const updateExpense = async (tripId: string, expId: string, data: Partial<Expense>) => {
    if (data.amount !== undefined && data.amount <= 0) {
      logWarn('Expense', 'updateExpense: invalid amount');
      throw new Error('Số tiền phải lớn hơn 0');
    }
    updateLocalTrip(tripId, t => ({ ...t, expenses: t.expenses.map(e => e.id === expId ? { ...e, ...data } : e) }));
    if (isOnline) {
      try { await api.expenses.update(tripId, expId, data); }
      catch (err: any) { logError('Expense', 'updateExpense error', err.message); }
    }
  };

  const deleteExpense = async (tripId: string, expId: string) => {
    logAction('Expense', `deleteExpense: ${expId} from trip ${tripId}`);
    updateLocalTrip(tripId, t => ({ ...t, expenses: t.expenses.filter(e => e.id !== expId) }));
    if (isOnline) {
      try { await api.expenses.delete(tripId, expId); }
      catch (err: any) { logError('Expense', 'deleteExpense error', err.message); }
    }
  };

  // ── Members ───────────────────────────────────────────────────────────────────

  const addMember = async (tripId: string, phone: string): Promise<boolean> => {
    if (!phone.trim()) {
      logWarn('Member', 'addMember: phone is required');
      return false;
    }
    const trip = trips.find(t => t.id === tripId);
    if (!trip) {
      logWarn('Member', `addMember: trip not found id=${tripId}`);
      return false;
    }
    if (trip.members.find(m => m.phone === phone)) {
      logWarn('Member', `addMember: ${phone} already a member of trip ${tripId}`);
      return false;
    }
    logAction('Member', `addMember: phone=${phone} to trip=${tripId}`);
    if (isOnline) {
      try {
        await api.members.add(tripId, phone);
        await refreshTrips();
        analytics.track('add_member', { tripId, phone });
        logInfo('Member', `Added ${phone} to trip ${tripId}`);
        return true;
      } catch (err: any) {
        logError('Member', 'addMember API error', err?.data?.error || err.message);
        return false;
      }
    }
    logWarn('Member', 'addMember: offline, adding locally');
    updateLocalTrip(tripId, t => ({
      ...t,
      members: [...t.members, { id: uid(), name: phone, phone, role: 'member', initials: phone.slice(-2) }],
    }));
    return true;
  };

  const removeMember = async (tripId: string, memberId: string) => {
    const trip = trips.find(t => t.id === tripId);
    const member = trip?.members.find(m => m.id === memberId);
    if (member?.role === 'leader') {
      logWarn('Member', 'removeMember: cannot remove leader');
      throw new Error('Không thể xóa trưởng nhóm');
    }
    logAction('Member', `removeMember: ${memberId} from trip ${tripId}`);
    updateLocalTrip(tripId, t => ({ ...t, members: t.members.filter(m => m.id !== memberId) }));
    if (isOnline) {
      try { await api.members.remove(tripId, memberId); }
      catch (err: any) { logError('Member', 'removeMember error', err.message); }
    }
  };

  const promoteMember = async (tripId: string, memberId: string) => {
    logAction('Member', `promoteMember: ${memberId} in trip ${tripId}`);
    updateLocalTrip(tripId, t => ({
      ...t,
      members: t.members.map(m => ({
        ...m,
        role: m.id === memberId ? 'leader' : (m.role === 'leader' ? 'member' : m.role),
      })) as Member[],
    }));
    if (isOnline) {
      try { await api.members.promote(tripId, memberId); }
      catch (err: any) { logError('Member', 'promoteMember error', err.message); }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <AppContext.Provider value={{
      user, trips, loading, isOnline,

      notifications,
      readIds,
      unreadCount,
      markNotificationRead,
      markAllNotificationsRead,

      signIn, signUp, signOut, deleteAccount,
      updateUser, changePassword, refreshTrips,
      getTrip, createTrip, deleteTrip, joinTrip,
      findUser, updateTrip,
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