import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert, FlatList, Image, Modal, ScrollView,
  Share, StyleSheet, Text, TextInput,
  TouchableOpacity, View, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { Activity, ChecklistItem, Expense, Member } from '../../types';
import { logAction, logWarn } from '../../utils/logger';

const TABS = ['Kế hoạch', 'Checklist', 'Chi phí', 'Nhóm'];
const CATEGORY_COLORS: Record<string, string> = {
  'Ăn uống': '#EF4444', 'Di chuyển': '#3B82F6', 'Chỗ ở': '#8B5CF6',
  'Vui chơi': '#F59E0B', 'Mua sắm': '#10B981', 'Khác': '#6B7280',
};
const CATEGORY_ICONS: Record<string, any> = {
  'Ăn uống': 'restaurant', 'Di chuyển': 'car', 'Chỗ ở': 'home',
  'Vui chơi': 'game-controller', 'Mua sắm': 'bag-handle', 'Khác': 'pricetag',
};
const ACT_TYPE_COLOR: Record<string, string> = {
  'Tham quan': '#3B82F6', 'Ăn uống': '#EF4444', 'Chỗ ở': '#8B5CF6',
  'Di chuyển': '#F59E0B', 'Mua sắm': '#10B981', 'Vui chơi': '#F97316',
};
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  UPCOMING: { label: 'SẮP TỚI',    color: '#F59E0B', bg: '#FEF3C7' },
  ONGOING:  { label: 'ĐANG ĐI',    color: '#3B82F6', bg: '#EFF6FF' },
  DONE:     { label: 'HOÀN THÀNH', color: '#10B981', bg: '#ECFDF5' },
};

function getChecklistItemId(item: ChecklistItem): string {
  return String(item.id || (item as ChecklistItem & { _id?: string })._id || '');
}

