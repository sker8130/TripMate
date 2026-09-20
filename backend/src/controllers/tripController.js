const mongoose = require('mongoose');
const Trip = require('../models/Trip');
const User = require('../models/User');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DESTINATION_IMAGES = {
  'đà lạt':    'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=600&q=80',
  'phú quốc':  'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=600&q=80',
  'hội an':    'https://images.unsplash.com/photo-1553984840-b8cbc34f5215?w=600&q=80',
  'huế':       'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
  'sa pa':     'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80',
  'hà nội':    'https://images.unsplash.com/photo-1509030450996-dd1a26dda07a?w=600&q=80',
  'nha trang': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80',
  'đà nẵng':   'https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=600&q=80',
  'hạ long':   'https://images.unsplash.com/photo-1573537561839-c779b13d7cfa?w=600&q=80',
  'mũi né':    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600&q=80',
};

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80',
  'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=600&q=80',
  'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80',
  'https://images.unsplash.com/photo-1530521954074-e64f6810b32d?w=600&q=80',
];

function getTripImage(destinations = []) {
  for (const dest of destinations) {
    const lower = dest.toLowerCase();
    for (const [key, url] of Object.entries(DESTINATION_IMAGES)) {
      if (lower.includes(key.split(' ')[0]) || key.includes(lower.split(' ')[0])) {
        return url;
      }
    }
  }
  const seed = destinations.join('').length % FALLBACK_IMAGES.length;
  return FALLBACK_IMAGES[seed];
}

function getInitials(name) {
  return (name || 'U')
    .split(' ')
    .map(w => w[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Send a notification silently – never throw */
async function notify(payload) {
  try {
    await Notification.notify(payload);
  } catch (e) {
    logger.warn('Notification creation failed:', e.message);
  }
}

// ─── Trips CRUD ───────────────────────────────────────────────────────────────

exports.getTrips = async (req, res) => {
  try {
    const trips = await Trip.findForUser(req.userId);
    logger.info(`getTrips: userId=${req.userId}, count=${trips.length}`);
    res.json(trips);
  } catch (err) {
    logger.error('getTrips error:', err.message);
    res.status(500).json({ error: 'Không thể tải danh sách chuyến đi' });
  }
};

exports.getTripById = async (req, res) => {
  try {
    const trip = await Trip.findOne({
      _id: req.params.id,
      deletedAt: null,
    });
    if (!trip) {
      logger.warn(`getTripById: not found id=${req.params.id}`);
      return res.status(404).json({ error: 'Chuyến đi không tồn tại' });
    }
    res.json(trip);
  } catch (err) {
    logger.error('getTripById error:', err.message);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
};

exports.createTrip = async (req, res) => {
  try {
    const { name, startDate, endDate, description, destinations, memberPhones, image } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      logger.warn(`createTrip: user not found userId=${req.userId}`);
      return res.status(401).json({ error: 'Người dùng không hợp lệ' });
    }

    const inviteCode = generateInviteCode();
    const customImage = typeof image === 'string' && image.trim() ? image.trim() : null;

    const trip = await Trip.create({
      userId: req.userId,
      name,
      startDate,
      endDate,
      description: description || '',
      destinations: destinations || [],
      image: customImage || getTripImage(destinations || []),
      inviteCode,
      members: [
        {
          userId: req.userId,
          name:     user.username,
          phone:    user.phone || '',
          role:     'leader',
          initials: getInitials(user.username),
        },
      ],
    });

    // Invite members by phone
    if (Array.isArray(memberPhones) && memberPhones.length > 0) {
      for (const phone of memberPhones) {
        const found = await User.findByPhone(phone);
        trip.members.push({
          userId:   found?._id || null,
          name:     found?.username || phone,
          phone,
          role:     'member',
          initials: found ? getInitials(found.username) : phone.slice(-2),
        });

        // Notify the invited user if they have an account
        if (found) {
          await notify({
            userId:  found._id,
            type:    'TRIP_INVITE',
            title:   `${user.username} mời bạn vào chuyến đi`,
            message: `Bạn được mời tham gia "${trip.name}"`,
            tripId:  trip._id,
            data:    { inviteCode },
          });
        }
      }
      await trip.save();
    }

    logger.info(`createTrip: id=${trip._id} userId=${req.userId} name="${trip.name}"`);
    res.status(201).json(trip);
  } catch (err) {
    logger.error('createTrip error:', err.message);
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors)[0].message;
      return res.status(400).json({ error: msg });
    }
    res.status(500).json({ error: 'Không thể tạo chuyến đi' });
  }
};

exports.updateTrip = async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, userId: req.userId, deletedAt: null });
    if (!trip) return res.status(404).json({ error: 'Chuyến đi không tồn tại hoặc bạn không có quyền' });

    const allowed = ['name', 'description', 'startDate', 'endDate', 'destinations', 'image'];
    allowed.forEach(k => { if (req.body[k] !== undefined) trip[k] = req.body[k]; });

    await trip.save();
    logger.info(`updateTrip: id=${trip._id}`);
    res.json(trip);
  } catch (err) {
    logger.error('updateTrip error:', err.message);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
};

