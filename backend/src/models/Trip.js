const mongoose = require('mongoose');

// ─── Category mapping ─────────────────────────────────────────────────────────
// Supports both Vietnamese display names and English backend values
const EXPENSE_CATEGORIES = ['food', 'transport', 'accommodation', 'entertainment', 'shopping', 'other'];
const VI_TO_EN = {
  'Ăn uống': 'food',
  'Di chuyển': 'transport',
  'Chỗ ở': 'accommodation',
  'Vui chơi': 'entertainment',
  'Mua sắm': 'shopping',
  'Khác': 'other',
};

function normalizeCategory(val) {
  return VI_TO_EN[val] || (EXPENSE_CATEGORIES.includes(val) ? val : 'other');
}

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const memberSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name:     { type: String, required: [true, 'Tên thành viên là bắt buộc'], trim: true },
    phone:    { type: String, default: '', trim: true },
    role:     { type: String, enum: ['leader', 'member'], default: 'member' },
    initials: { type: String },
    avatar:   { type: String },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: true, timestamps: false }
);

const activitySchema = new mongoose.Schema(
  {
    name:         { type: String, required: [true, 'Tên hoạt động là bắt buộc'], trim: true },
    location:     { type: String, default: '', trim: true },
    // Store as Date internally; present as DD/MM/YYYY to clients via transform
    date:         { type: String },       // DD/MM/YYYY (kept as string for client compat)
    time:         { type: String },       // HH:mm
    type:         [{ type: String }],
    participants: [{ type: String }],     // member _id strings
    note:         { type: String, default: '', maxlength: 1000 },
    image:        { type: String },
  },
  { _id: true, timestamps: true }
);

const checklistItemSchema = new mongoose.Schema(
  {
    name:         { type: String, required: [true, 'Tên mục là bắt buộc'], trim: true },
    category:     { type: String, enum: ['shared', 'personal', 'todo'], default: 'shared' },
    assignee:     { type: String, default: '', trim: true },  // member name (display)
    assigneeIds:  [{ type: String }],                         // member _id strings
    dueDate:      { type: String },                            // DD/MM/YYYY
    note:         { type: String, default: '', maxlength: 500 },
    completed:    { type: Boolean, default: false },
    completedAt:  { type: Date },
    completedBy:  { type: String },                            // member name
  },
  { _id: true, timestamps: true }
);

// Auto-set completedAt when completed toggles to true
checklistItemSchema.pre('save', function (next) {
  if (this.isModified('completed')) {
    this.completedAt = this.completed ? new Date() : undefined;
  }
  next();
});

const expenseSplitSchema = new mongoose.Schema(
  {
    memberId:   { type: String, required: true },
    memberName: { type: String },
    amount:     { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    name:        { type: String, required: [true, 'Tên chi phí là bắt buộc'], trim: true },
    amount:      { type: Number, required: [true, 'Số tiền là bắt buộc'], min: [0, 'Số tiền phải >= 0'] },
    category:    {
      type: String,
      enum: EXPENSE_CATEGORIES,
      default: 'other',
      set: normalizeCategory,   // accept Vietnamese input
    },
    paidBy:      { type: String, required: [true, 'Người trả là bắt buộc'], trim: true },
    paidById:    { type: String },
    date:        { type: String },   // DD/MM/YYYY
    splitType:   { type: String, enum: ['equal', 'detail'], default: 'equal' },
    splits:      [expenseSplitSchema],
    participants:[{ type: String }],  // member _id strings
    note:        { type: String, default: '', maxlength: 500 },
  },
  { _id: true, timestamps: true }
);

// ─── Main Trip Schema ──────────────────────────────────────────────────────────

const tripSchema = new mongoose.Schema(
  {
    // Owner
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Người tạo là bắt buộc"],
      index: true,
    },

    // Basic info
    name: {
      type: String,
      required: [true, "Tên chuyến đi là bắt buộc"],
      trim: true,
      maxlength: 120,
    },
    description: { type: String, default: "", maxlength: 2000 },
    startDate: { type: String }, // DD/MM/YYYY – kept as string for easy display
    endDate: { type: String }, // DD/MM/YYYY

    // Destinations
    destinations: [{ type: String, trim: true }],

    // Status (stored but also computed on read via virtual)
    status: {
      type: String,
      enum: ["UPCOMING", "ONGOING", "DONE"],
      default: "UPCOMING",
    },

    // Cover image
    image: { type: String },

    // Invite code for join-by-link
    inviteCode: { type: String, unique: true, sparse: true, uppercase: true },

    // Soft delete
    deletedAt: { type: Date, default: null },

    // Nested documents
    members: [memberSchema],
    activities: [activitySchema],
    checklist: [checklistItemSchema],
    expenses: [expenseSchema],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        ret.id = String(ret._id);

        ret.members = (ret.members || []).map((member) => ({
          ...member,
          id: String(member.id || member._id),
        }));

        delete ret._id;
        delete ret.__v;
        delete ret.deletedAt;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────

tripSchema.virtual('totalCost').get(function () {
  return this.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
});

tripSchema.virtual('memberCount').get(function () {
  return this.members.length;
});

/**
 * Compute live status from dates so stored status stays in sync.
 * Returns 'UPCOMING' | 'ONGOING' | 'DONE'
 */
tripSchema.virtual('computedStatus').get(function () {
  if (!this.startDate || !this.endDate) return this.status;
  const parse = (s) => {
    const [d, m, y] = s.split('/').map(Number);
    return new Date(y, m - 1, d);
  };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = parse(this.startDate);
  const end   = parse(this.endDate);
  if (now < start) return 'UPCOMING';
  if (now > end)   return 'DONE';
  return 'ONGOING';
});

// ─── Pre-save hooks ───────────────────────────────────────────────────────────

// Keep status field in sync with dates
tripSchema.pre('save', function (next) {
  if (this.startDate && this.endDate) {
    const parse = (s) => {
      const [d, m, y] = s.split('/').map(Number);
      return new Date(y, m - 1, d);
    };
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = parse(this.startDate);
    const end   = parse(this.endDate);
    if (now < start)       this.status = 'UPCOMING';
    else if (now > end)    this.status = 'DONE';
    else                   this.status = 'ONGOING';
  }
  next();
});

// ─── Indexes ──────────────────────────────────────────────────────────────────

tripSchema.index({ userId: 1, createdAt: -1 });
tripSchema.index({ inviteCode: 1 });
tripSchema.index({ status: 1 });
tripSchema.index({ 'members.userId': 1 });   // find trips user is a member of
tripSchema.index({ deletedAt: 1 });           // filter soft-deleted

// ─── Static methods ───────────────────────────────────────────────────────────

/**
 * Find all trips (owned or joined) for a given userId.
 */
tripSchema.statics.findForUser = function (userId) {
  return this.find({
    deletedAt: null,
    $or: [
      { userId },
      { 'members.userId': userId },
    ],
  }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('Trip', tripSchema);