function fmtMoney(n: number) { return Math.abs(n).toLocaleString('vi-VN') + ' đ'; }
function formatDateInput(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`;
  return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
}

/* ──────────────────── PLAN TAB ──────────────────── */
function PlanTab({ tripId }: { tripId: string }) {
  const router = useRouter();
  const { getTrip, deleteActivity } = useApp();
  const trip = getTrip(tripId)!;
  const sorted = [...trip.activities].sort((a: Activity, b: Activity) => {
    const da: string = a.date.split('/').reverse().join('') + a.time;
    const db = b.date.split('/').reverse().join('') + b.time;
    return da.localeCompare(db);
  });
  const grouped: Record<string, Activity[]> = {};
  sorted.forEach(a => { (grouped[a.date] = grouped[a.date] || []).push(a); });
  const dates = Object.keys(grouped);
  if (!dates.length) return (
    <View style={s.emptyFull}>
      <View style={s.emptyIcon}><Ionicons name="calendar-outline" size={40} color="#9CA3AF" /></View>
      <Text style={s.emptyTitle}>Chưa có hoạt động nào</Text>
      <Text style={s.emptySub}>Nhấn + để thêm hoạt động đầu tiên</Text>
    </View>
  );
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      {dates.map(date => (
        <View key={date} style={{ marginBottom: 16 }}>
          <View style={s.dateBadge}>
            <Ionicons name="calendar-outline" size={13} color="#6B7280" />
            <Text style={s.dateHeader}>{date}</Text>
          </View>
          {grouped[date].map((act, i) => (
            <TouchableOpacity
              key={act.id}
              style={[s.actCard, i > 0 && { marginTop: 8 }]}
              onPress={() => router.push({ pathname: '/activity/[id]', params: { id: act.id, tripId, type: 'activity' } })}
              onLongPress={() => Alert.alert('Hoạt động', act.name, [
                { text: 'Sửa', onPress: () => router.push({ pathname: '/activity/[id]', params: { id: act.id, tripId, type: 'activity' } }) },
                { text: 'Xóa', style: 'destructive', onPress: () => { logAction('Activity', `delete ${act.id}`); deleteActivity(tripId, act.id); } },
                { text: 'Hủy', style: 'cancel' },
              ])}
            >
              <View style={s.actTimeBlock}>
                <Text style={s.actTime}>{act.time || '--:--'}</Text>
                <View style={[s.actDot, { backgroundColor: ACT_TYPE_COLOR[act.type?.[0]] || '#6B7280' }]} />
              </View>
              <View style={s.actBody}>
                <Text style={s.actName}>{act.name}</Text>
                {act.location ? (
                  <View style={s.actLocRow}>
                    <Ionicons name="location-outline" size={12} color="#9CA3AF" />
                    <Text style={s.actLoc}>{act.location}</Text>
                  </View>
                ) : null}
                <View style={s.actTagsRow}>
                  {act.type?.map(t => (
                    <View key={t} style={[s.actTag, { backgroundColor: (ACT_TYPE_COLOR[t] || '#6B7280') + '18' }]}>
                      <Text style={[s.actTagText, { color: ACT_TYPE_COLOR[t] || '#6B7280' }]}>{t}</Text>
                    </View>
                  ))}
                  {act.participants?.length > 0 && (
                    <View style={s.actParticipants}>
                      <Ionicons name="people-outline" size={11} color="#9CA3AF" />
                      <Text style={s.actParticipantsText}>{act.participants.length}</Text>
                    </View>
                  )}
                </View>
                {act.note ? <Text style={s.actNote} numberOfLines={1}>{act.note}</Text> : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

/* ──────────────────── CHECKLIST TAB ──────────────────── */
function ChecklistTab({ tripId }: { tripId: string }) {
  const router = useRouter();
  const { getTrip, updateChecklistItem, deleteChecklistItem } = useApp();
  const trip = getTrip(tripId)!;
  const [filter, setFilter] = useState<'all' | 'shared' | 'personal' | 'todo'>('all');
  const CAT_COLORS: Record<string, { bg: string; text: string }> = {
    shared: { bg: '#EFF6FF', text: '#1B4F8A' },
    personal: { bg: '#FEF3C7', text: '#92400E' },
    todo: { bg: '#F0FDF4', text: '#166534' },
  };
  const filtered = filter === 'all' ? trip.checklist : trip.checklist.filter(c => c.category === filter);
  const done = trip.checklist.filter(c => c.completed).length;
  const pct = trip.checklist.length ? Math.round(done / trip.checklist.length * 100) : 0;
  return (
    <View style={{ flex: 1 }}>
      <View style={s.clTopBar}>
        <View style={s.clProgressRow}>
          <Text style={s.clProgressLabel}>Tiến độ</Text>
          <Text style={s.clPct}>{pct}%</Text>
        </View>
        <View style={s.clBarBg}><View style={[s.clBarFill, { width: `${pct}%` as any }]} /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['all', 'shared', 'personal', 'todo'] as const).map(f => (
              <TouchableOpacity key={f} style={[s.filterChip, filter === f && s.filterChipActive]} onPress={() => setFilter(f)}>
                <Text style={[s.filterChipText, filter === f && s.filterChipTextActive]}>
                  {f === 'all' ? 'Tất cả' : f === 'shared' ? 'Nhóm' : f === 'personal' ? 'Cá nhân' : 'Việc cần làm'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
      <FlatList
        data={filtered} keyExtractor={getChecklistItemId}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
        ListEmptyComponent={<View style={s.emptyFull}><Ionicons name="checkbox-outline" size={40} color="#D1D5DB" /><Text style={s.emptyTitle}>Chưa có mục nào</Text></View>}
        renderItem={({ item }: { item: ChecklistItem }) => {
          const catColor = CAT_COLORS[item.category] || CAT_COLORS.shared;
          const assignee = trip.members.find(
            (m) =>
              String(m.id || (m as Member & { _id?: string })._id) ===
              item.assignee,
          );

          const assigneeName =
            assignee?.name ||
            (/^[a-f0-9]{24}$/i.test(item.assignee || "")
              ? "Thành viên không có trong nhóm"
              : item.assignee);
          return (
            <TouchableOpacity style={[s.clItem, item.completed && s.clItemDone]}
              onPress={() => router.push({ pathname: '/activity/[id]', params: { id: getChecklistItemId(item), tripId, type: 'checklist' } })}
              onLongPress={() => Alert.alert(item.name, '', [
                { text: 'Sửa', onPress: () => router.push({ pathname: '/activity/[id]', params: { id: getChecklistItemId(item), tripId, type: 'checklist' } }) },
                { text: 'Xóa', style: 'destructive', onPress: () => deleteChecklistItem(tripId, getChecklistItemId(item)) },
                { text: 'Hủy', style: 'cancel' },
              ])}
            >
              <TouchableOpacity style={[s.clCheck, item.completed && s.clCheckDone]}
                onPress={() => updateChecklistItem(tripId, getChecklistItemId(item), { completed: !item.completed })}>
                {item.completed && <Ionicons name="checkmark" size={14} color="#fff" />}
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={[s.clName, item.completed && s.clNameDone]}>{item.name}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 3, alignItems: 'center' }}>
                  {assigneeName ? ( <Text style={s.clMetaText}>👤 {assigneeName}</Text> ) : null}
                  {item.dueDate  ? <Text style={s.clMetaText}>📅 {item.dueDate}</Text>   : null}
                </View>
              </View>
              <View style={[s.clCatBadge, { backgroundColor: catColor.bg }]}>
                <Text style={[s.clCatText, { color: catColor.text }]}>
                  {item.category === 'shared' ? 'Nhóm' : item.category === 'personal' ? 'Cá nhân' : 'Việc làm'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

/* ──────────────────── EXPENSES TAB ──────────────────── */
function ExpensesTab({ tripId }: { tripId: string }) {
  const router = useRouter();
  const { getTrip, deleteExpense } = useApp();
  const trip = getTrip(tripId)!;
  const getPayerName = (value: string) => {
    const member = trip.members.find(
      (m) =>
        String(m.id) === value ||
        String((m as Member & { _id?: string })._id) === value,
    );

    if (member) return member.name;

    return /^[a-f0-9]{24}$/i.test(value || "")
      ? "Không xác định người trả"
      : value || "Chưa chọn người trả";
  };
  const total = trip.expenses.reduce((sum: number, e: Expense) => sum + e.amount, 0);
  const perPerson = trip.members.length > 0 ? total / trip.members.length : 0;
  const byCategory: Record<string, number> = {};
  trip.expenses.forEach((e: Expense) => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
  const topCat = Object.entries(byCategory).sort((a: [string, number], b: [string, number]) => b[1] - a[1])[0];
  return (
    <View style={{ flex: 1 }}>
      <View style={s.expTopBar}>
        <View style={s.expSummary}>
          <View style={s.expSummaryItem}><Text style={s.expSummaryVal}>{fmtMoney(total)}</Text><Text style={s.expSummaryLabel}>Tổng chi</Text></View>
          <View style={s.expSummaryDivider} />
          <View style={s.expSummaryItem}><Text style={s.expSummaryVal}>{fmtMoney(Math.round(perPerson))}</Text><Text style={s.expSummaryLabel}>Mỗi người</Text></View>
          <View style={s.expSummaryDivider} />
          <View style={s.expSummaryItem}><Text style={s.expSummaryVal}>{topCat ? topCat[0] : '—'}</Text><Text style={s.expSummaryLabel}>Nhiều nhất</Text></View>
        </View>
        <TouchableOpacity style={s.reportBtn} onPress={() => router.push({ pathname: '/trip/report', params: { tripId } })}>
          <Ionicons name="bar-chart-outline" size={18} color="#1B4F8A" />
          <Text style={s.reportBtnText}>Xem báo cáo quyết toán</Text>
          <Ionicons name="chevron-forward" size={16} color="#1B4F8A" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={trip.expenses} keyExtractor={e => e.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
        ListEmptyComponent={<View style={s.emptyFull}><Ionicons name="wallet-outline" size={40} color="#D1D5DB" /><Text style={s.emptyTitle}>Chưa có chi phí</Text></View>}
        renderItem={({ item }: { item: Expense }) => (
          <TouchableOpacity style={s.expCard}
            onPress={() => router.push({ pathname: '/activity/[id]', params: { id: item.id, tripId, type: 'expense' } })}
            onLongPress={() => Alert.alert(item.name, fmtMoney(item.amount), [
              { text: 'Sửa', onPress: () => router.push({ pathname: '/activity/[id]', params: { id: item.id, tripId, type: 'expense' } }) },
              { text: 'Xóa', style: 'destructive', onPress: () => deleteExpense(tripId, item.id) },
              { text: 'Hủy', style: 'cancel' },
            ])}
          >
            <View style={[s.expIconWrap, { backgroundColor: (CATEGORY_COLORS[item.category] || '#6B7280') + '18' }]}>
              <Ionicons name={CATEGORY_ICONS[item.category] || 'pricetag'} size={20} color={CATEGORY_COLORS[item.category] || '#6B7280'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.expName}>{item.name}</Text>
              <Text style={s.expMeta}>{getPayerName(item.paidBy)} · {item.splitType === 'equal' ? `Chia đều ${item.participants?.length || trip.members.length} người` : 'Chi tiết'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.expAmt}>-{fmtMoney(item.amount)}</Text>
              <Text style={s.expPerPerson}>{fmtMoney(Math.round(item.amount / Math.max(1, item.participants?.length || trip.members.length)))}/người</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

/* ──────────────────── MEMBERS TAB ──────────────────── */
function MembersTab({ tripId }: { tripId: string }) {
  const appCtx = useApp() as any;
  const { getTrip, removeMember, promoteMember, addMember } = appCtx;
  const findUser: ((q: string) => Promise<any>) | undefined = appCtx.findUser;
  const router = useRouter();
  const trip = getTrip(tripId)!;
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const inviteCode = (trip as any).inviteCode || tripId.slice(-6).toUpperCase();
  const inviteLink = `tripmate.app/join/${inviteCode}`;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const handleShare = async () => {
    await Share.share({ message: `Tham gia chuyến đi "${trip.name}" cùng tôi trên TripMate!\nMã mời: ${inviteCode}\nLink: ${inviteLink}` });
  };

  const handleSearchUser = async () => {
    const q = searchQuery.trim();
    if (!q) { Alert.alert('', 'Vui lòng nhập số điện thoại hoặc email'); return; }
    setSearching(true);
    setFoundUser(null);
    setNotFound(false);
    logAction('Member', `Search user: ${q}`);
    try {
      const result = findUser ? await findUser(q) : null;
      if (result) { setFoundUser(result); }
      else { setNotFound(true); }
    } catch { setNotFound(true); }
    finally { setSearching(false); }
  };

  const handleAddMember = async (phone: string, name?: string) => {
    if (trip.members.find((m: Member) => m.phone === phone)) {
      Alert.alert('', `${name || phone} đã là thành viên của chuyến đi này`);
      return;
    }
    logAction('Member', `Add to trip: ${phone}`);
    const ok = await addMember(tripId, phone);
    if (ok) {
      Alert.alert('✅ Thành công', `Đã thêm ${name || phone} vào chuyến đi`);
      setShowAddModal(false);
      setSearchQuery('');
      setFoundUser(null);
      setNotFound(false);
    } else {
      Alert.alert('Lỗi', 'Không thể thêm thành viên. Thử lại sau.');
    }
  };

  const handleRemoveMember = (member: Member) => {
    if (member.role === 'leader') {
      Alert.alert('Không thể xóa', 'Không thể xóa trưởng nhóm. Hãy chuyển quyền trước.');
      return;
    }
    Alert.alert(
      'Xóa thành viên',
      `Xóa ${member.name} khỏi chuyến đi "${trip.name}"?\nHành động này không thể hoàn tác.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa', style: 'destructive', onPress: async () => {
            logAction('Member', `Remove ${member.id} from trip ${tripId}`);
            try {
              await removeMember(tripId, member.id);
              setSelectedMember(null);
              Alert.alert('✅', `Đã xóa ${member.name} khỏi nhóm`);
            } catch (err: any) {
              Alert.alert('Lỗi', err.message || 'Không thể xóa thành viên');
            }
          }
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Invite banner */}
      <View style={s.inviteBanner}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ gap: 3 }}>
            <Text style={s.inviteTitleText}>MÃ MỜI CHUYẾN ĐI</Text>
            <Text style={s.inviteCodeText}>{inviteCode}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={s.inviteActionBtn} onPress={handleCopy}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={15} color={copied ? '#10B981' : '#fff'} />
              <Text style={[s.inviteActionTxt, copied && { color: '#10B981' }]}>{copied ? 'Đã sao chép' : 'Sao chép'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.inviteActionBtn, s.inviteShareBtn]} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={15} color="#1B4F8A" />
              <Text style={s.inviteShareTxt}>Chia sẻ</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={s.inviteHint}>Chia sẻ mã này để mời thêm thành viên tham gia</Text>
      </View>

      {/* Members header */}
      <View style={s.membersTopBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.membersTripName}>{trip.name}</Text>
          <Text style={s.membersMeta}>{trip.members.length} thành viên · {trip.startDate} – {trip.endDate}</Text>
        </View>
        <TouchableOpacity style={s.addMemberBtn} onPress={() => setShowAddModal(true)}>
          <Ionicons name="person-add-outline" size={16} color="#1B4F8A" />
          <Text style={s.addMemberTxt}>Thêm</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={trip.members} keyExtractor={m => m.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
        ListEmptyComponent={<View style={s.emptyFull}><Ionicons name="people-outline" size={40} color="#D1D5DB" /><Text style={s.emptyTitle}>Chưa có thành viên</Text></View>}
        renderItem={({ item }: { item: Member }) => {
          const paid = trip.expenses
            .filter((e: Expense) => e.paidBy === item.name.split(' ')[0] || (e as any).paidById === item.id)
            .reduce((sum: number, e: Expense) => sum + e.amount, 0);
          return (
            <TouchableOpacity style={s.memberCard} onPress={() => setSelectedMember(item)} activeOpacity={0.8}>
              <View style={[s.memberAvatar, item.role === 'leader' && s.memberAvatarLeader]}>
                <Text style={s.memberAvatarText}>{item.initials?.slice(0,1) || item.name[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                  <Text style={s.memberName}>{item.name}</Text>
                  {item.role === 'leader' && (
                    <View style={s.leaderBadge}>
                      <Ionicons name="star" size={9} color="#92400E" />
                      <Text style={s.leaderBadgeText}>Trưởng nhóm</Text>
                    </View>
                  )}
                </View>
                <Text style={s.memberPhone}>{item.phone}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.memberPaidAmt}>{paid > 0 ? fmtMoney(paid) : '—'}</Text>
                <Text style={s.memberPaidLabel}>đã trả</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Member action sheet */}
      <Modal visible={!!selectedMember} transparent animationType="slide" onRequestClose={() => setSelectedMember(null)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setSelectedMember(null)}>
          <View style={s.actionSheet}>
            {selectedMember && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 16 }}>
                  <View style={[s.memberAvatar, selectedMember.role === 'leader' && s.memberAvatarLeader]}>
                    <Text style={s.memberAvatarText}>{selectedMember.initials?.slice(0,1) || selectedMember.name[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: '#111' }}>{selectedMember.name}</Text>
                    <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{selectedMember.phone}</Text>
                  </View>
                </View>
                <View style={{ height: 1, backgroundColor: '#F3F4F6', marginBottom: 10 }} />
                {selectedMember.role !== 'leader' && (
                  <TouchableOpacity style={s.sheetItem} onPress={() => { promoteMember(tripId, selectedMember.id); setSelectedMember(null); }}>
                    <View style={[s.sheetIcon, { backgroundColor: '#FEF3C7' }]}><Ionicons name="star-outline" size={18} color="#F59E0B" /></View>
                    <Text style={s.sheetLabel}>Đặt làm trưởng nhóm</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.sheetItem} onPress={() => {
                  setSelectedMember(null);
                  setTimeout(() => Share.share({ message: `Mời ${selectedMember.name} vào chuyến "${trip.name}"!\nLink: ${inviteLink}` }), 300);
                }}>
                  <View style={[s.sheetIcon, { backgroundColor: '#F0F9FF' }]}><Ionicons name="share-social-outline" size={18} color="#0284C7" /></View>
                  <Text style={s.sheetLabel}>Gửi link mời</Text>
                </TouchableOpacity>
                {selectedMember.role !== 'leader' && (
                  <TouchableOpacity style={s.sheetItem} onPress={() => handleRemoveMember(selectedMember)}>
                    <View style={[s.sheetIcon, { backgroundColor: '#FEE2E2' }]}><Ionicons name="person-remove-outline" size={18} color="#EF4444" /></View>
                    <Text style={[s.sheetLabel, { color: '#EF4444' }]}>Xóa khỏi nhóm</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.sheetCancel} onPress={() => setSelectedMember(null)}>
                  <Text style={{ fontSize: 15, color: '#374151', fontWeight: '600' }}>Đóng</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add member modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.actionSheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>👤 Thêm thành viên</Text>
              <TouchableOpacity onPress={() => { setShowAddModal(false); setSearchQuery(''); setFoundUser(null); setNotFound(false); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>Tìm bạn qua số điện thoại hoặc email</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <View style={s.searchInputWrap}>
                <Ionicons name="search-outline" size={16} color="#9CA3AF" />
                <TextInput
                  style={s.searchInput}
                  placeholder="0912 345 678 hoặc email@..."
                  placeholderTextColor="#C0C8D0"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  keyboardType="default"
                  returnKeyType="search"
                  onSubmitEditing={handleSearchUser}
                  autoFocus
                />
              </View>
              <TouchableOpacity style={s.searchBtn} onPress={handleSearchUser} disabled={searching}>
                {searching ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.searchBtnText}>Tìm</Text>}
              </TouchableOpacity>
            </View>

            {/* Found user */}
            {foundUser && (
              <View style={s.foundCard}>
                <View style={s.memberAvatar}>
                  <Text style={s.memberAvatarText}>{(foundUser.username || foundUser.name || '?')[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#111' }}>{foundUser.username || foundUser.name}</Text>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{foundUser.phone || foundUser.email}</Text>
                </View>
                <TouchableOpacity style={s.inviteBtn} onPress={() => handleAddMember(foundUser.phone || searchQuery, foundUser.username)}>
                  <Ionicons name="person-add" size={16} color="#fff" />
                  <Text style={s.inviteBtnText}>Mời vào</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Not found — allow manual add */}
            {notFound && (
              <View style={s.notFoundBox}>
                <Ionicons name="information-circle-outline" size={20} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: '#92400E', fontWeight: '600' }}>Không tìm thấy tài khoản</Text>
                  <Text style={{ fontSize: 12, color: '#B45309', marginTop: 2 }}>Bạn vẫn có thể mời qua số điện thoại</Text>
                </View>
                <TouchableOpacity style={[s.inviteBtn, { backgroundColor: '#F59E0B' }]} onPress={() => handleAddMember(searchQuery.trim())}>
                  <Text style={s.inviteBtnText}>Thêm</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={s.sheetCancel} onPress={() => { setShowAddModal(false); setSearchQuery(''); setFoundUser(null); setNotFound(false); }}>
              <Text style={{ fontSize: 15, color: '#374151', fontWeight: '600' }}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ──────────────────── EDIT TRIP MODAL ──────────────────── */
function EditTripModal({ trip, visible, onClose }: { trip: any; visible: boolean; onClose: () => void }) {
  const { updateTrip } = useApp() as any;
  const [form, setForm] = useState({
    name: trip.name,
    startDate: trip.startDate,
    endDate: trip.endDate,
    description: trip.description || '',
    destinations: trip.destinations || [] as string[],
    image: trip.image || '',
  });
  const [destInput, setDestInput] = useState('');
  const [saving, setSaving] = useState(false);

  const addDest = (d: string) => {
    const t = d.trim();
    if (!t || form.destinations.includes(t)) return;
    setForm(p => ({ ...p, destinations: [...p.destinations, t] }));
    setDestInput('');
  };
  const removeDest = (d: string) => setForm(p => ({ ...p, destinations: p.destinations.filter((x: string) => x !== d) }));

  const pickCoverImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Quyền truy cập', 'Cần cấp quyền truy cập thư viện ảnh để chọn ảnh bìa cho chuyến đi.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;
    setForm(p => ({ ...p, image: result.assets[0].uri }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('', 'Tên chuyến đi không được trống'); return; }
    setSaving(true);
    logAction('Trip', `Edit trip: ${trip.id}`);
    try {
      if (typeof updateTrip === 'function') {
        await updateTrip(trip.id, form);
      }
      onClose();
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể cập nhật chuyến đi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={s.editHeader}>
          <TouchableOpacity onPress={onClose} style={s.editHeaderBtn}>
            <Ionicons name="close" size={22} color="#374151" />
          </TouchableOpacity>
          <Text style={s.editHeaderTitle}>Chỉnh sửa chuyến đi</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={[s.editHeaderBtn, { backgroundColor: '#1B4F8A' }]}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Lưu</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }}>
          <View>
            <Text style={s.editLabel}>Ảnh bìa</Text>
            <TouchableOpacity style={s.editCoverUpload} onPress={pickCoverImage}>
              {form.image ? (
                <Image source={{ uri: form.image }} style={s.editCoverPreview} resizeMode="cover" />
              ) : (
                <View style={s.editCoverPlaceholder}>
                  <View style={s.editCoverIconWrap}>
                    <Ionicons name="camera" size={20} color="#1B4F8A" />
                  </View>
                  <Text style={s.editCoverTitle}>Thêm ảnh bìa</Text>
                </View>
              )}
            </TouchableOpacity>
            <Text style={s.editCoverHint}>Hãy update ảnh có tỉ lệ ngang khoảng 16:9.</Text>
          </View>
          {/* Name */}
          <View>
            <Text style={s.editLabel}>Tên chuyến đi *</Text>
            <TextInput style={s.editInput} value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} placeholder="Tên chuyến đi..." placeholderTextColor="#C0C8D0" />
          </View>
          {/* Dates */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.editLabel}>Ngày bắt đầu</Text>
              <View style={s.editDateWrap}>
                <Ionicons name="calendar-outline" size={15} color="#6B7280" />
                <TextInput style={{ flex: 1, fontSize: 14, color: '#111' }} value={form.startDate}
                  onChangeText={v => setForm(p => ({ ...p, startDate: formatDateInput(v) }))}
                  placeholder="DD/MM/YYYY" placeholderTextColor="#C0C8D0" keyboardType="numeric" maxLength={10} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.editLabel}>Ngày kết thúc</Text>
              <View style={s.editDateWrap}>
                <Ionicons name="calendar-outline" size={15} color="#6B7280" />
                <TextInput style={{ flex: 1, fontSize: 14, color: '#111' }} value={form.endDate}
                  onChangeText={v => setForm(p => ({ ...p, endDate: formatDateInput(v) }))}
                  placeholder="DD/MM/YYYY" placeholderTextColor="#C0C8D0" keyboardType="numeric" maxLength={10} />
              </View>
            </View>
          </View>
          {/* Description */}
          <View>
            <Text style={s.editLabel}>Mô tả</Text>
            <TextInput style={[s.editInput, { height: 80, textAlignVertical: 'top' }]}
              value={form.description} onChangeText={v => setForm(p => ({ ...p, description: v }))}
              placeholder="Mô tả chuyến đi..." placeholderTextColor="#C0C8D0" multiline numberOfLines={3} />
          </View>
          {/* Destinations */}
          <View>
            <Text style={s.editLabel}>Điểm đến</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <View style={[s.editInput, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 0 }]}>
                <Ionicons name="location-outline" size={15} color="#9CA3AF" />
                <TextInput style={{ flex: 1, fontSize: 14, color: '#111', paddingVertical: 12 }}
                  value={destInput} onChangeText={setDestInput}
                  placeholder="Thêm địa điểm..." placeholderTextColor="#C0C8D0"
                  returnKeyType="done" onSubmitEditing={() => addDest(destInput)} />
              </View>
              <TouchableOpacity style={s.searchBtn} onPress={() => addDest(destInput)}>
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {form.destinations.map((d: string) => (
                <View key={d} style={s.destChip}>
                  <Ionicons name="location" size={13} color="#1B4F8A" />
                  <Text style={s.destChipText}>{d}</Text>
                  <TouchableOpacity onPress={() => removeDest(d)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/* ──────────────────── MAIN SCREEN ──────────────────── */
export default function TripDashboard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getTrip, deleteTrip, refreshTrips } = useApp();
  const [tab, setTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const trip = getTrip(id!);

  // ── Fix GO_BACK: use replace when no history ──────────────────────────────
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/trips');
    }
  };

  if (!trip) return (
    <SafeAreaView style={[s.safe, { justifyContent: 'center', alignItems: 'center' }]}>
      <Ionicons name="alert-circle-outline" size={48} color="#D1D5DB" />
      <Text style={{ fontSize: 16, color: '#6B7280', marginTop: 12 }}>Không tìm thấy chuyến đi</Text>
      <TouchableOpacity onPress={goBack}
        style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#1B4F8A', borderRadius: 12 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Quay lại</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );

  const statusCfg = STATUS_CONFIG[trip.status] || STATUS_CONFIG.UPCOMING;
  const totalCost = trip.expenses.reduce((sum: number, e: Expense) => sum + e.amount, 0);
  const doneCheck = trip.checklist.filter((c: ChecklistItem) => c.completed).length;

  const handleFab = () => {
    const types = ['activity', 'checklist', 'expense', 'member'];
    if (tab === 3) return; // Members tab has its own add button
    router.push({ pathname: '/activity/[id]', params: { id: 'new', tripId: id, type: types[tab] } });
  };

  const handleMenu = () => Alert.alert(trip.name, 'Chọn hành động', [
    { text: '✏️ Chỉnh sửa chuyến đi', onPress: () => setShowEdit(true) },
    { text: '🔄 Làm mới dữ liệu', onPress: async () => { setRefreshing(true); await refreshTrips(); setRefreshing(false); } },
    { text: '🗑 Xóa chuyến đi', style: 'destructive', onPress: () =>
        Alert.alert('Xác nhận xóa', 'Dữ liệu sẽ bị xóa vĩnh viễn. Tiếp tục?', [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Xóa', style: 'destructive', onPress: () => { deleteTrip(id!); router.replace('/(tabs)/trips'); } },
        ]) },
    { text: 'Hủy', style: 'cancel' },
  ]);

  return (
    <View style={s.safe}>
      {/* Hero banner */}
      <View style={s.hero}>
        <Image source={{ uri: trip.image || 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80' }}
          style={s.heroImg} resizeMode="cover" />
        <View style={s.heroOverlay} />
        <SafeAreaView style={s.heroTopBar} edges={['top']}>
          <TouchableOpacity style={s.heroBtn} onPress={goBack}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={s.heroBtn} onPress={() => setShowEdit(true)}>
              <Ionicons name="create-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={s.heroBtn} onPress={handleMenu}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        <View style={s.heroContent}>
          <View style={[s.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[s.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>
          <Text style={s.heroTitle} numberOfLines={2}>{trip.name}</Text>
          <View style={{ gap: 4, marginBottom: 12 }}>
            <View style={s.heroMetaItem}>
              <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.8)" />
              <Text style={s.heroMetaText}>{trip.startDate} – {trip.endDate}</Text>
            </View>
            <View style={s.heroMetaItem}>
              <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.8)" />
              <Text style={s.heroMetaText}>{trip.destinations?.join(', ') || 'Chưa xác định'}</Text>
            </View>
          </View>
          <View style={s.heroStats}>
            {[
              { val: fmtMoney(totalCost), lbl: 'Tổng chi' },
              { val: String(trip.members.length), lbl: 'Thành viên' },
              { val: String(trip.activities.length), lbl: 'Hoạt động' },
              { val: `${doneCheck}/${trip.checklist.length}`, lbl: 'Checklist' },
            ].map((item, i, arr) => (
              <React.Fragment key={item.lbl}>
                <View style={s.heroStatItem}>
                  <Text style={s.heroStatVal} numberOfLines={1}>{item.val}</Text>
                  <Text style={s.heroStatLabel}>{item.lbl}</Text>
                </View>
                {i < arr.length - 1 && <View style={s.heroStatDivider} />}
              </React.Fragment>
            ))}
          </View>
        </View>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map((t, i) => (
          <TouchableOpacity key={t} style={[s.tabItem, tab === i && s.tabItemActive]} onPress={() => setTab(i)}>
            <Text style={[s.tabText, tab === i && s.tabTextActive]}>{t}</Text>
            {i === 1 && trip.checklist.length > 0 && (
              <View style={[s.tabBadge, { backgroundColor: doneCheck === trip.checklist.length ? '#10B981' : '#F59E0B' }]}>
                <Text style={s.tabBadgeText}>{doneCheck}/{trip.checklist.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {tab === 0 && <PlanTab      tripId={id!} />}
        {tab === 1 && <ChecklistTab tripId={id!} />}
        {tab === 2 && <ExpensesTab  tripId={id!} />}
        {tab === 3 && <MembersTab   tripId={id!} />}
      </View>

      {/* FAB — hide on members tab */}
      {tab !== 3 && (
        <TouchableOpacity style={s.fab} onPress={handleFab}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Edit Trip Modal */}
      {showEdit && <EditTripModal trip={trip} visible={showEdit} onClose={() => setShowEdit(false)} />}
    </View>
  );
}

/* ──────────────────── STYLES ──────────────────── */
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  hero: { height: 260, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  heroTopBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 4 },
  heroBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  heroContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginBottom: 6 },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroMetaText: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  heroStats: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.32)', borderRadius: 12, padding: 10 },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatVal: { fontSize: 12, fontWeight: '800', color: '#fff' },
  heroStatLabel: { fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tabItem: { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent', position: 'relative' },
  tabItemActive: { borderBottomColor: '#1B4F8A' },
  tabText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  tabTextActive: { color: '#1B4F8A', fontWeight: '700' },
  tabBadge: { position: 'absolute', top: 6, right: 2, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8 },
  tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  editCoverUpload: { borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 16, overflow: 'hidden', backgroundColor: '#F9FAFB' },
  editCoverPlaceholder: { height: 180, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FB', gap: 8 },
  editCoverIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E0ECFF', justifyContent: 'center', alignItems: 'center' },
  editCoverTitle: { fontSize: 15, fontWeight: '700', color: '#1B4F8A' },
  editCoverHint: { fontSize: 12, color: '#6B7280', marginTop: 8 },
  editCoverPreview: { width: '100%', height: 180 },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#1B4F8A', justifyContent: 'center', alignItems: 'center', shadowColor: '#1B4F8A', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  // Plan
  dateBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  dateHeader: { fontSize: 12, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5 },
  actCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  actTimeBlock: { alignItems: 'center', gap: 6, width: 44 },
  actTime: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  actDot: { width: 8, height: 8, borderRadius: 4 },
  actBody: { flex: 1, gap: 4 },
  actName: { fontSize: 15, fontWeight: '700', color: '#111' },
  actLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  actLoc: { fontSize: 12, color: '#9CA3AF', flex: 1 },
  actTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 },
  actTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  actTagText: { fontSize: 11, fontWeight: '600' },
  actParticipants: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: '#F3F4F6', borderRadius: 8 },
  actParticipantsText: { fontSize: 11, color: '#9CA3AF' },
  actNote: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', marginTop: 2 },
  // Checklist
  clTopBar: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 10 },
  clProgressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clProgressLabel: { fontSize: 14, color: '#374151', fontWeight: '500' },
  clPct: { fontSize: 16, fontWeight: '800', color: '#1B4F8A' },
  clBarBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  clBarFill: { height: '100%', backgroundColor: '#1B4F8A', borderRadius: 4 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB' },
  filterChipActive: { backgroundColor: '#EFF6FF', borderColor: '#1B4F8A' },
  filterChipText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  filterChipTextActive: { color: '#1B4F8A', fontWeight: '700' },
  clItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  clItemDone: { opacity: 0.65 },
  clCheck: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
  clCheckDone: { backgroundColor: '#1B4F8A', borderColor: '#1B4F8A' },
  clName: { fontSize: 14, fontWeight: '600', color: '#111' },
  clNameDone: { textDecorationLine: 'line-through', color: '#9CA3AF' },
  clMetaText: { fontSize: 12, color: '#9CA3AF' },
  clCatBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  clCatText: { fontSize: 11, fontWeight: '700' },
  // Expenses
  expTopBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', padding: 16, gap: 12 },
  reportBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: '#BFDBFE' },
  reportBtnText: { flex: 1, fontSize: 14, color: '#1B4F8A', fontWeight: '600' },
  expSummary: { flexDirection: 'row', backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  expSummaryItem: { flex: 1, alignItems: 'center' },
  expSummaryVal: { fontSize: 13, fontWeight: '800', color: '#1B4F8A' },
  expSummaryLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  expSummaryDivider: { width: 1, backgroundColor: '#E5E7EB' },
  expCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 1 },
  expIconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  expName: { fontSize: 14, fontWeight: '700', color: '#111' },
  expMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  expAmt: { fontSize: 15, fontWeight: '800', color: '#EF4444' },
  expPerPerson: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  // Members
  inviteBanner: { backgroundColor: '#1B4F8A', padding: 16, gap: 8 },
  inviteTitleText: { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '700', letterSpacing: 1 },
  inviteCodeText: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: 5 },
  inviteActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10 },
  inviteActionTxt: { fontSize: 12, color: '#fff', fontWeight: '600' },
  inviteShareBtn: { backgroundColor: '#fff' },
  inviteShareTxt: { fontSize: 12, color: '#1B4F8A', fontWeight: '700' },
  inviteHint: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  membersTopBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12 },
  membersTripName: { fontSize: 15, fontWeight: '700', color: '#111' },
  membersMeta: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  addMemberBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: '#BFDBFE' },
  addMemberTxt: { fontSize: 13, color: '#1B4F8A', fontWeight: '700' },
  memberCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 1 },
  memberAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#1B4F8A', justifyContent: 'center', alignItems: 'center' },
  memberAvatarLeader: { backgroundColor: '#F59E0B' },
  memberAvatarText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  memberName: { fontSize: 15, fontWeight: '700', color: '#111' },
  leaderBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FEF3C7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  leaderBadgeText: { fontSize: 10, color: '#92400E', fontWeight: '600' },
  memberPhone: { fontSize: 12, color: '#6B7280' },
  memberPaidAmt: { fontSize: 13, fontWeight: '700', color: '#1B4F8A' },
  memberPaidLabel: { fontSize: 10, color: '#9CA3AF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  actionSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, gap: 2 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  sheetIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sheetLabel: { fontSize: 15, color: '#111', fontWeight: '500' },
  sheetCancel: { marginTop: 8, backgroundColor: '#F3F4F6', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  // Search / add member
  searchInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#F9FAFB' },
  searchInput: { flex: 1, fontSize: 15, color: '#111', paddingVertical: 12 },
  searchBtn: { backgroundColor: '#1B4F8A', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, justifyContent: 'center', alignItems: 'center' },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  foundCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ECFDF5', borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: '#A7F3D0', marginBottom: 10 },
  notFoundBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFBEB', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#FDE68A', marginBottom: 10 },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1B4F8A', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  inviteBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  // Edit trip
  editHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  editHeaderBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, minWidth: 60, alignItems: 'center', justifyContent: 'center' },
  editHeaderTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  editLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  editInput: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#111', backgroundColor: '#F9FAFB' },
  editDateWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#F9FAFB' },
  destChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1.5, borderColor: '#BFDBFE' },
  destChipText: { fontSize: 13, color: '#1B4F8A', fontWeight: '600' },
  // Empty states
  emptyFull: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#6B7280' },
  emptySub: { fontSize: 13, color: '#9CA3AF' },
});