exports.deleteTrip = async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, userId: req.userId, deletedAt: null });
    if (!trip) return res.status(404).json({ error: 'Chuyến đi không tồn tại hoặc bạn không có quyền' });

    trip.deletedAt = new Date();
    await trip.save();
    logger.info(`deleteTrip (soft): id=${trip._id} userId=${req.userId}`);
    res.json({ message: 'Đã xoá chuyến đi' });
  } catch (err) {
    logger.error('deleteTrip error:', err.message);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
};

// ─── Join by invite code ──────────────────────────────────────────────────────

exports.joinTrip = async (req, res) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) return res.status(400).json({ error: 'Mã mời là bắt buộc' });

    const trip = await Trip.findOne({ inviteCode: inviteCode.toUpperCase(), deletedAt: null });
    if (!trip) return res.status(404).json({ error: 'Mã mời không hợp lệ hoặc đã hết hạn' });

    // Already a member?
    const already = trip.members.some(m => String(m.userId) === String(req.userId));
    if (already) return res.status(409).json({ error: 'Bạn đã là thành viên của chuyến đi này' });

    const user = await User.findById(req.userId);
    trip.members.push({
      userId:   req.userId,
      name:     user.username,
      phone:    user.phone || '',
      role:     'member',
      initials: getInitials(user.username),
    });
    await trip.save();

    // Notify trip leader
    const leader = trip.members.find(m => m.role === 'leader' && m.userId);
    if (leader && String(leader.userId) !== String(req.userId)) {
      await notify({
        userId:  leader.userId,
        type:    'MEMBER_JOINED',
        title:   'Thành viên mới tham gia',
        message: `${user.username} đã tham gia chuyến đi "${trip.name}"`,
        tripId:  trip._id,
      });
    }

    logger.info(`joinTrip: tripId=${trip._id} userId=${req.userId}`);
    res.json(trip);
  } catch (err) {
    logger.error('joinTrip error:', err.message);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
};

// ─── Members ──────────────────────────────────────────────────────────────────

exports.addMember = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        error: 'Số điện thoại là bắt buộc',
      });
    }

    // Validate phone number
    const phoneRegex = /^\+?[0-9]{8,15}$/;

    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        error: 'Số điện thoại không hợp lệ',
      });
    }

    const trip = await Trip.findOne({
      _id: req.params.id,
      deletedAt: null,
    });

    if (!trip) {
      return res.status(404).json({
        error: 'Chuyến đi không tồn tại',
      });
    }

    // Permission: only leader can add members
    const caller = trip.members.find(
      (m) => String(m.userId) === String(req.userId)
    );

    if (!caller || caller.role !== 'leader') {
      return res.status(403).json({
        error: 'Chỉ trưởng nhóm mới có thể thêm thành viên',
      });
    }

    // Duplicate check
    if (trip.members.some((m) => m.phone === phone)) {
      return res.status(409).json({
        error: 'Số điện thoại này đã là thành viên',
      });
    }

    const found = await User.findByPhone(phone);

    const newMember = {
      userId: found?._id || null,
      name: found?.username || phone,
      phone,
      role: 'member',
      initials: found
        ? getInitials(found.username)
        : phone.slice(-2),
    };

    trip.members.push(newMember);

    await trip.save();

    if (found) {
      await notify({
        userId: found._id,
        type: 'TRIP_INVITE',
        title: 'Bạn được thêm vào chuyến đi',
        message: `Bạn đã được thêm vào "${trip.name}"`,
        tripId: trip._id,
      });
    }

    logger.info(
      `addMember: tripId=${trip._id} phone=${phone}`
    );

    res.status(201).json(
      trip.members[trip.members.length - 1]
    );
  } catch (err) {
    logger.error('addMember error:', err.message);

    res.status(500).json({
      error: 'Lỗi hệ thống',
    });
  }
};

