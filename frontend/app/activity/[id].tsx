import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { ExpenseCategory, Member } from '../../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACT_TYPES = ['Tham quan', 'Ăn uống', 'Chỗ ở', 'Di chuyển', 'Mua sắm', 'Vui chơi'];
const ACT_TYPE_COLOR: Record<string, string> = {
  'Tham quan': '#3B82F6', 'Ăn uống': '#EF4444', 'Chỗ ở': '#8B5CF6',
  'Di chuyển': '#F59E0B', 'Mua sắm': '#10B981', 'Vui chơi': '#F97316',
};
const EXP_CATS = ['Ăn uống', 'Di chuyển', 'Chỗ ở', 'Vui chơi', 'Mua sắm', 'Khác'];
const EXP_CAT_COLOR: Record<string, string> = {
  'Ăn uống': '#EF4444', 'Di chuyển': '#3B82F6', 'Chỗ ở': '#8B5CF6',
  'Vui chơi': '#F59E0B', 'Mua sắm': '#10B981', 'Khác': '#6B7280',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
function formatTimeInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}
function formatMoneyInput(raw: string): string {
  return raw.replace(/\D/g, '');
}

const safeGetId = (item: any): string => {
  if (!item) return '';
  if (typeof item === 'object') return String(item._id || item.id || '');
  return String(item);
};

const normalizeMemberId = (trip: any, value?: any) => {
  if (!value || !trip?.members?.length) return value ? String(value) : '';
  const strValue = String(value);

  const exact = trip.members.find((m: Member) => safeGetId(m) === strValue);
  if (exact) return safeGetId(exact);

  const byName = trip.members.find((m: Member) => m.name === strValue);
  if (byName) return safeGetId(byName);

  const byFirstName = trip.members.find((m: Member) => m.name.split(' ')[0] === strValue);
  if (byFirstName) return safeGetId(byFirstName);

  return strValue;
};

function useSafeBack(fallback: string = '/(tabs)/trips') {
  const router = useRouter();
  return (): void => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallback as any);
    }
  };
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

