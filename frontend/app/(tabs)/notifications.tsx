import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  FlatList, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import type { Notif } from "../../context/AppContext";
import TabPageTransition from "../../components/TabPageTransition";

export default function NotificationsScreen() {
  const router = useRouter();
  const {
    notifications,
    readIds,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useApp();

  const handlePress = (n: Notif) => {
    markNotificationRead(n.id);

    if (n.tripId) {
      if (n.type === "expense" || n.type === "done") {
        router.push({
          pathname: "/trip/report",
          params: { tripId: n.tripId },
        });
      } else {
        router.push(`/trip/${n.tripId}`);
      }
    }
  };

  return (
    <TabPageTransition index={1}>
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Text style={s.title}>Thông báo</Text>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllNotificationsRead} style={s.markAllBtn}>
              <Text style={s.markAllText}>Đọc tất cả</Text>
            </TouchableOpacity>
          )}
        </View>

        {unreadCount > 0 && (
          <View style={s.unreadBar}>
            <View style={s.unreadDot} />
            <Text style={s.unreadText}>{unreadCount} thông báo chưa đọc</Text>
          </View>
        )}

        <FlatList
          data={notifications}
          keyExtractor={n => n.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          renderItem={({ item }) => {
            const isRead = readIds.has(item.id);
            return (
              <TouchableOpacity
                style={[s.card, !isRead && s.cardUnread]}
                onPress={() => handlePress(item)}
                activeOpacity={0.75}
              >
                <View style={[s.iconWrap, { backgroundColor: item.iconBg }]}>
                  <Ionicons name={item.icon} size={22} color={item.iconColor} />
                </View>
                <View style={s.cardBody}>
                  <View style={s.cardTop}>
                    <Text style={[s.cardTitle, !isRead && s.cardTitleUnread]} numberOfLines={1}>{item.title}</Text>
                    {!isRead && <View style={s.unreadPip} />}
                  </View>
                  <Text style={s.cardDesc} numberOfLines={2}>{item.body}</Text>
                  <Text style={s.cardTime}>{item.time}</Text>
                </View>
                {item.tripId ? (
                  <Ionicons name="chevron-forward" size={14} color="#D1D5DB" />
                ) : null}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <View style={s.emptyIcon}><Ionicons name="notifications-off-outline" size={40} color="#9CA3AF" /></View>
              <Text style={s.emptyTitle}>Không có thông báo</Text>
              <Text style={s.emptySub}>Thông báo sẽ xuất hiện khi có chuyến đi</Text>
            </View>
          }
        />
      </SafeAreaView>
    </TabPageTransition>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  title: { fontSize: 22, fontWeight: '800', color: '#111' },
  markAllBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#EFF6FF', borderRadius: 10 },
  markAllText: { fontSize: 13, color: '#1B4F8A', fontWeight: '600' },
  unreadBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', paddingHorizontal: 20, paddingVertical: 10 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1B4F8A' },
  unreadText: { fontSize: 13, color: '#1B4F8A', fontWeight: '600' },
  list: { paddingVertical: 8, paddingHorizontal: 0 },
  sep: { height: 1, backgroundColor: '#F9FAFB' },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff' },
  cardUnread: { backgroundColor: '#FAFCFF' },
  iconWrap: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  cardBody: { flex: 1, gap: 3 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: '500', color: '#374151', flex: 1 },
  cardTitleUnread: { fontWeight: '700', color: '#111' },
  unreadPip: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1B4F8A', marginLeft: 8 },
  cardDesc: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  cardTime: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151' },
  emptySub: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
});