exports.removeMember = async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, deletedAt: null });
    if (!trip) return res.status(404).json({ error: 'Chuyến đi không tồn tại' });

    const caller = trip.members.find(m => String(m.userId) === String(req.userId));
    const target = trip.members.id(req.params.memberId);
    if (!target) return res.status(404).json({ error: 'Thành viên không tồn tại' });

    // Leader can remove anyone; members can only remove themselves
    const isSelf = String(target.userId) === String(req.userId);
    const isLeader = caller?.role === 'leader';
    if (!isSelf && !isLeader) {
      return res.status(403).json({ error: 'Không có quyền xoá thành viên này' });
    }
    // Cannot remove the last leader
    if (target.role === 'leader' && trip.members.filter(m => m.role === 'leader').length <= 1) {
      return res.status(400).json({ error: 'Không thể xoá trưởng nhóm duy nhất. Hãy chuyển quyền trước.' });
    }

    target.deleteOne();
    await trip.save();
    logger.info(`removeMember: tripId=${trip._id} memberId=${req.params.memberId}`);
    res.json({ message: 'Đã xoá thành viên' });
  } catch (err) {
    logger.error('removeMember error:', err.message);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
};

exports.promoteMember = async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, deletedAt: null });
    if (!trip) return res.status(404).json({ error: 'Chuyến đi không tồn tại' });

    const caller = trip.members.find(m => String(m.userId) === String(req.userId));
    if (!caller || caller.role !== 'leader') {
      return res.status(403).json({ error: 'Chỉ trưởng nhóm mới có thể thăng chức' });
    }

    const target = trip.members.id(req.params.memberId);
    if (!target) return res.status(404).json({ error: 'Thành viên không tồn tại' });

    // Demote current leaders, promote target
    trip.members.forEach(m => {
      if (m.role === 'leader') m.role = 'member';
    });
    target.role = 'leader';
    await trip.save();

    if (target.userId) {
      await notify({
        userId:  target.userId,
        type:    'SYSTEM',
        title:   'Bạn là trưởng nhóm mới',
        message: `Bạn đã được chuyển quyền trưởng nhóm trong "${trip.name}"`,
        tripId:  trip._id,
      });
    }

    logger.info(`promoteMember: tripId=${trip._id} memberId=${req.params.memberId}`);
    res.json(target);
  } catch (err) {
    logger.error('promoteMember error:', err.message);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
};

// ─── Activities ───────────────────────────────────────────────────────────────

exports.getActivities = async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, deletedAt: null }).select('activities');
    if (!trip) return res.status(404).json({ error: 'Chuyến đi không tồn tại' });
    res.json(trip.activities);
  } catch (err) {
    logger.error('getActivities error:', err.message);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
};

exports.addActivity = async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, deletedAt: null });
    if (!trip) return res.status(404).json({ error: 'Chuyến đi không tồn tại' });

    trip.activities.push(req.body);
    await trip.save();
    const added = trip.activities[trip.activities.length - 1];
    logger.info(`addActivity: tripId=${trip._id} name="${added.name}"`);
    res.status(201).json(added);
  } catch (err) {
    logger.error('addActivity error:', err.message);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: Object.values(err.errors)[0].message });
    }
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
};

exports.updateActivity = async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, deletedAt: null });
    if (!trip) return res.status(404).json({ error: 'Chuyến đi không tồn tại' });

    const act = trip.activities.id(req.params.actId);
    if (!act) return res.status(404).json({ error: 'Hoạt động không tồn tại' });

    Object.assign(act, req.body);
    await trip.save();
    res.json(act);
  } catch (err) {
    logger.error('updateActivity error:', err.message);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
};