function Input({
  label, value, onChangeText, placeholder, multiline, keyboardType, maxLength,
}: {
  label: string; value: string;
  onChangeText: (v: string) => void;
  placeholder?: string; multiline?: boolean;
  keyboardType?: any; maxLength?: number;
}) {
  return (
    <View style={styles.fieldGroup}>
      <SectionLabel text={label} />
      <TextInput
        style={[styles.input, multiline && styles.textArea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#C0C8D0"
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType || 'default'}
        maxLength={maxLength}
      />
    </View>
  );
}

function TagGroup({
  label, options, selected, onToggle, colors,
}: {
  label: string; options: string[]; selected: string[];
  onToggle: (v: string) => void; colors?: Record<string, string>;
}) {
  return (
    <View style={styles.fieldGroup}>
      <SectionLabel text={label} />
      <View style={styles.tagGrid}>
        {options.map(o => {
          const active = selected.includes(o);
          const color = colors?.[o] || '#1B4F8A';
          return (
            <TouchableOpacity
              key={o}
              style={[styles.tag, active && { backgroundColor: color + '18', borderColor: color, borderWidth: 1.5 }]}
              onPress={() => onToggle(o)}
            >
              {active && <Ionicons name="checkmark" size={12} color={color} />}
              <Text style={[styles.tagText, active && { color, fontWeight: '700' }]}>{o}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function MemberPicker({
  label,
  members = [],
  selected = [],
  onToggle,
  single = false,
}: {
  label: string;
  members: Member[];
  selected: string[];
  onToggle: (id: string) => void;
  single?: boolean;
}) {
  return (
    <View style={styles.fieldGroup}>
      <SectionLabel text={label} />

      <View style={styles.memberGrid}>
        {members.map((m: Member, index: number) => {
          const memberId = safeGetId(m) || `member-${index}`;
          const active = selected.includes(memberId);

          return (
            <TouchableOpacity
              key={memberId}
              style={[
                styles.memberChip,
                active && styles.memberChipActive,
              ]}
              onPress={() => onToggle(memberId)}
            >
              <View
                style={[
                  styles.memberAv,
                  active && { backgroundColor: '#1B4F8A' },
                ]}
              >
                <Text style={styles.memberAvText}>
                  {m.initials?.slice(0, 1) || m.name?.[0] || '?'}
                </Text>
              </View>

              <Text
                style={[
                  styles.memberLabel,
                  active && {
                    color: '#1B4F8A',
                    fontWeight: '700',
                  },
                ]}
              >
                {m.name ? m.name.split(' ')[0] : 'N/A'}
              </Text>

              {active && (
                <View style={styles.memberCheck}>
                  <Ionicons
                    name="checkmark"
                    size={10}
                    color="#1B4F8A"
                  />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── ACTIVITY FORM ────────────────────────────────────────────────────────────

function ActivityForm({ tripId, actId }: { tripId: string; actId: string }) {
  const safeBack = useSafeBack(`/trip/${tripId}`);
  const { trips, addActivity, updateActivity, deleteActivity } = useApp();
  const trip = trips.find((t) => t.id === tripId);
  const isNew = !actId || actId === 'new' || actId === 'activity';
  const existing = isNew ? undefined : trip?.activities.find((a) => safeGetId(a) === actId);

  const [form, setForm] = useState({
    name: '', location: '', date: '', time: '',
    type: [] as string[], participants: [] as string[], note: '',
  });

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name, location: existing.location,
        date: existing.date, time: existing.time,
        type: existing.type || [],
        participants: (existing.participants || []).map((p: any) => safeGetId(p)),
        note: existing.note || '',
      });
    } else if (trip?.members) {
      setForm(p => ({ ...p, participants: trip.members.map((m: Member) => safeGetId(m)) }));
    }
  }, [actId, existing, trip]);

  const save = async () => {
    if (!form.name.trim()) { Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên hoạt động'); return; }
    if (isNew) await addActivity(tripId, form);
    else await updateActivity(tripId, actId, form);
    safeBack();
  };

  const del = () => Alert.alert('Xoá hoạt động', 'Hành động này không thể hoàn tác', [
    { text: 'Hủy', style: 'cancel' },
    { text: 'Xoá', style: 'destructive', onPress: async () => { await deleteActivity(tripId, actId); safeBack(); } },
  ]);

  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={safeBack} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isNew ? 'Thêm kế hoạch' : 'Chi tiết hoạt động'}</Text>
        <TouchableOpacity onPress={save}><Text style={styles.saveText}>Lưu</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <Input label="Tên hoạt động *" value={form.name} onChangeText={(v: string) => setForm(p => ({ ...p, name: v }))} placeholder="Tham quan Hồ Xuân Hương" />
        <Input label="Địa điểm" value={form.location} onChangeText={(v: string) => setForm(p => ({ ...p, location: v }))} placeholder="Trung tâm TP. Đà Lạt" />

        <View style={styles.rowFields}>
          <View style={{ flex: 1 }}>
            <SectionLabel text="Ngày" />
            <View style={styles.iconInput}>
              <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
              <TextInput style={styles.iconInputText} placeholder="DD/MM/YYYY" placeholderTextColor="#C0C8D0"
                value={form.date} onChangeText={(v: string) => setForm(p => ({ ...p, date: formatDateInput(v) }))}
                keyboardType="numeric" maxLength={10} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <SectionLabel text="Thời gian" />
            <View style={styles.iconInput}>
              <Ionicons name="time-outline" size={16} color="#9CA3AF" />
              <TextInput style={styles.iconInputText} placeholder="HH:MM" placeholderTextColor="#C0C8D0"
                value={form.time} onChangeText={(v: string) => setForm(p => ({ ...p, time: formatTimeInput(v) }))}
                keyboardType="numeric" maxLength={5} />
            </View>
          </View>
        </View>

        <TagGroup label="Loại hoạt động" options={ACT_TYPES} selected={form.type}
          onToggle={(v: string) => setForm(p => ({ ...p, type: p.type.includes(v) ? p.type.filter(x => x !== v) : [...p.type, v] }))}
          colors={ACT_TYPE_COLOR} />

        {trip && (
          <MemberPicker
            label={`Người tham gia (${form.participants.length}/${trip.members.length})`}
            members={trip.members} selected={form.participants}
            onToggle={(id: string) => setForm(p => ({ ...p, participants: p.participants.includes(id) ? p.participants.filter(x => x !== id) : [...p.participants, id] }))}
          />
        )}

        <Input label="Ghi chú (tùy chọn)" value={form.note}
          onChangeText={(v: string) => setForm(p => ({ ...p, note: v }))}
          placeholder="Mang theo ô vì trời có thể mưa..." multiline />

        <TouchableOpacity style={styles.primaryBtn} onPress={save}>
          <Text style={styles.primaryBtnText}>{isNew ? '+ Thêm hoạt động' : '✓ Lưu thay đổi'}</Text>
        </TouchableOpacity>

        {!isNew && (
          <TouchableOpacity style={styles.dangerBtn} onPress={del}>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
            <Text style={styles.dangerBtnText}>Xoá hoạt động</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </>
  );
}

// ─── CHECKLIST FORM ───────────────────────────────────────────────────────────

function ChecklistForm({ tripId, itemId }: { tripId: string; itemId: string }) {
  const safeBack = useSafeBack(`/trip/${tripId}`);
  const { getTrip, addChecklistItem, updateChecklistItem, deleteChecklistItem } = useApp();
  const trip = getTrip(tripId);
  const isNew = !itemId || itemId === 'new' || itemId === 'checklist';
  const existing = isNew ? undefined : trip?.checklist.find((c) => safeGetId(c) === itemId);

  const [form, setForm] = useState({
    name: '', category: 'shared' as 'shared' | 'personal' | 'todo',
    assignee: '', dueDate: '', note: '', completed: false,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        category: existing.category as 'shared' | 'personal' | 'todo',
        assignee: safeGetId(existing.assignee),
        dueDate: existing.dueDate ?? '',
        note: existing.note,
        completed: existing.completed,
      });
    }
  }, [itemId, existing]);

  const save = async () => {
    if (!form.name.trim()) { Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên mục'); return; }
    if (isNew) await addChecklistItem(tripId, form);
    else await updateChecklistItem(tripId, itemId, form);
    safeBack();
  };

  const CATS: { key: 'shared' | 'personal' | 'todo'; label: string; color: string }[] = [
    { key: 'shared',   label: '🎒 Đồ chung',       color: '#EF4444' },
    { key: 'personal', label: '👤 Cá nhân',          color: '#3B82F6' },
    { key: 'todo',     label: '✅ Việc cần làm',     color: '#10B981' },
  ];

  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={safeBack} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isNew ? 'Thêm mục' : 'Chi tiết mục'}</Text>
        <TouchableOpacity onPress={save}><Text style={styles.saveText}>Lưu</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        {!isNew && (
          <TouchableOpacity
            style={[styles.completedToggle, form.completed && styles.completedToggleActive]}
            onPress={() => {
              const newVal = !form.completed;
              setForm(p => ({ ...p, completed: newVal }));
              updateChecklistItem(tripId, itemId, { completed: newVal });
            }}
          >
            <Ionicons name={form.completed ? 'checkmark-circle' : 'ellipse-outline'} size={24}
              color={form.completed ? '#10B981' : '#D1D5DB'} />
            <Text style={[styles.completedToggleText, form.completed && { color: '#10B981' }]}>
              {form.completed ? 'Đã hoàn thành' : 'Chưa hoàn thành'}
            </Text>
          </TouchableOpacity>
        )}

        <Input label="Tên mục *" value={form.name}
          onChangeText={(v: string) => setForm(p => ({ ...p, name: v }))}
          placeholder="Mua vé cáp treo Langbiang" />

        <View style={styles.fieldGroup}>
          <SectionLabel text="Danh mục" />
          <View style={styles.catRow}>
            {CATS.map(c => (
              <TouchableOpacity key={c.key}
                style={[styles.catChip, form.category === c.key && { backgroundColor: c.color + '15', borderColor: c.color, borderWidth: 1.5 }]}
                onPress={() => setForm(p => ({ ...p, category: c.key }))}
              >
                <Text style={[styles.catChipText, form.category === c.key && { color: c.color, fontWeight: '700' }]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {trip && (
          <MemberPicker label="Người phụ trách" members={trip.members}
            selected={form.assignee ? [form.assignee] : []} single
            onToggle={(id: string) => setForm(p => ({ ...p, assignee: id }))} 
          />
        )}

        <View style={styles.fieldGroup}>
          <SectionLabel text="Hạn hoàn thành" />
          <View style={styles.iconInput}>
            <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
            <TextInput style={styles.iconInputText} placeholder="DD/MM/YYYY" placeholderTextColor="#C0C8D0"
              value={form.dueDate} onChangeText={(v: string) => setForm(p => ({ ...p, dueDate: formatDateInput(v) }))}
              keyboardType="numeric" maxLength={10} />
          </View>
        </View>

        <Input label="Ghi chú (tùy chọn)" value={form.note}
          onChangeText={(v: string) => setForm(p => ({ ...p, note: v }))}
          placeholder="Giá khoảng 200k/người..." multiline />

        <TouchableOpacity style={styles.primaryBtn} onPress={save}>
          <Text style={styles.primaryBtnText}>{isNew ? '+ Thêm mục' : '✓ Lưu thay đổi'}</Text>
        </TouchableOpacity>

        {!isNew && (
          <TouchableOpacity style={styles.dangerBtn} onPress={() =>
            Alert.alert('Xoá mục', 'Hành động này không thể hoàn tác', [
              { text: 'Hủy', style: 'cancel' },
              { text: 'Xoá', style: 'destructive', onPress: async () => { await deleteChecklistItem(tripId, itemId); safeBack(); } },
            ])
          }>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
            <Text style={styles.dangerBtnText}>Xoá mục</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </>
  );
}

// ─── EXPENSE FORM ─────────────────────────────────────────────────────────────

function ExpenseForm({ tripId, expId }: { tripId: string; expId: string }) {
  const safeBack = useSafeBack(`/trip/${tripId}`);
  const { getTrip, addExpense, updateExpense, deleteExpense } = useApp();
  const trip = getTrip(tripId);
  const isNew = !expId || expId === 'new' || expId === 'expense';
  
  // Dùng useMemo để tránh việc tạo object 'existing' mới liên tục
  const existing = React.useMemo(() => 
    isNew ? undefined : trip?.expenses.find((e) => safeGetId(e) === expId),
    [trip?.expenses, expId, isNew]
  );

  const [form, setForm] = useState({
    name: '', amount: '', category: 'Ăn uống' as ExpenseCategory, paidBy: '',
    date: '', splitType: 'equal' as 'equal' | 'detail',
    participants: [] as string[],
  });
  
  const [customAmounts, setCustomAmounts] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  useEffect(() => {
    if (!trip || !trip.members || trip.members.length === 0) return;

    if (existing) {
      const paidById = normalizeMemberId(trip, safeGetId(existing.paidBy));
      const participantIds = Array.from(
        new Set((existing.participants || []).map((p: any) => normalizeMemberId(trip, safeGetId(p))).filter(Boolean))
      );

      // CHẶN UPDATE NẾU DỮ LIỆU ĐÃ ĐÚNG (So sánh nhẹ để tránh re-render thừa)
      if (form.name === existing.name && form.amount === String(existing.amount)) return;

      setForm({
        name: existing.name,
        amount: String(existing.amount),
        category: existing.category,
        paidBy: paidById,
        date: existing.date || '',
        splitType: existing.splitType || 'equal',
        participants: participantIds,
      });

      if (existing.splits?.length) {
        const amounts: Record<string, string> = {};
        existing.splits.forEach((s: any) => {
          const id = normalizeMemberId(trip, safeGetId(s.memberId));
          if (id) amounts[id] = String(s.amount);
        });
        setCustomAmounts(amounts);
      }
    } else if (form.name === '' && form.amount === '') { 
      // Chỉ set mặc định khi là tạo mới và form đang trống
      const ids = trip.members.map((m: Member) => safeGetId(m));
      setForm({
        name: '', amount: '', category: 'Ăn uống',
        paidBy: safeGetId(trip.members[0]) || '',
        date: '', splitType: 'equal',
        participants: ids,
      });
      setCustomAmounts(ids.reduce((acc, id) => ({ ...acc, [id]: '' }), {}));
    }
  }, [existing, trip?.members]);

  const toggleParticipant = (id: string) => {
    setForm(prev => {
      const exists = prev.participants.includes(id);
      const updatedParticipants = exists
        ? prev.participants.filter(p => p !== id)
        : Array.from(new Set([...prev.participants, id]));

      setCustomAmounts(prevAmounts => ({
        ...prevAmounts,
        [id]: exists ? '' : (prevAmounts[id] || ''),
      }));

      return {
        ...prev,
        participants: updatedParticipants,
      };
    });
  };

  const save = async () => {
    if (!form.name.trim()) { Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên khoản chi'); return; }
    if (!form.amount || isNaN(Number(form.amount))) { Alert.alert('Thiếu thông tin', 'Vui lòng nhập số tiền hợp lệ'); return; }
    
    if (form.splitType === 'detail') {
      const total = form.participants.reduce((s, id) => s + (Number(customAmounts[id]) || 0), 0);
      const diff = Number(form.amount) - total;
      if (Math.abs(diff) > 1) {
        Alert.alert('Tổng không khớp', `Còn ${diff > 0 ? 'thiếu' : 'thừa'} ${Math.abs(diff).toLocaleString('vi-VN')}đ. Kiểm tra lại số tiền từng người.`);
        return;
      }
    }
    setSaving(true);
    try {
      const splits = form.splitType === 'detail'
        ? form.participants.map(id => {
            const member = trip?.members.find((m: Member) => safeGetId(m) === id);
            return {
              memberId: id,
              memberName: member?.name.split(' ')[0] || id,
              amount: Number(customAmounts[id] || 0),
            };
          }).filter(s => s.amount > 0)
        : [];
      const data = { ...form, amount: Number(form.amount), splits };
      if (isNew) await addExpense(tripId, data);
      else await updateExpense(tripId, expId, data);
      safeBack();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể lưu khoản chi. Kiểm tra kết nối mạng.');
    } finally {
      setSaving(false);
    }
  };

  const amt = Number(form.amount) || 0;
  const perPerson = form.participants.length > 0 ? Math.round(amt / form.participants.length) : 0;
  
  const detailTotal = form.participants.reduce((s, id) => s + (Number(customAmounts[id]) || 0), 0);
  const detailDiff = amt - detailTotal;

  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={safeBack} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isNew ? 'Thêm chi phí' : 'Chi tiết khoản chi'}</Text>
        <TouchableOpacity onPress={save}><Text style={styles.saveText}>Lưu</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <View style={styles.amtHero}>
          <Text style={styles.amtHeroLabel}>Số tiền</Text>
          <View style={styles.amtInputRow}>
            <TextInput
              style={styles.amtInput}
              value={form.amount ? Number(form.amount).toLocaleString('vi-VN') : ''}
              onChangeText={(v: string) => setForm(p => ({ ...p, amount: formatMoneyInput(v) }))}
              placeholder="0" placeholderTextColor="#CBD5E1"
              keyboardType="numeric" textAlign="center"
            />
            <Text style={styles.amtCurrency}>đ</Text>
          </View>
        </View>

        <Input label="Tên khoản chi *" value={form.name}
          onChangeText={(v: string) => setForm(p => ({ ...p, name: v }))}
          placeholder="Bún bò buổi trưa" />

        <TagGroup label="Phân loại" options={EXP_CATS} selected={[form.category]}
          onToggle={(v: string) => setForm(p => ({ ...p, category: v as ExpenseCategory }))}
          colors={EXP_CAT_COLOR} />

        {trip && trip.members && (
          <MemberPicker
            label="Người trả tiền"
            members={trip.members}
            selected={form.paidBy ? [form.paidBy] : []}
            single
            onToggle={(id: string) => setForm(p => ({ ...p, paidBy: id }))}
          />
        )}

        <View style={styles.fieldGroup}>
          <SectionLabel text="Cách chia" />
          <View style={styles.splitRow}>
            {(['equal', 'detail'] as const).map((s: 'equal' | 'detail') => (
              <TouchableOpacity key={s}
                style={[styles.splitBtn, form.splitType === s && styles.splitBtnActive]}
                onPress={() => {
                  if (s === 'detail' && form.splitType === 'equal' && amt > 0 && form.participants.length > 0) {
                    const autoAmount = Math.round(amt / form.participants.length);
                    const updatedAmounts: Record<string, string> = {};
                    form.participants.forEach(id => {
                      updatedAmounts[id] = String(autoAmount);
                    });
                    setCustomAmounts(updatedAmounts);
                  }
                  setForm(p => ({ ...p, splitType: s }));
                }}
              >
                <Ionicons name={s === 'equal' ? 'people-outline' : 'list-outline'} size={16}
                  color={form.splitType === s ? '#1B4F8A' : '#9CA3AF'} />
                <Text style={[styles.splitBtnText, form.splitType === s && styles.splitBtnTextActive]}>
                  {s === 'equal' ? 'Chia đều' : 'Chi tiết'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {trip && trip.members && (
          <MemberPicker
            label={`Người tham gia (${form.participants.length}/${trip.members.length})`}
            members={trip.members}
            selected={form.participants}
            onToggle={toggleParticipant}
          />
        )}

        {form.splitType === 'equal' && amt > 0 && form.participants.length > 0 && (
          <View style={styles.perPersonBox}>
            <Text style={styles.perPersonLabel}>Mỗi người trả</Text>
            <Text style={styles.perPersonAmt}>{perPerson.toLocaleString('vi-VN')} đ</Text>
          </View>
        )}

        {form.splitType === 'detail' && trip && trip.members && form.participants.length > 0 && (
          <View style={styles.fieldGroup}>
            <SectionLabel text="Nhập số tiền từng người" />
            {trip.members
              .filter((m: Member) => form.participants.includes(safeGetId(m)))
              .map((m: Member, idx: number) => {
                const memberId = safeGetId(m) || `detail-mem-${idx}`;
                const rawVal = customAmounts[memberId] ?? '';
                return (
                  <View key={`expense-detail-row-${memberId}`} style={styles.detailRow}>
                    <View style={styles.memberAv}>
                      <Text style={styles.memberAvText}>{m.initials?.slice(0,1) || m.name?.[0] || '?'}</Text>
                    </View>
                    <Text style={styles.detailName}>{m.name ? m.name.split(' ')[0] : 'N/A'}</Text>
                    <View style={styles.detailInputWrap}>
                      <TextInput
                        style={styles.detailInput}
                        value={rawVal ? Number(rawVal).toLocaleString('vi-VN') : ''}
                        onChangeText={v => {
                          const raw = v.replace(/\D/g, '');
                          setCustomAmounts(prev => ({ ...prev, [memberId]: raw }));
                        }}
                        placeholder="0"
                        placeholderTextColor="#C0C8D0"
                        keyboardType="numeric"
                        textAlign="right"
                      />
                      <Text style={styles.detailCurrency}>đ</Text>
                    </View>
                  </View>
                );
              })}
            
            {detailDiff !== 0 && amt > 0 && (
              <View style={[styles.detailTotalRow, styles.warningBox]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="warning-outline" size={16} color="#D97706" style={{ marginRight: 6 }} />
                  <Text style={styles.warningText}>
                    {detailDiff > 0
                      ? `Còn thiếu ${detailDiff.toLocaleString('vi-VN')}đ`
                      : `Vượt quá ${Math.abs(detailDiff).toLocaleString('vi-VN')}đ`}
                  </Text>
                </View>
                <Text style={styles.warningTotalAmt}>{detailTotal.toLocaleString('vi-VN')} đ</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.fieldGroup}>
          <SectionLabel text="Ngày" />
          <View style={styles.iconInput}>
            <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
            <TextInput style={styles.iconInputText} placeholder="DD/MM/YYYY" placeholderTextColor="#C0C8D0"
              value={form.date} onChangeText={(v: string) => setForm(p => ({ ...p, date: formatDateInput(v) }))}
              keyboardType="numeric" maxLength={10} />
          </View>
        </View>

        <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
          <Text style={styles.primaryBtnText}>{saving ? 'Đang lưu...' : isNew ? '+ Lưu khoản chi' : '✓ Lưu thay đổi'}</Text>
        </TouchableOpacity>

        {!isNew && (
          <TouchableOpacity style={styles.dangerBtn} onPress={() =>
            Alert.alert('Xoá khoản chi', 'Hành động này không thể hoàn tác', [
              { text: 'Hủy', style: 'cancel' },
              { text: 'Xoá', style: 'destructive', onPress: async () => { await deleteExpense(tripId, expId); safeBack(); } },
            ])
          }>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
            <Text style={styles.dangerBtnText}>Xoá khoản chi</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </>
  );
}

// ─── MEMBER ADD FORM ──────────────────────────────────────────────────────────

function MemberForm({ tripId }: { tripId: string }) {
  const safeBack = useSafeBack(`/trip/${tripId}`);
  const { getTrip, addMember } = useApp();
  const trip = getTrip(tripId);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    const ok = await addMember(tripId, phone.trim());
    setLoading(false);
    if (ok) { setPhone(''); Alert.alert('Thành công', `Đã thêm ${phone}`); }
    else Alert.alert('Lỗi', 'Thành viên đã tồn tại trong chuyến đi');
  };

  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={safeBack} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thêm thành viên</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <View style={styles.fieldGroup}>
          <SectionLabel text="Tìm theo số điện thoại" />
          <View style={styles.searchAddRow}>
            <View style={styles.searchAddInput}>
              <Ionicons name="call-outline" size={16} color="#9CA3AF" />
              <TextInput
                style={{ flex: 1, fontSize: 15, color: '#111', paddingVertical: 0 }}
                placeholder="0912 345 678" placeholderTextColor="#C0C8D0"
                value={phone} onChangeText={setPhone} keyboardType="phone-pad"
                onSubmitEditing={handleAdd} returnKeyType="done"
              />
            </View>
            <TouchableOpacity style={[styles.addBtn, loading && { opacity: 0.6 }]} onPress={handleAdd} disabled={loading}>
              <Text style={styles.addBtnText}>{loading ? '...' : 'Thêm'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {trip && trip.members && trip.members.length > 0 && (
          <View style={styles.fieldGroup}>
            <SectionLabel text={`Thành viên hiện tại (${trip.members.length})`} />
            {trip.members.map((m: Member, index: number) => {
              const memberId = m.id || `member-list-${index}`;
              return (
                <View key={`existing-member-row-${memberId}`} style={styles.existingMemberRow}>
                  <View style={[styles.memberAv, m.role === 'leader' && { backgroundColor: '#F59E0B' }]}>
                    <Text style={styles.memberAvText}>{m.initials?.slice(0, 1) || m.name?.[0] || '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberChipNameText}>{m.name || 'No Name'}</Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{m.phone || ''}</Text>
                  </View>
                  <View style={m.role === 'leader' ? styles.leaderBadgeSm : styles.memberBadgeSm}>
                    <Text style={m.role === 'leader' ? styles.leaderBadgeSmText : styles.memberBadgeSmText}>
                      {m.role === 'leader' ? 'Trưởng' : 'Thành viên'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function ActivityScreen() {
  const { id, tripId, type } = useLocalSearchParams<{ id: string; tripId: string; type: string }>();

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {type === 'checklist' ? <ChecklistForm tripId={tripId!} itemId={id!} />  :
         type === 'expense'   ? <ExpenseForm   tripId={tripId!} expId={id!}  />  :
         type === 'member'    ? <MemberForm    tripId={tripId!}               />  :
                                <ActivityForm  tripId={tripId!} actId={id!}  />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  saveText: { fontSize: 16, color: '#1B4F8A', fontWeight: '700' },
  formContent: { padding: 20, gap: 20, paddingBottom: 60 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  fieldGroup: { gap: 0 },
  input: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#111', backgroundColor: '#F9FAFB' },
  textArea: { height: 88, textAlignVertical: 'top' },
  rowFields: { flexDirection: 'row', gap: 12 },
  iconInput: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#F9FAFB' },
  iconInputText: { flex: 1, fontSize: 15, color: '#111' },
  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB' },
  tagText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  memberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberChip: { alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', minWidth: 60, position: 'relative' },
  memberChipActive: { borderColor: '#1B4F8A', backgroundColor: '#EFF6FF' },
  memberAv: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#9CA3AF', justifyContent: 'center', alignItems: 'center' },
  memberAvText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  memberLabel: { fontSize: 11, color: '#6B7280', textAlign: 'center' },
  memberChipNameText: { fontSize: 14, fontWeight: '600', color: '#111' },
  catRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  catChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB', minWidth: 100 },
  catChipText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  completedToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  completedToggleActive: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
  completedToggleText: { fontSize: 15, color: '#6B7280', fontWeight: '600' },
  amtHero: { alignItems: 'center', paddingVertical: 24, backgroundColor: '#EFF6FF', borderRadius: 16, gap: 6 },
  amtHeroLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  amtInputRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  amtInput: { fontSize: 42, fontWeight: '800', color: '#1B4F8A', minWidth: 120, textAlign: 'center' },
  amtCurrency: { fontSize: 22, fontWeight: '700', color: '#1B4F8A' },
  splitRow: { flexDirection: 'row', gap: 12 },
  splitBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB' },
  splitBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#1B4F8A' },
  splitBtnText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
  splitBtnTextActive: { color: '#1B4F8A', fontWeight: '700' },
  perPersonBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#BBF7D0' },
  perPersonLabel: { fontSize: 14, color: '#166534' },
  perPersonAmt: { fontSize: 18, fontWeight: '800', color: '#16A34A' },
  primaryBtn: { backgroundColor: '#1B4F8A', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8, shadowColor: '#1B4F8A', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: '#FECACA', borderRadius: 14, paddingVertical: 14, backgroundColor: '#FEF2F2' },
  dangerBtnText: { color: '#EF4444', fontSize: 15, fontWeight: '600' },
  searchAddRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  searchAddInput: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#F9FAFB' },
  addBtn: { backgroundColor: '#1B4F8A', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 14 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  existingMemberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  leaderBadgeSm: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  leaderBadgeSmText: { fontSize: 11, color: '#92400E', fontWeight: '700' },
  memberBadgeSm: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  memberBadgeSmText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  memberCheck: { position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: 7, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  detailName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111' },
  detailInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#F9FAFB', minWidth: 120 },
  detailInput: { minWidth: 80, fontSize: 15, color: '#1B4F8A', fontWeight: '700', textAlign: 'right' },
  detailCurrency: { fontSize: 13, color: '#1B4F8A', fontWeight: '600' },
  detailTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ECFDF5', borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#BBF7D0' },
  detailTotalLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  detailTotalAmt: { fontSize: 15, fontWeight: '800', color: '#1B4F8A' },
  warningBox: {
    backgroundColor: '#FEF3C7', borderColor: '#FCD34D', borderWidth: 1, borderRadius: 8,
    paddingVertical: 12, paddingHorizontal: 16, marginTop: 12
  },
  warningText: { color: '#B45309', fontSize: 14, fontWeight: '600' },
  warningTotalAmt: { color: '#1B4F8A', fontSize: 15, fontWeight: '700' },
});