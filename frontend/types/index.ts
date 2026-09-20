// ─── Core Entity Types ────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username: string;
  phone: string;
  password?: string;
  bio?: string;
  location?: string;
  birthday?: string;
  gender?: 'male' | 'female' | 'other' | null;
  job?: string;
  avatar?: string;
  bankName?: string;
  bankAccount?: string;
  language?: string;
  currency?: string;
  defaultLocation?: string;
  darkMode?: boolean;
  dateFormat?: string;
  createdAt?: string;
}

export type TripStatus = 'UPCOMING' | 'ONGOING' | 'DONE';
export type MemberRole = 'leader' | 'member';

export interface Member {
  id: string;
  userId?: string | null;
  name: string;
  phone: string;
  role: MemberRole;
  initials: string;
  avatar?: string;
}

export type ActivityType =
  | 'Tham quan'
  | 'Ăn uống'
  | 'Chỗ ở'
  | 'Di chuyển'
  | 'Mua sắm'
  | 'Vui chơi';

export interface Activity {
  id: string;
  tripId: string;
  name: string;
  location: string;
  date: string;       // DD/MM/YYYY
  time: string;       // HH:mm
  type: string[];
  participants: string[];  // member ids
  note: string;
  image?: string;
}

export type ChecklistCategory = 'shared' | 'personal' | 'todo';

export interface ChecklistItem {
  id: string;
  tripId: string;
  name: string;
  category: ChecklistCategory;
  assignee: string;   // member name
  assigneeIds?: string[];
  dueDate?: string;   // DD/MM/YYYY
  note: string;
  completed: boolean;
  completedAt?: string;
}

export type ExpenseCategory =
  | 'Ăn uống'
  | 'Di chuyển'
  | 'Chỗ ở'
  | 'Vui chơi'
  | 'Mua sắm'
  | 'Khác';

export type SplitType = 'equal' | 'detail';

export interface ExpenseSplit {
  memberId: string;
  memberName: string;
  amount: number;
}

export interface Expense {
  id: string;
  tripId: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  paidBy: string;       // member name
  paidById?: string;    // member id
  date: string;         // DD/MM/YYYY
  splitType: SplitType;
  splits: ExpenseSplit[];
  participants: string[];   // member ids
  note?: string;
}

export interface Trip {
  id: string;
  name: string;
  description: string;
  startDate: string;    // DD/MM/YYYY
  endDate: string;      // DD/MM/YYYY
  destinations: string[];
  status: TripStatus;
  image?: string;
  inviteCode?: string;
  memberCount: number;
  members: Member[];
  activities: Activity[];
  checklist: ChecklistItem[];
  expenses: Expense[];
  createdAt?: string;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ExpenseReport {
  tripName: string;
  totalCost: number;
  balances: Record<string, number>;
  transactions: Array<{
    from: string;
    to: string;
    amount: number;
  }>;
}

// ─── Form Types ───────────────────────────────────────────────────────────────

export interface CreateTripForm {
  name: string;
  startDate: string;
  endDate: string;
  description: string;
  destinations: string[];
  memberPhones: string[];
  image?: string;
}

export interface CreateActivityForm {
  name: string;
  location: string;
  date: string;
  time: string;
  type: string[];
  participants: string[];
  note: string;
}

export interface CreateExpenseForm {
  name: string;
  amount: number;
  category: ExpenseCategory;
  paidBy: string;
  paidById?: string;
  date: string;
  splitType: SplitType;
  splits: ExpenseSplit[];
  participants: string[];
  note?: string;
}

export interface CreateChecklistForm {
  name: string;
  category: ChecklistCategory;
  assignee: string;
  assigneeIds?: string[];
  dueDate?: string;
  note: string;
  completed: boolean;
}