exports.deleteActivity = async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, deletedAt: null });
    if (!trip) return res.status(404).json({ error: 'Chuyến đi không tồn tại' });

    const act = trip.activities.id(req.params.actId);
    if (!act) return res.status(404).json({ error: 'Hoạt động không tồn tại' });

    act.deleteOne();
    await trip.save();
    logger.info(`deleteActivity: tripId=${trip._id} actId=${req.params.actId}`);
    res.json({ message: 'Đã xoá hoạt động' });
  } catch (err) {
    logger.error('deleteActivity error:', err.message);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
};

// ─── Checklist ────────────────────────────────────────────────────────────────

exports.getChecklist = async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, deletedAt: null }).select('checklist');
    if (!trip) return res.status(404).json({ error: 'Chuyến đi không tồn tại' });
    res.json(trip.checklist);
  } catch (err) {
    logger.error('getChecklist error:', err.message);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
};

exports.addChecklistItem = async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, deletedAt: null });
    if (!trip) return res.status(404).json({ error: 'Chuyến đi không tồn tại' });

    trip.checklist.push(req.body);
    await trip.save();
    const added = trip.checklist[trip.checklist.length - 1];
    logger.info(`addChecklistItem: tripId=${trip._id} name="${added.name}"`);
    res.status(201).json(added);
  } catch (err) {
    logger.error('addChecklistItem error:', err.message);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: Object.values(err.errors)[0].message });
    }
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
};

exports.updateChecklistItem = async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, deletedAt: null });
    if (!trip) return res.status(404).json({ error: 'Chuyến đi không tồn tại' });

    const item = trip.checklist.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Mục không tồn tại' });

    if (req.body.completed !== undefined && req.body.completed !== item.completed) {
      req.body.completedAt = req.body.completed ? new Date() : null;
    }
    Object.assign(item, req.body);
    await trip.save();
    res.json(item);
  } catch (err) {
    logger.error('updateChecklistItem error:', err.message);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
};

exports.deleteChecklistItem = async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, deletedAt: null });
    if (!trip) return res.status(404).json({ error: 'Chuyến đi không tồn tại' });

    const item = trip.checklist.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Mục không tồn tại' });

    item.deleteOne();
    await trip.save();
    res.json({ message: 'Đã xoá mục' });
  } catch (err) {
    logger.error('deleteChecklistItem error:', err.message);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
};

// ─── Expenses ─────────────────────────────────────────────────────────────────

exports.getExpenses = async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, deletedAt: null }).select('expenses');
    if (!trip) return res.status(404).json({ error: 'Chuyến đi không tồn tại' });
    res.json(trip.expenses);
  } catch (err) {
    logger.error('getExpenses error:', err.message);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
};

exports.addExpense = async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, deletedAt: null });
    if (!trip) return res.status(404).json({ error: 'Chuyến đi không tồn tại' });

    if (!req.body.amount || req.body.amount <= 0) {
      return res.status(400).json({ error: 'Số tiền phải lớn hơn 0' });
    }

    trip.expenses.push(req.body);
    await trip.save();
    const added = trip.expenses[trip.expenses.length - 1];

    // Notify all members except the creator
    const user = await User.findById(req.userId);
    for (const m of trip.members) {
      if (m.userId && String(m.userId) !== String(req.userId)) {
        await notify({
          userId:  m.userId,
          type:    'EXPENSE_ADDED',
          title:   'Chi phí mới được thêm',
          message: `${user?.username || 'Ai đó'} đã thêm "${added.name}" (${added.amount.toLocaleString('vi-VN')}đ)`,
          tripId:  trip._id,
          data:    { expenseId: added._id },
        });
      }
    }

    logger.info(`addExpense: tripId=${trip._id} name="${added.name}" amount=${added.amount}`);
    res.status(201).json(added);
  } catch (err) {
    logger.error('addExpense error:', err.message);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: Object.values(err.errors)[0].message });
    }
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, deletedAt: null });
    if (!trip) return res.status(404).json({ error: 'Chuyến đi không tồn tại' });

    const exp = trip.expenses.id(req.params.expId);
    if (!exp) return res.status(404).json({ error: 'Khoản chi không tồn tại' });

    Object.assign(exp, req.body);
    await trip.save();
    res.json(exp);
  } catch (err) {
    logger.error('updateExpense error:', err.message);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, deletedAt: null });
    if (!trip) return res.status(404).json({ error: 'Chuyến đi không tồn tại' });

    const exp = trip.expenses.id(req.params.expId);
    if (!exp) return res.status(404).json({ error: 'Khoản chi không tồn tại' });

    exp.deleteOne();
    await trip.save();
    logger.info(`deleteExpense: tripId=${trip._id} expId=${req.params.expId}`);
    res.json({ message: 'Đã xoá khoản chi' });
  } catch (err) {
    logger.error('deleteExpense error:', err.message);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
};

