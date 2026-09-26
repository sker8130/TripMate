import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";

import {
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { useApp } from "../../context/AppContext";
import { Trip } from "../../types";

import { computeTripStatus, daysUntil, fmtVND } from "../../utils/helpers";

const COLORS = {
  orange: "#F56A16",
  orangeSoft: "#FFF0E5",

  mint: "#EAF6F4",
  mintDeep: "#DDF0ED",

  white: "#FFFFFF",

  text: "#111315",
  muted: "#6D737B",
  lightText: "#9AA0A6",

  border: "#ECEDE8",
  chip: "#F5F5F3",

  green: "#1F9D73",
  greenSoft: "#E8F7F1",

  gray: "#667078",

  yellow: "#B67600",
  yellowSoft: "#FFF4D8",
};

const STATUS_CONFIG = {
  UPCOMING: {
    label: "Sắp tới",
    backgroundColor: COLORS.orange,
  },

  ONGOING: {
    label: "Đang đi",
    backgroundColor: COLORS.green,
  },

  DONE: {
    label: "Hoàn thành",
    backgroundColor: COLORS.gray,
  },
};

function TripCard({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  const status = computeTripStatus(trip.startDate, trip.endDate);

  const cfg = STATUS_CONFIG[status];

  const total =
    trip.expenses?.reduce((sum, expense) => sum + expense.amount, 0) || 0;

  const days = daysUntil(trip.startDate);

  const checkDone =
    trip.checklist?.filter((item) => item.completed).length || 0;

  const checkTotal = trip.checklist?.length || 0;

  const statusLabel =
    status === "UPCOMING" && days > 0
      ? `${cfg.label} • ${days} ngày nữa`
      : cfg.label;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {/* ẢNH */}
      <View style={styles.cardImageWrap}>
        <Image
          source={{
            uri:
              trip.image ||
              "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80",
          }}
          style={styles.cardImage}
          resizeMode="cover"
        />

        {/* BADGE TRẠNG THÁI */}
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: cfg.backgroundColor,
            },
          ]}
        >
          {status === "UPCOMING" ? (
            <Ionicons name="time-outline" size={13} color={COLORS.white} />
          ) : status === "ONGOING" ? (
            <Ionicons name="navigate-outline" size={13} color={COLORS.white} />
          ) : (
            <Ionicons
              name="checkmark-circle-outline"
              size={13}
              color={COLORS.white}
            />
          )}

          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>

      {/* BODY */}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {trip.name}
        </Text>

        {/* META */}
        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="location" size={15} color={COLORS.orange} />

            <Text style={styles.metaText} numberOfLines={1}>
              {trip.destinations?.join(", ") || "Chưa xác định điểm đến"}
            </Text>
          </View>

          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={15} color={COLORS.text} />

            <Text style={styles.metaText}>
              {trip.startDate} – {trip.endDate}
            </Text>
          </View>
        </View>

        {/* MEMBERS + STATS */}
        <View style={styles.infoRow}>
          <View style={styles.avatarsRow}>
            {trip.members?.slice(0, 4).map((member, index) => (
              <View
                key={member.id}
                style={[
                  styles.avatar,
                  {
                    marginLeft: index > 0 ? -8 : 0,

                    zIndex: 5 - index,
                  },
                ]}
              >
                <Text style={styles.avatarText}>
                  {member.initials?.[0] || "?"}
                </Text>
              </View>
            ))}

            {(trip.members?.length || 0) > 4 ? (
              <View
                style={[
                  styles.avatar,
                  styles.avatarMore,
                  {
                    marginLeft: -8,
                  },
                ]}
              >
                <Text style={styles.avatarText}>
                  +{trip.members!.length - 4}
                </Text>
              </View>
            ) : null}

            <Text style={styles.memberCount}>
              {trip.members?.length || trip.memberCount || 0} người
            </Text>
          </View>

          <View style={styles.quickStats}>
            {checkTotal > 0 ? (
              <View style={styles.statPill}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={14}
                  color={COLORS.green}
                />

                <Text style={styles.statText}>
                  {checkDone}/{checkTotal}
                </Text>
              </View>
            ) : null}

            <View style={styles.costWrap}>
              <Text style={styles.costLabel}>Tổng chi</Text>

              <Text style={styles.costValue}>{fmtVND(total)}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function TripsScreen() {
  const router = useRouter();

  const { trips, user, refreshTrips, isOnline } = useApp();

  const [search, setSearch] = useState("");

  const [filter, setFilter] = useState<"all" | "UPCOMING" | "ONGOING" | "DONE">(
    "all",
  );

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);

    await refreshTrips();

    setRefreshing(false);
  };

  const filtered = trips
    .map((trip) => ({
      ...trip,

      status: computeTripStatus(trip.startDate, trip.endDate),
    }))

    .filter((trip) => {
      const keyword = search.trim().toLowerCase();

      const matchSearch =
        trip.name.toLowerCase().includes(keyword) ||
        trip.destinations?.some((destination) =>
          destination.toLowerCase().includes(keyword),
        );

      const matchFilter = filter === "all" || trip.status === filter;

      return matchSearch && matchFilter;
    })

    .sort((a, b) => {
      const order = {
        ONGOING: 0,
        UPCOMING: 1,
        DONE: 2,
      };

      return order[a.status] - order[b.status];
    });

  const counts = {
    all: trips.length,

    UPCOMING: trips.filter(
      (trip) => computeTripStatus(trip.startDate, trip.endDate) === "UPCOMING",
    ).length,

    ONGOING: trips.filter(
      (trip) => computeTripStatus(trip.startDate, trip.endDate) === "ONGOING",
    ).length,

    DONE: trips.filter(
      (trip) => computeTripStatus(trip.startDate, trip.endDate) === "DONE",
    ).length,
  };

  const filters = [
    {
      key: "all",
      label: `Tất cả (${counts.all})`,
    },

    {
      key: "ONGOING",
      label: `Đang đi (${counts.ONGOING})`,
    },

    {
      key: "UPCOMING",
      label: `Sắp tới (${counts.UPCOMING})`,
    },

    {
      key: "DONE",
      label: `Đã xong (${counts.DONE})`,
    },
  ] as const;

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={filtered}
        keyExtractor={(trip) => trip.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.orange}
          />
        }
        ListHeaderComponent={
          <View>
            {/* HEADER */}
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.greeting}>Xin chào</Text>

                <Text style={styles.headerTitle} numberOfLines={1}>
                  {user?.username || "TripMate"}
                </Text>
              </View>

              <View style={styles.headerActions}>
                {/* JOIN TRIP */}
                <TouchableOpacity
                  onPress={() => router.push("/trip/join")}
                  style={styles.circleBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="qr-code-outline"
                    size={21}
                    color={COLORS.text}
                  />
                </TouchableOpacity>

                {/* AVATAR */}
                <TouchableOpacity
                  onPress={() => router.push("/profile/index" as any)}
                  style={styles.userAvatar}
                  activeOpacity={0.8}
                >
                  <Text style={styles.userAvatarText}>
                    {user?.username?.[0]?.toUpperCase() || "U"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* SEARCH */}
            <View style={styles.searchRow}>
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={20} color={COLORS.text} />

                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm chuyến đi, điểm đến..."
                  placeholderTextColor={COLORS.lightText}
                  value={search}
                  onChangeText={setSearch}
                />

                {search.length > 0 ? (
                  <TouchableOpacity onPress={() => setSearch("")}>
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={COLORS.lightText}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.filterIconBtn}>
                <Ionicons
                  name="options-outline"
                  size={21}
                  color={COLORS.text}
                />
              </View>
            </View>

            {/* FILTERS */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterContent}
            >
              {filters.map((item) => {
                const active = filter === item.key;

                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.filterChip,

                      active && styles.filterChipActive,
                    ]}
                    onPress={() => setFilter(item.key)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.filterText,

                        active && styles.filterTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* OFFLINE */}
            {!isOnline ? (
              <View style={styles.offlineBanner}>
                <Ionicons
                  name="cloud-offline-outline"
                  size={15}
                  color={COLORS.yellow}
                />

                <Text style={styles.offlineText}>
                  Đang xem dữ liệu ngoại tuyến · Kết nối internet để đồng bộ
                </Text>
              </View>
            ) : null}

            {/* TITLE */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Chuyến đi của tôi</Text>

              <Text style={styles.tripCount}>{filtered.length} chuyến đi</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <TripCard
            trip={item}
            onPress={() => router.push(`/trip/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="airplane-outline"
                size={42}
                color={COLORS.orange}
              />
            </View>

            <Text style={styles.emptyTitle}>
              {search ? "Không tìm thấy chuyến đi" : "Chưa có chuyến đi nào"}
            </Text>

            <Text style={styles.emptySub}>
              {search
                ? "Thử tìm kiếm bằng một từ khóa khác."
                : "Tạo chuyến đi đầu tiên để bắt đầu lên kế hoạch."}
            </Text>

            {!search ? (
              <TouchableOpacity
                style={styles.emptyCreateBtn}
                onPress={() => router.push("/trip/create")}
                activeOpacity={0.85}
              >
                <Text style={styles.emptyCreateText}>Tạo chuyến đi</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/trip/create")}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={30} color={COLORS.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,

    backgroundColor: COLORS.white,
  },

  listContent: {
    paddingHorizontal: 18,

    paddingTop: 12,

    paddingBottom: 150,

    gap: 16,
  },

  /*
   * HEADER
   */
  header: {
    minHeight: 82,

    paddingTop: 10,
    paddingBottom: 12,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    marginBottom: 6,
  },

  headerText: {
    flex: 1,

    marginRight: 14,
  },

  greeting: {
    fontSize: 13,

    color: COLORS.muted,

    marginBottom: 3,
  },

  headerTitle: {
    fontSize: 27,

    fontWeight: "900",

    color: COLORS.text,

    letterSpacing: -0.5,
  },

  headerActions: {
    flexDirection: "row",

    alignItems: "center",

    gap: 10,
  },

  circleBtn: {
    width: 46,

    height: 46,

    borderRadius: 23,

    backgroundColor: COLORS.chip,

    alignItems: "center",

    justifyContent: "center",
  },

  userAvatar: {
    width: 46,

    height: 46,

    borderRadius: 23,

    backgroundColor: COLORS.orange,

    alignItems: "center",

    justifyContent: "center",
  },

  userAvatarText: {
    color: COLORS.white,

    fontSize: 17,

    fontWeight: "900",
  },

  /*
   * SEARCH
   */
  searchRow: {
    flexDirection: "row",

    alignItems: "center",

    gap: 10,

    marginBottom: 14,
  },

  searchBar: {
    flex: 1,

    height: 54,

    paddingHorizontal: 16,

    borderRadius: 27,

    backgroundColor: COLORS.chip,

    flexDirection: "row",

    alignItems: "center",

    gap: 10,
  },

  searchInput: {
    flex: 1,

    fontSize: 14,

    color: COLORS.text,
  },

  filterIconBtn: {
    width: 54,

    height: 54,

    borderRadius: 27,

    backgroundColor: COLORS.chip,

    alignItems: "center",

    justifyContent: "center",
  },

  /*
   * FILTER
   */
  filterContent: {
    gap: 9,

    paddingBottom: 18,
  },

  filterChip: {
    paddingHorizontal: 16,

    paddingVertical: 10,

    borderRadius: 22,

    backgroundColor: COLORS.chip,
  },

  filterChipActive: {
    backgroundColor: COLORS.orange,
  },

  filterText: {
    fontSize: 12,

    color: COLORS.text,

    fontWeight: "600",
  },

  filterTextActive: {
    color: COLORS.white,

    fontWeight: "800",
  },

  /*
   * OFFLINE
   */
  offlineBanner: {
    flexDirection: "row",

    alignItems: "center",

    gap: 8,

    backgroundColor: COLORS.yellowSoft,

    borderRadius: 15,

    paddingHorizontal: 13,

    paddingVertical: 10,

    marginBottom: 18,
  },

  offlineText: {
    flex: 1,

    color: COLORS.yellow,

    fontSize: 12,

    fontWeight: "500",
  },

  /*
   * SECTION
   */
  sectionHeader: {
    flexDirection: "row",

    alignItems: "flex-end",

    justifyContent: "space-between",

    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 23,

    fontWeight: "900",

    color: COLORS.text,

    letterSpacing: -0.4,
  },

  tripCount: {
    fontSize: 12,

    color: COLORS.orange,

    fontWeight: "700",
  },

  /*
   * CARD
   */
  card: {
    width: "100%",

    borderRadius: 26,

    backgroundColor: COLORS.mint,

    overflow: "hidden",

    borderWidth: 1,

    borderColor: COLORS.mintDeep,

    shadowColor: "#000",

    shadowOpacity: 0.045,

    shadowRadius: 14,

    shadowOffset: {
      width: 0,
      height: 6,
    },

    elevation: 2,
  },

  cardImageWrap: {
    position: "relative",

    margin: 10,

    marginBottom: 0,

    borderRadius: 20,

    overflow: "hidden",

    backgroundColor: COLORS.mintDeep,
  },

  cardImage: {
    width: "100%",

    height: 170,
  },

  /*
   * BADGE
   */
  statusBadge: {
    position: "absolute",

    top: 12,

    right: 12,

    minHeight: 32,

    paddingHorizontal: 12,

    paddingVertical: 7,

    borderRadius: 18,

    flexDirection: "row",

    alignItems: "center",

    gap: 5,

    shadowColor: "#000",

    shadowOpacity: 0.08,

    shadowRadius: 5,

    elevation: 2,
  },

  statusText: {
    fontSize: 11,

    fontWeight: "800",

    color: COLORS.white,
  },

  cardBody: {
    padding: 16,

    paddingTop: 14,
  },

  cardTitle: {
    fontSize: 21,

    fontWeight: "900",

    color: COLORS.text,

    letterSpacing: -0.3,

    marginBottom: 9,
  },

  cardMeta: {
    gap: 7,
  },

  metaItem: {
    flexDirection: "row",

    alignItems: "center",

    gap: 7,
  },

  metaText: {
    flex: 1,

    fontSize: 13,

    color: COLORS.text,

    fontWeight: "500",
  },

  /*
   * MEMBERS + STATS
   */
  infoRow: {
    marginTop: 15,

    paddingTop: 14,

    borderTopWidth: 1,

    borderTopColor: "rgba(17,21,27,0.07)",

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    gap: 10,
  },

  avatarsRow: {
    flexDirection: "row",

    alignItems: "center",

    flexShrink: 1,
  },

  avatar: {
    width: 31,

    height: 31,

    borderRadius: 16,

    backgroundColor: COLORS.orange,

    borderWidth: 2,

    borderColor: COLORS.mint,

    alignItems: "center",

    justifyContent: "center",
  },

  avatarMore: {
    backgroundColor: COLORS.muted,
  },

  avatarText: {
    color: COLORS.white,

    fontSize: 10,

    fontWeight: "800",
  },

  memberCount: {
    marginLeft: 8,

    fontSize: 11,

    color: COLORS.muted,

    fontWeight: "600",
  },

  quickStats: {
    flexDirection: "row",

    alignItems: "center",

    gap: 10,
  },

  statPill: {
    flexDirection: "row",

    alignItems: "center",

    gap: 4,

    paddingHorizontal: 8,

    paddingVertical: 6,

    borderRadius: 14,

    backgroundColor: COLORS.greenSoft,
  },

  statText: {
    color: COLORS.green,

    fontSize: 11,

    fontWeight: "800",
  },

  costWrap: {
    alignItems: "flex-end",
  },

  costLabel: {
    fontSize: 9,

    color: COLORS.muted,

    fontWeight: "700",

    textTransform: "uppercase",
  },

  costValue: {
    marginTop: 1,

    fontSize: 13,

    color: COLORS.text,

    fontWeight: "900",
  },

  /*
   * FLOATING ACTION BUTTON
   */
  fab: {
    position: "absolute",

    right: 20,

    bottom: 88,

    width: 58,

    height: 58,

    borderRadius: 29,

    backgroundColor: COLORS.orange,

    alignItems: "center",

    justifyContent: "center",

    zIndex: 20,

    shadowColor: COLORS.orange,

    shadowOpacity: 0.3,

    shadowRadius: 12,

    shadowOffset: {
      width: 0,
      height: 7,
    },

    elevation: 9,
  },

  /*
   * EMPTY STATE
   */
  emptyState: {
    alignItems: "center",

    paddingTop: 70,

    paddingBottom: 40,
  },

  emptyIcon: {
    width: 90,

    height: 90,

    borderRadius: 45,

    backgroundColor: COLORS.orangeSoft,

    alignItems: "center",

    justifyContent: "center",

    marginBottom: 14,
  },

  emptyTitle: {
    fontSize: 19,

    fontWeight: "800",

    color: COLORS.text,
  },

  emptySub: {
    marginTop: 7,

    paddingHorizontal: 34,

    textAlign: "center",

    color: COLORS.muted,

    fontSize: 13,

    lineHeight: 19,
  },

  emptyCreateBtn: {
    marginTop: 18,

    backgroundColor: COLORS.orange,

    paddingHorizontal: 24,

    paddingVertical: 13,

    borderRadius: 22,
  },

  emptyCreateText: {
    color: COLORS.white,

    fontSize: 14,

    fontWeight: "800",
  },
});