// ─── Expense report ───────────────────────────────────────────────────────────

exports.getExpenseReport = async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, deletedAt: null })
      .select('members expenses name totalCost');
    if (!trip) return res.status(404).json({ error: 'Chuyến đi không tồn tại' });

    const balances = {};
    trip.members.forEach(m => { balances[m.name] = 0; });

    for (const exp of trip.expenses) {
      const paidBy = exp.paidBy;
      if (exp.splitType === 'equal') {
        const pts = exp.participants.length || trip.members.length;
        const share = exp.amount / pts;
        balances[paidBy] = (balances[paidBy] || 0) + exp.amount;
        const memberNames = exp.participants.length > 0
          ? exp.participants.map(id => trip.members.find(m => String(m._id) === id)?.name || id)
          : trip.members.map(m => m.name);
        memberNames.forEach(name => {
          balances[name] = (balances[name] || 0) - share;
        });
      } else {
        balances[paidBy] = (balances[paidBy] || 0) + exp.amount;
        exp.splits.forEach(s => {
          balances[s.memberName] = (balances[s.memberName] || 0) - s.amount;
        });
      }
    }

    // Greedy settlement algorithm
    const creditors = Object.entries(balances)
      .filter(([, v]) => v > 0.5)
      .map(([n, v]) => [n, v])
      .sort((a, b) => b[1] - a[1]);
    const debtors = Object.entries(balances)
      .filter(([, v]) => v < -0.5)
      .map(([n, v]) => [n, v])
      .sort((a, b) => a[1] - b[1]);

    const transactions = [];
    let ci = 0, di = 0;
    while (ci < creditors.length && di < debtors.length) {
      const [cName, cAmt] = creditors[ci];
      const [dName, dAmt] = debtors[di];
      const settle = Math.min(cAmt, Math.abs(dAmt));
      transactions.push({ from: dName, to: cName, amount: Math.round(settle) });
      creditors[ci][1] -= settle;
      debtors[di][1] += settle;
      if (Math.abs(creditors[ci][1]) < 0.5) ci++;
      if (Math.abs(debtors[di][1]) < 0.5)  di++;
    }

    const perPerson = {};
    trip.members.forEach(m => {
      const paid  = trip.expenses.filter(e => e.paidBy === m.name).reduce((s, e) => s + e.amount, 0);
      const share = trip.expenses.reduce((s, e) => {
        if (e.splitType === 'equal') {
          const pts = e.participants.length || trip.members.length;
          const inList = e.participants.length === 0 ||
            e.participants.some(id => String(trip.members.find(mb => mb.name === m.name)?._id) === id);
          return inList ? s + e.amount / pts : s;
        }
        const mySplit = e.splits.find(sp => sp.memberName === m.name);
        return mySplit ? s + mySplit.amount : s;
      }, 0);
      perPerson[m.name] = { paid, share, balance: paid - share };
    });

    res.json({
      tripName:     trip.name,
      totalCost:    trip.expenses.reduce((s, e) => s + e.amount, 0),
      memberCount:  trip.members.length,
      balances,
      perPerson,
      transactions,
    });
  } catch (err) {
    logger.error('getExpenseReport error:', err.message);
    res.status(500).json({ error: 'Lỗi hệ thống' });
  }
};