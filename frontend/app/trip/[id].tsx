import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '../../context/AppContext';

import {
  Activity,
  ChecklistItem,
  Expense,
  Member,
} from '../../types';

import { logAction } from '../../utils/logger';

/* =========================================================
   THEME
========================================================= */

const COLORS = {
  orange: '#F56A16',
  orangeDark: '#D95408',
  orangeSoft: '#FFF0E5',

  background: '#F7F7F4',
  surface: '#FFFFFF',

  mint: '#EAF6F4',
  mintDeep: '#DDF0ED',

  text: '#111315',
  muted: '#6D737B',
  lightText: '#969C9F',

  border: '#ECEDE8',
  chip: '#F1F1EE',

  green: '#1F9D73',
  greenDark: '#16795A',
  greenSoft: '#E8F7F1',

  red: '#E55454',
  redSoft: '#FFF0F0',

  yellow: '#B67600',
  yellowSoft: '#FFF4D8',

  white: '#FFFFFF',
};

/* =========================================================
   CONFIG
========================================================= */

const TABS = [
  'Kế hoạch',
  'Checklist',
  'Chi phí',
  'Nhóm',
];

const CATEGORY_LABELS: Record<string, string> = {
  /* API / English */
  food: 'Ăn uống',
  foods: 'Ăn uống',
  meal: 'Ăn uống',
  meals: 'Ăn uống',
  dining: 'Ăn uống',

  transport: 'Di chuyển',
  transportation: 'Di chuyển',
  travel: 'Di chuyển',

  accommodation: 'Chỗ ở',
  hotel: 'Chỗ ở',
  hotels: 'Chỗ ở',
  lodging: 'Chỗ ở',

  entertainment: 'Vui chơi',
  activity: 'Vui chơi',
  activities: 'Vui chơi',

  shopping: 'Mua sắm',
  shop: 'Mua sắm',

  other: 'Khác',
  others: 'Khác',

  /* Vietnamese */
  'Ăn uống': 'Ăn uống',
  'Di chuyển': 'Di chuyển',
  'Chỗ ở': 'Chỗ ở',
  'Vui chơi': 'Vui chơi',
  'Mua sắm': 'Mua sắm',
  'Khác': 'Khác',
};

const CATEGORY_COLORS: Record<string, string> = {
  'Ăn uống': '#EF4444',
  'Di chuyển': '#3B82F6',
  'Chỗ ở': '#8B5CF6',
  'Vui chơi': '#F59E0B',
  'Mua sắm': '#10B981',
  'Khác': '#6B7280',
};

const CATEGORY_ICONS: Record<string, any> = {
  'Ăn uống': 'restaurant-outline',
  'Di chuyển': 'car-outline',
  'Chỗ ở': 'home-outline',
  'Vui chơi': 'game-controller-outline',
  'Mua sắm': 'bag-handle-outline',
  'Khác': 'pricetag-outline',
};

const ACT_TYPE_COLOR: Record<string, string> = {
  'Tham quan': '#3B82F6',
  'Ăn uống': '#EF4444',
  'Chỗ ở': '#8B5CF6',
  'Di chuyển': '#F59E0B',
  'Mua sắm': '#10B981',
  'Vui chơi': '#F97316',
};

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
  }
> = {
  UPCOMING: {
    label: 'Sắp tới',
    color: COLORS.orangeDark,
    bg: COLORS.orangeSoft,
  },

  ONGOING: {
    label: 'Đang đi',
    color: COLORS.greenDark,
    bg: COLORS.greenSoft,
  },

  DONE: {
    label: 'Hoàn thành',
    color: '#59605E',
    bg: '#EFEFEB',
  },
};

/* =========================================================
   HELPERS
========================================================= */

function getChecklistItemId(
  item: ChecklistItem
): string {
  return String(
    item.id ||
      (
        item as ChecklistItem & {
          _id?: string;
        }
      )._id ||
      ''
  );
}

function fmtMoney(n: number) {
  return (
    Math.abs(n).toLocaleString('vi-VN') +
    ' đ'
  );
}

function formatDateInput(raw: string) {
  const d = raw
    .replace(/\D/g, '')
    .slice(0, 8);

  if (d.length <= 2) {
    return d;
  }

  if (d.length <= 4) {
    return `${d.slice(0, 2)}/${d.slice(2)}`;
  }

  return `${d.slice(0, 2)}/${d.slice(
    2,
    4
  )}/${d.slice(4)}`;
}

/*
 * Chuẩn hóa category từ backend.
 *
 * food -> Ăn uống
 * transport -> Di chuyển
 * accommodation -> Chỗ ở
 */
function getCategoryLabel(category?: string) {
  if (!category) {
    return 'Khác';
  }

  const raw = category.trim();

  return (
    CATEGORY_LABELS[raw] ||
    CATEGORY_LABELS[raw.toLowerCase()] ||
    raw
  );
}

function getCategoryColor(category?: string) {
  const label = getCategoryLabel(category);

  return (
    CATEGORY_COLORS[label] ||
    CATEGORY_COLORS['Khác']
  );
}

function getCategoryIcon(category?: string) {
  const label = getCategoryLabel(category);

  return (
    CATEGORY_ICONS[label] ||
    CATEGORY_ICONS['Khác']
  );
}

/* =========================================================
   PLAN TAB
========================================================= */

function PlanTab({
  tripId,
}: {
  tripId: string;
}) {
  const router = useRouter();

  const {
    getTrip,
    deleteActivity,
  } = useApp();

  const trip = getTrip(tripId)!;

  const sorted = [...trip.activities].sort(
    (a: Activity, b: Activity) => {
      const da =
        a.date
          .split('/')
          .reverse()
          .join('') + a.time;

      const db =
        b.date
          .split('/')
          .reverse()
          .join('') + b.time;

      return da.localeCompare(db);
    }
  );

  const grouped: Record<
    string,
    Activity[]
  > = {};

  sorted.forEach(activity => {
    (
      grouped[activity.date] =
        grouped[activity.date] || []
    ).push(activity);
  });

  const dates = Object.keys(grouped);

  if (!dates.length) {
    return (
      <View style={s.emptyFull}>
        <View style={s.emptyIcon}>
          <Ionicons
            name="calendar-outline"
            size={39}
            color={COLORS.orange}
          />
        </View>

        <Text style={s.emptyTitle}>
          Chưa có hoạt động nào
        </Text>

        <Text style={s.emptySub}>
          Nhấn + để thêm hoạt động đầu tiên
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        padding: 16,
        paddingBottom: 110,
      }}
    >
      {dates.map(date => {
        const activities =
          grouped[date];

        return (
          <View
            key={date}
            style={s.planDateGroup}
          >
            {/* DATE */}

            <View style={s.dateBadge}>
              <Ionicons
                name="calendar-outline"
                size={13}
                color={COLORS.orange}
              />

              <Text style={s.dateHeader}>
                {date}
              </Text>
            </View>

            {/* TIMELINE */}

            {activities.map(
              (act, index) => {
                const typeColor =
                  ACT_TYPE_COLOR[
                    act.type?.[0]
                  ] || COLORS.muted;

                const isLast =
                  index ===
                  activities.length - 1;

                return (
                  <View
                    key={act.id}
                    style={[
                      s.timelineRow,

                      index > 0 && {
                        marginTop: 10,
                      },
                    ]}
                  >
                    {/* TIME RAIL */}

                    <View
                      style={s.timelineRail}
                    >
                      <Text
                        style={s.timelineTime}
                      >
                        {act.time ||
                          '--:--'}
                      </Text>

                      <View
                        style={
                          s.timelineDotOuter
                        }
                      >
                        <View
                          style={[
                            s.timelineDot,

                            {
                              backgroundColor:
                                typeColor,
                            },
                          ]}
                        />
                      </View>

                      {!isLast && (
                        <View
                          style={
                            s.timelineLine
                          }
                        />
                      )}
                    </View>

                    {/* ACTIVITY */}

                    <TouchableOpacity
                      style={s.actCard}
                      activeOpacity={0.85}
                      onPress={() =>
                        router.push({
                          pathname:
                            '/activity/[id]',

                          params: {
                            id: act.id,
                            tripId,
                            type: 'activity',
                          },
                        })
                      }
                      onLongPress={() =>
                        Alert.alert(
                          'Hoạt động',
                          act.name,
                          [
                            {
                              text: 'Sửa',

                              onPress: () =>
                                router.push({
                                  pathname:
                                    '/activity/[id]',

                                  params: {
                                    id: act.id,
                                    tripId,
                                    type:
                                      'activity',
                                  },
                                }),
                            },

                            {
                              text: 'Xóa',

                              style:
                                'destructive',

                              onPress: () => {
                                logAction(
                                  'Activity',
                                  `delete ${act.id}`
                                );

                                deleteActivity(
                                  tripId,
                                  act.id
                                );
                              },
                            },

                            {
                              text: 'Hủy',
                              style: 'cancel',
                            },
                          ]
                        )
                      }
                    >
                      <View style={s.actBody}>
                        <Text
                          style={s.actName}
                        >
                          {act.name}
                        </Text>

                        {act.location ? (
                          <View
                            style={
                              s.actLocRow
                            }
                          >
                            <Ionicons
                              name="location-outline"
                              size={13}
                              color={
                                COLORS.lightText
                              }
                            />

                            <Text
                              style={s.actLoc}
                              numberOfLines={1}
                            >
                              {act.location}
                            </Text>
                          </View>
                        ) : null}

                        <View
                          style={
                            s.actTagsRow
                          }
                        >
                          {act.type?.map(
                            type => (
                              <View
                                key={type}
                                style={[
                                  s.actTag,

                                  {
                                    backgroundColor:
                                      (
                                        ACT_TYPE_COLOR[
                                          type
                                        ] ||
                                        COLORS.muted
                                      ) + '18',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    s.actTagText,

                                    {
                                      color:
                                        ACT_TYPE_COLOR[
                                          type
                                        ] ||
                                        COLORS.muted,
                                    },
                                  ]}
                                >
                                  {type}
                                </Text>
                              </View>
                            )
                          )}

                          {act.participants
                            ?.length > 0 && (
                            <View
                              style={
                                s.actParticipants
                              }
                            >
                              <Ionicons
                                name="people-outline"
                                size={12}
                                color={
                                  COLORS.muted
                                }
                              />

                              <Text
                                style={
                                  s.actParticipantsText
                                }
                              >
                                {
                                  act
                                    .participants
                                    .length
                                }
                              </Text>
                            </View>
                          )}
                        </View>

                        {act.note ? (
                          <Text
                            style={s.actNote}
                            numberOfLines={1}
                          >
                            {act.note}
                          </Text>
                        ) : null}
                      </View>

                      <Ionicons
                        name="chevron-forward"
                        size={17}
                        color="#C3C7C4"
                      />
                    </TouchableOpacity>
                  </View>
                );
              }
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

/* =========================================================
   CHECKLIST TAB
========================================================= */

function ChecklistTab({
  tripId,
}: {
  tripId: string;
}) {
  const router = useRouter();

  const {
    getTrip,
    updateChecklistItem,
    deleteChecklistItem,
  } = useApp();

  const trip = getTrip(tripId)!;

  const [filter, setFilter] =
    useState<
      | 'all'
      | 'shared'
      | 'personal'
      | 'todo'
    >('all');

  /*
   * Contrast cao hơn bản trước.
   */
  const CAT_COLORS: Record<
    string,
    {
      bg: string;
      text: string;
      border: string;
    }
  > = {
    shared: {
      bg: COLORS.orangeSoft,
      text: COLORS.orangeDark,
      border: '#FFCBA8',
    },

    personal: {
      bg: '#F3F1ED',
      text: '#594E46',
      border: '#D8D2CB',
    },

    todo: {
      bg: COLORS.greenSoft,
      text: COLORS.greenDark,
      border: '#B9E5D4',
    },
  };

  const filtered =
    filter === 'all'
      ? trip.checklist
      : trip.checklist.filter(
          item =>
            item.category === filter
        );

  const done =
    trip.checklist.filter(
      item => item.completed
    ).length;

  const pct = trip.checklist.length
    ? Math.round(
        (done /
          trip.checklist.length) *
          100
      )
    : 0;

  return (
    <View style={{ flex: 1 }}>
      {/* PROGRESS */}

      <View style={s.clTopBar}>
        <View style={s.clProgressRow}>
          <Text
            style={s.clProgressLabel}
          >
            Tiến độ
          </Text>

          <Text style={s.clPct}>
            {pct}%
          </Text>
        </View>

        <View style={s.clBarBg}>
          <View
            style={[
              s.clBarFill,

              {
                width:
                  `${pct}%` as any,
              },
            ]}
          />
        </View>

        {/* FILTER */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          style={{ marginTop: 4 }}
        >
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
            }}
          >
            {(
              [
                'all',
                'shared',
                'personal',
                'todo',
              ] as const
            ).map(item => {
              const active =
                filter === item;

              return (
                <TouchableOpacity
                  key={item}
                  style={[
                    s.filterChip,

                    active &&
                      s.filterChipActive,
                  ]}
                  onPress={() =>
                    setFilter(item)
                  }
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      s.filterChipText,

                      active &&
                        s.filterChipTextActive,
                    ]}
                  >
                    {item === 'all'
                      ? 'Tất cả'
                      : item === 'shared'
                        ? 'Nhóm'
                        : item ===
                            'personal'
                          ? 'Cá nhân'
                          : 'Việc cần làm'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* LIST */}

      <FlatList
        data={filtered}
        keyExtractor={
          getChecklistItemId
        }
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={{
          padding: 16,
          gap: 10,
          paddingBottom: 110,
        }}
        ListEmptyComponent={
          <View style={s.emptyFull}>
            <View style={s.emptyIcon}>
              <Ionicons
                name="checkbox-outline"
                size={40}
                color={COLORS.orange}
              />
            </View>

            <Text style={s.emptyTitle}>
              Chưa có mục nào
            </Text>
          </View>
        }
        renderItem={({
          item,
        }: {
          item: ChecklistItem;
        }) => {
          const catColor =
            CAT_COLORS[item.category] ||
            CAT_COLORS.shared;

          const assignee =
            trip.members.find(
              member =>
                String(
                  member.id ||
                    (
                      member as Member & {
                        _id?: string;
                      }
                    )._id
                ) === item.assignee
            );

          const assigneeName =
            assignee?.name ||
            (/^[a-f0-9]{24}$/i.test(
              item.assignee || ''
            )
              ? 'Thành viên không có trong nhóm'
              : item.assignee);

          return (
            <TouchableOpacity
              style={[
                s.clItem,

                item.completed &&
                  s.clItemDone,
              ]}
              activeOpacity={0.85}
              onPress={() =>
                router.push({
                  pathname:
                    '/activity/[id]',

                  params: {
                    id: getChecklistItemId(
                      item
                    ),
                    tripId,
                    type: 'checklist',
                  },
                })
              }
              onLongPress={() =>
                Alert.alert(
                  item.name,
                  '',
                  [
                    {
                      text: 'Sửa',

                      onPress: () =>
                        router.push({
                          pathname:
                            '/activity/[id]',

                          params: {
                            id: getChecklistItemId(
                              item
                            ),
                            tripId,
                            type:
                              'checklist',
                          },
                        }),
                    },

                    {
                      text: 'Xóa',

                      style:
                        'destructive',

                      onPress: () =>
                        deleteChecklistItem(
                          tripId,
                          getChecklistItemId(
                            item
                          )
                        ),
                    },

                    {
                      text: 'Hủy',
                      style: 'cancel',
                    },
                  ]
                )
              }
            >
              {/* CHECK */}

              <TouchableOpacity
                style={[
                  s.clCheck,

                  item.completed &&
                    s.clCheckDone,
                ]}
                onPress={() =>
                  updateChecklistItem(
                    tripId,
                    getChecklistItemId(
                      item
                    ),
                    {
                      completed:
                        !item.completed,
                    }
                  )
                }
              >
                {item.completed && (
                  <Ionicons
                    name="checkmark"
                    size={15}
                    color={COLORS.white}
                  />
                )}
              </TouchableOpacity>

              {/* BODY */}

              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    s.clName,

                    item.completed &&
                      s.clNameDone,
                  ]}
                >
                  {item.name}
                </Text>

                <View
                  style={
                    s.clMetaContainer
                  }
                >
                  {assigneeName ? (
                    <View
                      style={s.clMetaItem}
                    >
                      <Ionicons
                        name="person-outline"
                        size={12}
                        color={
                          COLORS.muted
                        }
                      />

                      <Text
                        style={
                          s.clMetaText
                        }
                        numberOfLines={1}
                      >
                        {assigneeName}
                      </Text>
                    </View>
                  ) : null}

                  {item.dueDate ? (
                    <View
                      style={s.clMetaItem}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={12}
                        color={
                          COLORS.muted
                        }
                      />

                      <Text
                        style={
                          s.clMetaText
                        }
                      >
                        {item.dueDate}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* CATEGORY BADGE */}

              <View
                style={[
                  s.clCatBadge,

                  {
                    backgroundColor:
                      catColor.bg,

                    borderColor:
                      catColor.border,
                  },
                ]}
              >
                <Text
                  style={[
                    s.clCatText,

                    {
                      color:
                        catColor.text,
                    },
                  ]}
                >
                  {item.category ===
                  'shared'
                    ? 'Nhóm'
                    : item.category ===
                        'personal'
                      ? 'Cá nhân'
                      : 'Việc làm'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

/* =========================================================
   EXPENSES TAB
========================================================= */

function ExpensesTab({
  tripId,
}: {
  tripId: string;
}) {
  const router = useRouter();

  const {
    getTrip,
    deleteExpense,
  } = useApp();

  const trip = getTrip(tripId)!;

  const getPayerName = (
    value: string
  ) => {
    const member =
      trip.members.find(
        item =>
          String(item.id) === value ||
          String(
            (
              item as Member & {
                _id?: string;
              }
            )._id
          ) === value
      );

    if (member) {
      return member.name;
    }

    return /^[a-f0-9]{24}$/i.test(
      value || ''
    )
      ? 'Không xác định người trả'
      : value ||
          'Chưa chọn người trả';
  };

  const total =
    trip.expenses.reduce(
      (
        sum: number,
        expense: Expense
      ) =>
        sum + expense.amount,
      0
    );

  const perPerson =
    trip.members.length > 0
      ? total /
        trip.members.length
      : 0;

  /*
   * Quan trọng:
   * Normalize category TRƯỚC
   * khi tính category lớn nhất.
   *
   * food => Ăn uống
   */
  const byCategory: Record<
    string,
    number
  > = {};

  trip.expenses.forEach(
    (expense: Expense) => {
      const label =
        getCategoryLabel(
          expense.category
        );

      byCategory[label] =
        (byCategory[label] ||
          0) + expense.amount;
    }
  );

  const topCat =
    Object.entries(
      byCategory
    ).sort(
      (
        a: [
          string,
          number,
        ],
        b: [
          string,
          number,
        ]
      ) => b[1] - a[1]
    )[0];

  return (
    <View style={{ flex: 1 }}>
      {/* SUMMARY */}

      <View style={s.expTopBar}>
        <View style={s.expSummary}>
          <View
            style={
              s.expSummaryItem
            }
          >
            <Text
              style={s.expSummaryVal}
              numberOfLines={1}
            >
              {fmtMoney(total)}
            </Text>

            <Text
              style={
                s.expSummaryLabel
              }
            >
              Tổng chi
            </Text>
          </View>

          <View
            style={
              s.expSummaryDivider
            }
          />

          <View
            style={
              s.expSummaryItem
            }
          >
            <Text
              style={s.expSummaryVal}
              numberOfLines={1}
            >
              {fmtMoney(
                Math.round(
                  perPerson
                )
              )}
            </Text>

            <Text
              style={
                s.expSummaryLabel
              }
            >
              Mỗi người
            </Text>
          </View>

          <View
            style={
              s.expSummaryDivider
            }
          />

          <View
            style={
              s.expSummaryItem
            }
          >
            <Text
              style={s.expSummaryVal}
              numberOfLines={1}
            >
              {topCat
                ? topCat[0]
                : '—'}
            </Text>

            <Text
              style={
                s.expSummaryLabel
              }
            >
              Nhiều nhất
            </Text>
          </View>
        </View>

        {/* REPORT */}

        <TouchableOpacity
          style={s.reportBtn}
          activeOpacity={0.85}
          onPress={() =>
            router.push({
              pathname:
                '/trip/report',

              params: {
                tripId,
              },
            })
          }
        >
          <View style={s.reportIcon}>
            <Ionicons
              name="bar-chart-outline"
              size={18}
              color={COLORS.orange}
            />
          </View>

          <Text
            style={
              s.reportBtnText
            }
          >
            Xem báo cáo quyết toán
          </Text>

          <Ionicons
            name="chevron-forward"
            size={17}
            color={COLORS.orange}
          />
        </TouchableOpacity>
      </View>

      {/* EXPENSE LIST */}

      <FlatList
        data={trip.expenses}
        keyExtractor={
          expense => expense.id
        }
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={{
          padding: 16,
          gap: 10,
          paddingBottom: 110,
        }}
        ListEmptyComponent={
          <View style={s.emptyFull}>
            <View style={s.emptyIcon}>
              <Ionicons
                name="wallet-outline"
                size={40}
                color={COLORS.orange}
              />
            </View>

            <Text style={s.emptyTitle}>
              Chưa có chi phí
            </Text>
          </View>
        }
        renderItem={({
          item,
        }: {
          item: Expense;
        }) => {
          const categoryLabel =
            getCategoryLabel(
              item.category
            );

          const categoryColor =
            getCategoryColor(
              item.category
            );

          const categoryIcon =
            getCategoryIcon(
              item.category
            );

          return (
            <TouchableOpacity
              style={s.expCard}
              activeOpacity={0.85}
              onPress={() =>
                router.push({
                  pathname:
                    '/activity/[id]',

                  params: {
                    id: item.id,
                    tripId,
                    type: 'expense',
                  },
                })
              }
              onLongPress={() =>
                Alert.alert(
                  item.name,
                  fmtMoney(
                    item.amount
                  ),
                  [
                    {
                      text: 'Sửa',

                      onPress: () =>
                        router.push({
                          pathname:
                            '/activity/[id]',

                          params: {
                            id: item.id,
                            tripId,
                            type:
                              'expense',
                          },
                        }),
                    },

                    {
                      text: 'Xóa',

                      style:
                        'destructive',

                      onPress: () =>
                        deleteExpense(
                          tripId,
                          item.id
                        ),
                    },

                    {
                      text: 'Hủy',
                      style: 'cancel',
                    },
                  ]
                )
              }
            >
              <View
                style={[
                  s.expIconWrap,

                  {
                    backgroundColor:
                      categoryColor +
                      '16',
                  },
                ]}
              >
                <Ionicons
                  name={categoryIcon}
                  size={21}
                  color={
                    categoryColor
                  }
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={s.expName}
                >
                  {item.name}
                </Text>

                <Text
                  style={s.expCategory}
                >
                  {categoryLabel}
                </Text>

                <Text
                  style={s.expMeta}
                  numberOfLines={1}
                >
                  {getPayerName(
                    item.paidBy
                  )}

                  {' · '}

                  {item.splitType ===
                  'equal'
                    ? `Chia đều ${
                        item
                          .participants
                          ?.length ||
                        trip.members
                          .length
                      } người`
                    : 'Chi tiết'}
                </Text>
              </View>

              <View
                style={{
                  alignItems:
                    'flex-end',
                }}
              >
                <Text
                  style={s.expAmt}
                >
                  -
                  {fmtMoney(
                    item.amount
                  )}
                </Text>

                <Text
                  style={
                    s.expPerPerson
                  }
                >
                  {fmtMoney(
                    Math.round(
                      item.amount /
                        Math.max(
                          1,

                          item
                            .participants
                            ?.length ||
                            trip
                              .members
                              .length
                        )
                    )
                  )}
                  /người
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

/* =========================================================
   MEMBERS TAB
========================================================= */

function MembersTab({
  tripId,
}: {
  tripId: string;
}) {
  const appCtx =
    useApp() as any;

  const {
    getTrip,
    removeMember,
    promoteMember,
    addMember,
  } = appCtx;

  const findUser:
    | ((
        q: string
      ) => Promise<any>)
    | undefined =
    appCtx.findUser;

  const trip =
    getTrip(tripId)!;

  const [
    selectedMember,
    setSelectedMember,
  ] =
    useState<Member | null>(
      null
    );

  const [
    copied,
    setCopied,
  ] = useState(false);

  const [
    showAddModal,
    setShowAddModal,
  ] = useState(false);

  const [
    searchQuery,
    setSearchQuery,
  ] = useState('');

  const [
    foundUser,
    setFoundUser,
  ] =
    useState<any>(null);

  const [
    searching,
    setSearching,
  ] = useState(false);

  const [
    notFound,
    setNotFound,
  ] = useState(false);

  const inviteCode =
    (trip as any)
      .inviteCode ||
    tripId
      .slice(-6)
      .toUpperCase();

  const inviteLink =
    `tripmate.app/join/${inviteCode}`;

  const handleCopy =
    async () => {
      await Clipboard.setStringAsync(
        inviteLink
      );

      setCopied(true);

      setTimeout(
        () =>
          setCopied(false),
        2000
      );
    };

  const handleShare =
    async () => {
      await Share.share({
        message:
          `Tham gia chuyến đi "${trip.name}" cùng tôi trên TripMate!\n` +
          `Mã mời: ${inviteCode}\n` +
          `Link: ${inviteLink}`,
      });
    };

  const handleSearchUser =
    async () => {
      const q =
        searchQuery.trim();

      if (!q) {
        Alert.alert(
          '',
          'Vui lòng nhập số điện thoại hoặc email'
        );

        return;
      }

      setSearching(true);
      setFoundUser(null);
      setNotFound(false);

      logAction(
        'Member',
        `Search user: ${q}`
      );

      try {
        const result =
          findUser
            ? await findUser(q)
            : null;

        if (result) {
          setFoundUser(
            result
          );
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setSearching(false);
      }
    };

  const handleAddMember =
    async (
      phone: string,
      name?: string
    ) => {
      if (
        trip.members.find(
          (
            member: Member
          ) =>
            member.phone ===
            phone
        )
      ) {
        Alert.alert(
          '',
          `${name || phone} đã là thành viên của chuyến đi này`
        );

        return;
      }

      logAction(
        'Member',
        `Add to trip: ${phone}`
      );

      const ok =
        await addMember(
          tripId,
          phone
        );

      if (ok) {
        Alert.alert(
          'Thành công',
          `Đã thêm ${
            name || phone
          } vào chuyến đi`
        );

        setShowAddModal(false);
        setSearchQuery('');
        setFoundUser(null);
        setNotFound(false);
      } else {
        Alert.alert(
          'Lỗi',
          'Không thể thêm thành viên. Thử lại sau.'
        );
      }
    };

  const handleRemoveMember =
    (member: Member) => {
      if (
        member.role ===
        'leader'
      ) {
        Alert.alert(
          'Không thể xóa',
          'Không thể xóa trưởng nhóm. Hãy chuyển quyền trước.'
        );

        return;
      }

      Alert.alert(
        'Xóa thành viên',
        `Xóa ${member.name} khỏi chuyến đi "${trip.name}"?\nHành động này không thể hoàn tác.`,
        [
          {
            text: 'Hủy',
            style: 'cancel',
          },

          {
            text: 'Xóa',
            style:
              'destructive',

            onPress:
              async () => {
                try {
                  await removeMember(
                    tripId,
                    member.id
                  );

                  setSelectedMember(
                    null
                  );

                  Alert.alert(
                    'Thành công',
                    `Đã xóa ${member.name} khỏi nhóm`
                  );
                } catch (
                  err: any
                ) {
                  Alert.alert(
                    'Lỗi',
                    err.message ||
                      'Không thể xóa thành viên'
                  );
                }
              },
          },
        ]
      );
    };

  return (
    <View style={{ flex: 1 }}>
      {/* INVITE */}

      <View style={s.inviteBanner}>
        <View style={s.inviteTop}>
          <View style={{ gap: 3 }}>
            <Text
              style={
                s.inviteTitleText
              }
            >
              MÃ MỜI CHUYẾN ĐI
            </Text>

            <Text
              style={
                s.inviteCodeText
              }
            >
              {inviteCode}
            </Text>
          </View>

          <View
            style={s.inviteActions}
          >
            <TouchableOpacity
              style={
                s.inviteActionBtn
              }
              onPress={
                handleCopy
              }
            >
              <Ionicons
                name={
                  copied
                    ? 'checkmark'
                    : 'copy-outline'
                }
                size={15}
                color={
                  copied
                    ? COLORS.green
                    : COLORS.white
                }
              />

              <Text
                style={[
                  s.inviteActionTxt,

                  copied && {
                    color:
                      COLORS.green,
                  },
                ]}
              >
                {copied
                  ? 'Đã sao chép'
                  : 'Sao chép'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.inviteActionBtn,
                s.inviteShareBtn,
              ]}
              onPress={
                handleShare
              }
            >
              <Ionicons
                name="share-social-outline"
                size={15}
                color={
                  COLORS.orange
                }
              />

              <Text
                style={
                  s.inviteShareTxt
                }
              >
                Chia sẻ
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={s.inviteHint}>
          Chia sẻ mã này để mời thêm thành viên tham gia
        </Text>
      </View>

      {/* HEADER */}

      <View style={s.membersTopBar}>
        <View style={{ flex: 1 }}>
          <Text
            style={s.membersTripName}
            numberOfLines={1}
          >
            {trip.name}
          </Text>

          <Text
            style={s.membersMeta}
          >
            {trip.members.length}{' '}
            thành viên ·{' '}
            {trip.startDate} –{' '}
            {trip.endDate}
          </Text>
        </View>

        <TouchableOpacity
          style={s.addMemberBtn}
          onPress={() =>
            setShowAddModal(true)
          }
        >
          <Ionicons
            name="person-add-outline"
            size={16}
            color={COLORS.orange}
          />

          <Text
            style={s.addMemberTxt}
          >
            Thêm
          </Text>
        </TouchableOpacity>
      </View>

      {/* LIST */}

      <FlatList
        data={trip.members}
        keyExtractor={
          member => member.id
        }
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={{
          padding: 16,
          gap: 10,
          paddingBottom: 100,
        }}
        ListEmptyComponent={
          <View style={s.emptyFull}>
            <View style={s.emptyIcon}>
              <Ionicons
                name="people-outline"
                size={40}
                color={COLORS.orange}
              />
            </View>

            <Text style={s.emptyTitle}>
              Chưa có thành viên
            </Text>
          </View>
        }
        renderItem={({
          item,
        }: {
          item: Member;
        }) => {
          const paid =
            trip.expenses
              .filter(
                (
                  expense: Expense
                ) =>
                  expense.paidBy ===
                    item.name.split(
                      ' '
                    )[0] ||
                  (expense as any)
                    .paidById ===
                    item.id
              )
              .reduce(
                (
                  sum: number,
                  expense: Expense
                ) =>
                  sum +
                  expense.amount,
                0
              );

          return (
            <TouchableOpacity
              style={s.memberCard}
              onPress={() =>
                setSelectedMember(
                  item
                )
              }
              activeOpacity={0.85}
            >
              <View
                style={[
                  s.memberAvatar,

                  item.role ===
                    'leader' &&
                    s.memberAvatarLeader,
                ]}
              >
                <Text
                  style={
                    s.memberAvatarText
                  }
                >
                  {item.initials?.slice(
                    0,
                    1
                  ) ||
                    item.name[0]}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <View
                  style={
                    s.memberNameRow
                  }
                >
                  <Text
                    style={s.memberName}
                  >
                    {item.name}
                  </Text>

                  {item.role ===
                    'leader' && (
                    <View
                      style={
                        s.leaderBadge
                      }
                    >
                      <Ionicons
                        name="star"
                        size={9}
                        color={
                          COLORS.yellow
                        }
                      />

                      <Text
                        style={
                          s.leaderBadgeText
                        }
                      >
                        Trưởng nhóm
                      </Text>
                    </View>
                  )}
                </View>

                <Text
                  style={s.memberPhone}
                >
                  {item.phone}
                </Text>
              </View>

              <View
                style={{
                  alignItems:
                    'flex-end',
                }}
              >
                <Text
                  style={
                    s.memberPaidAmt
                  }
                >
                  {paid > 0
                    ? fmtMoney(paid)
                    : '—'}
                </Text>

                <Text
                  style={
                    s.memberPaidLabel
                  }
                >
                  đã trả
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* MEMBER SHEET */}

      <Modal
        visible={
          !!selectedMember
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
          setSelectedMember(null)
        }
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() =>
            setSelectedMember(null)
          }
        >
          <View style={s.actionSheet}>
            {selectedMember && (
              <>
                <View
                  style={
                    s.sheetMemberHeader
                  }
                >
                  <View
                    style={[
                      s.memberAvatar,

                      selectedMember.role ===
                        'leader' &&
                        s.memberAvatarLeader,
                    ]}
                  >
                    <Text
                      style={
                        s.memberAvatarText
                      }
                    >
                      {selectedMember.initials?.slice(
                        0,
                        1
                      ) ||
                        selectedMember
                          .name[0]}
                    </Text>
                  </View>

                  <View
                    style={{ flex: 1 }}
                  >
                    <Text
                      style={
                        s.sheetMemberName
                      }
                    >
                      {
                        selectedMember.name
                      }
                    </Text>

                    <Text
                      style={
                        s.sheetMemberPhone
                      }
                    >
                      {
                        selectedMember.phone
                      }
                    </Text>
                  </View>
                </View>

                <View
                  style={s.sheetDivider}
                />

                {selectedMember.role !==
                  'leader' && (
                  <TouchableOpacity
                    style={s.sheetItem}
                    onPress={() => {
                      promoteMember(
                        tripId,
                        selectedMember.id
                      );

                      setSelectedMember(
                        null
                      );
                    }}
                  >
                    <View
                      style={[
                        s.sheetIcon,

                        {
                          backgroundColor:
                            COLORS.yellowSoft,
                        },
                      ]}
                    >
                      <Ionicons
                        name="star-outline"
                        size={18}
                        color={
                          COLORS.yellow
                        }
                      />
                    </View>

                    <Text
                      style={s.sheetLabel}
                    >
                      Đặt làm trưởng nhóm
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={s.sheetItem}
                  onPress={() => {
                    const member =
                      selectedMember;

                    setSelectedMember(
                      null
                    );

                    setTimeout(
                      () =>
                        Share.share({
                          message:
                            `Mời ${member.name} vào chuyến "${trip.name}"!\n` +
                            `Link: ${inviteLink}`,
                        }),
                      300
                    );
                  }}
                >
                  <View
                    style={[
                      s.sheetIcon,

                      {
                        backgroundColor:
                          COLORS.orangeSoft,
                      },
                    ]}
                  >
                    <Ionicons
                      name="share-social-outline"
                      size={18}
                      color={
                        COLORS.orange
                      }
                    />
                  </View>

                  <Text
                    style={s.sheetLabel}
                  >
                    Gửi link mời
                  </Text>
                </TouchableOpacity>

                {selectedMember.role !==
                  'leader' && (
                  <TouchableOpacity
                    style={s.sheetItem}
                    onPress={() =>
                      handleRemoveMember(
                        selectedMember
                      )
                    }
                  >
                    <View
                      style={[
                        s.sheetIcon,

                        {
                          backgroundColor:
                            COLORS.redSoft,
                        },
                      ]}
                    >
                      <Ionicons
                        name="person-remove-outline"
                        size={18}
                        color={COLORS.red}
                      />
                    </View>

                    <Text
                      style={[
                        s.sheetLabel,

                        {
                          color:
                            COLORS.red,
                        },
                      ]}
                    >
                      Xóa khỏi nhóm
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={s.sheetCancel}
                  onPress={() =>
                    setSelectedMember(
                      null
                    )
                  }
                >
                  <Text
                    style={
                      s.sheetCancelText
                    }
                  >
                    Đóng
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ADD MEMBER */}

      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setShowAddModal(false)
        }
      >
        <View style={s.modalOverlay}>
          <View style={s.actionSheet}>
            <View
              style={s.addModalHeader}
            >
              <Text
                style={s.addModalTitle}
              >
                Thêm thành viên
              </Text>

              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(
                    false
                  );

                  setSearchQuery('');
                  setFoundUser(null);
                  setNotFound(false);
                }}
              >
                <Ionicons
                  name="close-outline"
                  size={25}
                  color={COLORS.text}
                />
              </TouchableOpacity>
            </View>

            <Text
              style={s.addModalHint}
            >
              Tìm bạn qua số điện thoại hoặc email
            </Text>

            <View
              style={
                s.memberSearchRow
              }
            >
              <View
                style={
                  s.searchInputWrap
                }
              >
                <Ionicons
                  name="search-outline"
                  size={17}
                  color={
                    COLORS.lightText
                  }
                />

                <TextInput
                  style={s.searchInput}
                  placeholder="0912 345 678 hoặc email@..."
                  placeholderTextColor="#B7BCB9"
                  value={searchQuery}
                  onChangeText={
                    setSearchQuery
                  }
                  autoCapitalize="none"
                  returnKeyType="search"
                  onSubmitEditing={
                    handleSearchUser
                  }
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={s.searchBtn}
                onPress={
                  handleSearchUser
                }
                disabled={searching}
              >
                {searching ? (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.white}
                  />
                ) : (
                  <Text
                    style={
                      s.searchBtnText
                    }
                  >
                    Tìm
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {foundUser && (
              <View style={s.foundCard}>
                <View
                  style={s.memberAvatar}
                >
                  <Text
                    style={
                      s.memberAvatarText
                    }
                  >
                    {(
                      foundUser.username ||
                      foundUser.name ||
                      '?'
                    )[0].toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={s.foundName}
                  >
                    {foundUser.username ||
                      foundUser.name}
                  </Text>

                  <Text
                    style={s.foundMeta}
                  >
                    {foundUser.phone ||
                      foundUser.email}
                  </Text>
                </View>

                <TouchableOpacity
                  style={s.inviteBtn}
                  onPress={() =>
                    handleAddMember(
                      foundUser.phone ||
                        searchQuery,

                      foundUser.username
                    )
                  }
                >
                  <Ionicons
                    name="person-add-outline"
                    size={16}
                    color={COLORS.white}
                  />

                  <Text
                    style={
                      s.inviteBtnText
                    }
                  >
                    Mời vào
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {notFound && (
              <View
                style={s.notFoundBox}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={21}
                  color={COLORS.yellow}
                />

                <View style={{ flex: 1 }}>
                  <Text
                    style={
                      s.notFoundText
                    }
                  >
                    Không tìm thấy tài khoản
                  </Text>

                  <Text
                    style={
                      s.notFoundSub
                    }
                  >
                    Bạn vẫn có thể mời qua số điện thoại
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    s.inviteBtn,

                    {
                      backgroundColor:
                        COLORS.yellow,
                    },
                  ]}
                  onPress={() =>
                    handleAddMember(
                      searchQuery.trim()
                    )
                  }
                >
                  <Text
                    style={
                      s.inviteBtnText
                    }
                  >
                    Thêm
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={s.sheetCancel}
              onPress={() => {
                setShowAddModal(false);
                setSearchQuery('');
                setFoundUser(null);
                setNotFound(false);
              }}
            >
              <Text
                style={
                  s.sheetCancelText
                }
              >
                Đóng
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* =========================================================
   EDIT TRIP
========================================================= */

function EditTripModal({
  trip,
  visible,
  onClose,
}: {
  trip: any;
  visible: boolean;
  onClose: () => void;
}) {
  const {
    updateTrip,
  } = useApp() as any;

  const [form, setForm] =
    useState({
      name: trip.name,

      startDate:
        trip.startDate,

      endDate: trip.endDate,

      description:
        trip.description || '',

      destinations:
        trip.destinations ||
        ([] as string[]),

      image: trip.image || '',
    });

  const [
    destInput,
    setDestInput,
  ] = useState('');

  const [
    saving,
    setSaving,
  ] = useState(false);

  const addDest = (
    value: string
  ) => {
    const text =
      value.trim();

    if (
      !text ||
      form.destinations.includes(
        text
      )
    ) {
      return;
    }

    setForm(previous => ({
      ...previous,

      destinations: [
        ...previous.destinations,
        text,
      ],
    }));

    setDestInput('');
  };

  const removeDest = (
    value: string
  ) => {
    setForm(previous => ({
      ...previous,

      destinations:
        previous.destinations.filter(
          (item: string) =>
            item !== value
        ),
    }));
  };

  const pickCoverImage =
    async () => {
      const {
        status,
      } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (
        status !== 'granted'
      ) {
        Alert.alert(
          'Quyền truy cập',
          'Cần cấp quyền truy cập thư viện ảnh để chọn ảnh bìa cho chuyến đi.'
        );

        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync(
          {
            mediaTypes:
              ImagePicker
                .MediaTypeOptions
                .Images,

            allowsEditing:
              true,

            aspect: [16, 9],

            quality: 0.8,
          }
        );

      if (
        result.canceled ||
        !result.assets?.length
      ) {
        return;
      }

      setForm(previous => ({
        ...previous,

        image:
          result.assets[0].uri,
      }));
    };

  const handleSave =
    async () => {
      if (
        !form.name.trim()
      ) {
        Alert.alert(
          '',
          'Tên chuyến đi không được trống'
        );

        return;
      }

      setSaving(true);

      logAction(
        'Trip',
        `Edit trip: ${trip.id}`
      );

      try {
        if (
          typeof updateTrip ===
          'function'
        ) {
          await updateTrip(
            trip.id,
            form
          );
        }

        onClose();
      } catch (
        err: any
      ) {
        Alert.alert(
          'Lỗi',
          err.message ||
            'Không thể cập nhật chuyến đi'
        );
      } finally {
        setSaving(false);
      }
    };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={s.editSafe}
      >
        <View style={s.editHeader}>
          <TouchableOpacity
            onPress={onClose}
            style={s.editHeaderBtn}
          >
            <Ionicons
              name="close-outline"
              size={23}
              color={COLORS.text}
            />
          </TouchableOpacity>

          <Text
            style={s.editHeaderTitle}
          >
            Chỉnh sửa chuyến đi
          </Text>

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[
              s.editSaveBtn,

              saving && {
                opacity: 0.7,
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator
                size="small"
                color={COLORS.white}
              />
            ) : (
              <Text
                style={
                  s.editSaveText
                }
              >
                Lưu
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={{
            padding: 20,
            gap: 20,
            paddingBottom: 40,
          }}
        >
          {/* IMAGE */}

          <View>
            <Text style={s.editLabel}>
              Ảnh bìa
            </Text>

            <TouchableOpacity
              style={
                s.editCoverUpload
              }
              onPress={
                pickCoverImage
              }
              activeOpacity={0.85}
            >
              {form.image ? (
                <Image
                  source={{
                    uri: form.image,
                  }}
                  style={
                    s.editCoverPreview
                  }
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={
                    s.editCoverPlaceholder
                  }
                >
                  <View
                    style={
                      s.editCoverIconWrap
                    }
                  >
                    <Ionicons
                      name="camera-outline"
                      size={22}
                      color={
                        COLORS.orange
                      }
                    />
                  </View>

                  <Text
                    style={
                      s.editCoverTitle
                    }
                  >
                    Thêm ảnh bìa
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <Text
              style={
                s.editCoverHint
              }
            >
              Nên sử dụng ảnh ngang có tỉ lệ khoảng 16:9.
            </Text>
          </View>

          {/* NAME */}

          <View>
            <Text style={s.editLabel}>
              Tên chuyến đi *
            </Text>

            <TextInput
              style={s.editInput}
              value={form.name}
              onChangeText={value =>
                setForm(
                  previous => ({
                    ...previous,
                    name: value,
                  })
                )
              }
              placeholder="Tên chuyến đi..."
              placeholderTextColor="#B4B8B4"
            />
          </View>

          {/* DATE */}

          <View
            style={s.editDatesRow}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={s.editLabel}
              >
                Ngày bắt đầu
              </Text>

              <View
                style={
                  s.editDateWrap
                }
              >
                <Ionicons
                  name="calendar-outline"
                  size={15}
                  color={
                    COLORS.orange
                  }
                />

                <TextInput
                  style={
                    s.editDateInput
                  }
                  value={
                    form.startDate
                  }
                  onChangeText={value =>
                    setForm(
                      previous => ({
                        ...previous,

                        startDate:
                          formatDateInput(
                            value
                          ),
                      })
                    )
                  }
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor="#B4B8B4"
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={s.editLabel}
              >
                Ngày kết thúc
              </Text>

              <View
                style={
                  s.editDateWrap
                }
              >
                <Ionicons
                  name="calendar-outline"
                  size={15}
                  color={
                    COLORS.orange
                  }
                />

                <TextInput
                  style={
                    s.editDateInput
                  }
                  value={form.endDate}
                  onChangeText={value =>
                    setForm(
                      previous => ({
                        ...previous,

                        endDate:
                          formatDateInput(
                            value
                          ),
                      })
                    )
                  }
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor="#B4B8B4"
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
            </View>
          </View>

          {/* DESCRIPTION */}

          <View>
            <Text style={s.editLabel}>
              Mô tả
            </Text>

            <TextInput
              style={[
                s.editInput,

                {
                  height: 90,

                  textAlignVertical:
                    'top',
                },
              ]}
              value={
                form.description
              }
              onChangeText={value =>
                setForm(
                  previous => ({
                    ...previous,

                    description:
                      value,
                  })
                )
              }
              placeholder="Mô tả chuyến đi..."
              placeholderTextColor="#B4B8B4"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* DESTINATION */}

          <View>
            <Text style={s.editLabel}>
              Điểm đến
            </Text>

            <View
              style={
                s.destinationInputRow
              }
            >
              <View
                style={[
                  s.editInput,
                  s.destinationInput,
                ]}
              >
                <Ionicons
                  name="location-outline"
                  size={16}
                  color={
                    COLORS.orange
                  }
                />

                <TextInput
                  style={
                    s.destinationTextInput
                  }
                  value={destInput}
                  onChangeText={
                    setDestInput
                  }
                  placeholder="Thêm địa điểm..."
                  placeholderTextColor="#B4B8B4"
                  returnKeyType="done"
                  onSubmitEditing={() =>
                    addDest(
                      destInput
                    )
                  }
                />
              </View>

              <TouchableOpacity
                style={s.searchBtn}
                onPress={() =>
                  addDest(
                    destInput
                  )
                }
              >
                <Ionicons
                  name="add"
                  size={20}
                  color={COLORS.white}
                />
              </TouchableOpacity>
            </View>

            <View
              style={
                s.destinationChips
              }
            >
              {form.destinations.map(
                (
                  destination: string
                ) => (
                  <View
                    key={
                      destination
                    }
                    style={s.destChip}
                  >
                    <Ionicons
                      name="location-outline"
                      size={13}
                      color={
                        COLORS.orange
                      }
                    />

                    <Text
                      style={
                        s.destChipText
                      }
                    >
                      {destination}
                    </Text>

                    <TouchableOpacity
                      onPress={() =>
                        removeDest(
                          destination
                        )
                      }
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={16}
                        color={COLORS.red}
                      />
                    </TouchableOpacity>
                  </View>
                )
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/* =========================================================
   MAIN
========================================================= */

export default function TripDashboard() {
  const { id } =
    useLocalSearchParams<{
      id: string;
    }>();

  const router = useRouter();

  const {
    getTrip,
    deleteTrip,
    refreshTrips,
  } = useApp();

  const [tab, setTab] =
    useState(0);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    showEdit,
    setShowEdit,
  ] = useState(false);

  const [
    tabBarWidth,
    setTabBarWidth,
  ] = useState(0);

  const tabIndicator =
    useRef(
      new Animated.Value(0)
    ).current;

  const contentOpacity =
    useRef(
      new Animated.Value(1)
    ).current;

  const contentX =
    useRef(
      new Animated.Value(0)
    ).current;

  const trip = getTrip(id!);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(
        '/(tabs)/trips'
      );
    }
  };

  if (!trip) {
    return (
      <SafeAreaView
        style={
          s.notFoundScreen
        }
      >
        <View
          style={
            s.notFoundMainIcon
          }
        >
          <Ionicons
            name="alert-circle-outline"
            size={44}
            color={COLORS.orange}
          />
        </View>

        <Text
          style={
            s.notFoundMainTitle
          }
        >
          Không tìm thấy chuyến đi
        </Text>

        <TouchableOpacity
          onPress={goBack}
          style={s.backMainBtn}
        >
          <Text
            style={
              s.backMainBtnText
            }
          >
            Quay lại
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const statusCfg =
    STATUS_CONFIG[
      trip.status
    ] ||
    STATUS_CONFIG.UPCOMING;

  const totalCost =
    trip.expenses.reduce(
      (
        sum: number,
        expense: Expense
      ) =>
        sum + expense.amount,
      0
    );

  const doneCheck =
    trip.checklist.filter(
      (
        item: ChecklistItem
      ) => item.completed
    ).length;

  const handleFab = () => {
    const types = [
      'activity',
      'checklist',
      'expense',
      'member',
    ];

    if (tab === 3) {
      return;
    }

    router.push({
      pathname:
        '/activity/[id]',

      params: {
        id: 'new',
        tripId: id,
        type: types[tab],
      },
    });
  };

  const handleMenu = () =>
    Alert.alert(
      trip.name,
      'Chọn hành động',
      [
        {
          text:
            'Chỉnh sửa chuyến đi',

          onPress: () =>
            setShowEdit(true),
        },

        {
          text: 'Làm mới dữ liệu',

          onPress: async () => {
            setRefreshing(true);

            await refreshTrips();

            setRefreshing(false);
          },
        },

        {
          text: 'Xóa chuyến đi',

          style: 'destructive',

          onPress: () =>
            Alert.alert(
              'Xác nhận xóa',
              'Dữ liệu sẽ bị xóa vĩnh viễn. Tiếp tục?',
              [
                {
                  text: 'Hủy',
                  style: 'cancel',
                },

                {
                  text: 'Xóa',

                  style:
                    'destructive',

                  onPress: () => {
                    deleteTrip(id!);

                    router.replace(
                      '/(tabs)/trips'
                    );
                  },
                },
              ]
            ),
        },

        {
          text: 'Hủy',
          style: 'cancel',
        },
      ]
    );

  /*
   * Internal tab animation.
   */
  const changeTab = (
    nextTab: number
  ) => {
    if (nextTab === tab) {
      return;
    }

    const direction =
      nextTab > tab
        ? 1
        : -1;

    contentOpacity.setValue(
      0.86
    );

    contentX.setValue(
      10 * direction
    );

    setTab(nextTab);

    Animated.parallel([
      Animated.timing(
        tabIndicator,
        {
          toValue: nextTab,

          duration: 180,

          easing:
            Easing.out(
              Easing.cubic
            ),

          useNativeDriver: true,
        }
      ),

      Animated.timing(
        contentOpacity,
        {
          toValue: 1,

          duration: 180,

          easing:
            Easing.out(
              Easing.cubic
            ),

          useNativeDriver: true,
        }
      ),

      Animated.timing(
        contentX,
        {
          toValue: 0,

          duration: 180,

          easing:
            Easing.out(
              Easing.cubic
            ),

          useNativeDriver: true,
        }
      ),
    ]).start();
  };

  const tabWidth =
    tabBarWidth > 0
      ? tabBarWidth /
        TABS.length
      : 0;

  const indicatorX =
    Animated.multiply(
      tabIndicator,
      tabWidth
    );

  return (
    <View style={s.safe}>
      {/* =====================================================
          HERO
      ====================================================== */}

      <View style={s.hero}>
        <Image
          source={{
            uri:
              trip.image ||
              'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
          }}
          style={s.heroImg}
          resizeMode="cover"
        />

        {/*
         * Global subtle overlay.
         * Không quá tối ảnh.
         */}
        <View
          style={
            s.heroSoftOverlay
          }
        />

        {/*
         * Gradient chính ở đáy.
         *
         * Transparent -> rgba(0,0,0,0.55)
         */}
        <LinearGradient
          pointerEvents="none"
          colors={[
            'rgba(0,0,0,0)',
            'rgba(0,0,0,0.55)',
          ]}
          locations={[0, 1]}
          style={s.heroGradient}
        />

        {/* HEADER ACTION */}

        <SafeAreaView
          style={s.heroTopBar}
          edges={['top']}
        >
          <TouchableOpacity
            style={s.heroBtn}
            onPress={goBack}
          >
            <Ionicons
              name="arrow-back-outline"
              size={21}
              color={COLORS.text}
            />
          </TouchableOpacity>

          <View
            style={s.heroActions}
          >
            <TouchableOpacity
              style={s.heroBtn}
              onPress={() =>
                setShowEdit(true)
              }
            >
              <Ionicons
                name="create-outline"
                size={20}
                color={COLORS.text}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={s.heroBtn}
              onPress={handleMenu}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.text}
                />
              ) : (
                <Ionicons
                  name="ellipsis-horizontal"
                  size={21}
                  color={COLORS.text}
                />
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* HERO CONTENT */}

        <View style={s.heroContent}>
          <View
            style={[
              s.statusBadge,

              {
                backgroundColor:
                  statusCfg.bg,
              },
            ]}
          >
            <Text
              style={[
                s.statusText,

                {
                  color:
                    statusCfg.color,
                },
              ]}
            >
              {statusCfg.label}
            </Text>
          </View>

          <Text
            style={s.heroTitle}
            numberOfLines={2}
          >
            {trip.name}
          </Text>

          <View style={s.heroMeta}>
            <View
              style={
                s.heroMetaItem
              }
            >
              <Ionicons
                name="calendar-outline"
                size={14}
                color={COLORS.white}
              />

              <Text
                style={
                  s.heroMetaText
                }
              >
                {trip.startDate} –{' '}
                {trip.endDate}
              </Text>
            </View>

            <View
              style={
                s.heroMetaItem
              }
            >
              <Ionicons
                name="location-outline"
                size={14}
                color={COLORS.white}
              />

              <Text
                style={
                  s.heroMetaText
                }
                numberOfLines={1}
              >
                {trip.destinations?.join(
                  ', '
                ) ||
                  'Chưa xác định'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* =====================================================
          SUMMARY
      ====================================================== */}

      <View
        style={s.summaryCardWrap}
      >
        <View style={s.heroStats}>
          {[
            {
              icon:
                'wallet-outline',

              val:
                fmtMoney(
                  totalCost
                ),

              lbl: 'Tổng chi',
            },

            {
              icon:
                'people-outline',

              val: String(
                trip.members
                  .length
              ),

              lbl: 'Thành viên',
            },

            {
              icon:
                'calendar-outline',

              val: String(
                trip.activities
                  .length
              ),

              lbl: 'Hoạt động',
            },

            {
              icon:
                'checkmark-circle-outline',

              val:
                `${doneCheck}/${trip.checklist.length}`,

              lbl: 'Checklist',
            },
          ].map(
            (
              item,
              index
            ) => (
              <React.Fragment
                key={item.lbl}
              >
                <View
                  style={
                    s.heroStatItem
                  }
                >
                  <View
                    style={
                      s.summaryIconWrap
                    }
                  >
                    <Ionicons
                      name={
                        item.icon as any
                      }
                      size={16}
                      color={
                        COLORS.orange
                      }
                    />
                  </View>

                  <Text
                    style={
                      s.heroStatVal
                    }
                    numberOfLines={1}
                  >
                    {item.val}
                  </Text>

                  <Text
                    style={
                      s.heroStatLabel
                    }
                  >
                    {item.lbl}
                  </Text>
                </View>

                {index < 3 && (
                  <View
                    style={
                      s.heroStatDivider
                    }
                  />
                )}
              </React.Fragment>
            )
          )}
        </View>
      </View>

      {/* =====================================================
          INTERNAL TAB BAR
      ====================================================== */}

      <View
        style={s.tabBar}
        onLayout={event =>
          setTabBarWidth(
            event.nativeEvent
              .layout.width
          )
        }
      >
        {tabBarWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              s.tabIndicator,

              {
                width:
                  tabWidth - 8,

                transform: [
                  {
                    translateX:
                      indicatorX,
                  },
                ],
              },
            ]}
          />
        )}

        {TABS.map(
          (
            title,
            index
          ) => {
            const active =
              tab === index;

            return (
              <TouchableOpacity
                key={title}
                style={s.tabItem}
                onPress={() =>
                  changeTab(index)
                }
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    s.tabText,

                    active &&
                      s.tabTextActive,
                  ]}
                >
                  {title}
                </Text>

                {index === 1 &&
                  trip.checklist
                    .length > 0 && (
                    <View
                      style={[
                        s.tabBadge,

                        {
                          backgroundColor:
                            doneCheck ===
                            trip
                              .checklist
                              .length
                              ? COLORS.green
                              : COLORS.orange,
                        },
                      ]}
                    >
                      <Text
                        style={
                          s.tabBadgeText
                        }
                      >
                        {doneCheck}/
                        {
                          trip
                            .checklist
                            .length
                        }
                      </Text>
                    </View>
                  )}
              </TouchableOpacity>
            );
          }
        )}
      </View>

      {/* =====================================================
          CONTENT
      ====================================================== */}

      <Animated.View
        style={[
          s.tabContent,

          {
            opacity:
              contentOpacity,

            transform: [
              {
                translateX:
                  contentX,
              },
            ],
          },
        ]}
      >
        {tab === 0 && (
          <PlanTab
            tripId={id!}
          />
        )}

        {tab === 1 && (
          <ChecklistTab
            tripId={id!}
          />
        )}

        {tab === 2 && (
          <ExpensesTab
            tripId={id!}
          />
        )}

        {tab === 3 && (
          <MembersTab
            tripId={id!}
          />
        )}
      </Animated.View>

      {/* FAB */}

      {tab !== 3 && (
        <TouchableOpacity
          style={s.fab}
          onPress={handleFab}
          activeOpacity={0.85}
        >
          <Ionicons
            name="add"
            size={29}
            color={COLORS.white}
          />
        </TouchableOpacity>
      )}

      {/* EDIT */}

      {showEdit && (
        <EditTripModal
          trip={trip}
          visible={showEdit}
          onClose={() =>
            setShowEdit(false)
          }
        />
      )}
    </View>
  );
}

/* =========================================================
   STYLE
========================================================= */

const s =
  StyleSheet.create({
    safe: {
      flex: 1,

      backgroundColor:
        COLORS.background,
    },

    /* ================= HERO ================= */

    hero: {
      height: 250,

      position: 'relative',

      backgroundColor:
        COLORS.mint,
    },

    heroImg: {
      width: '100%',
      height: '100%',
    },

    /*
     * Chỉ làm ảnh dịu rất nhẹ.
     * Gradient bên dưới mới là phần
     * chịu trách nhiệm tăng readability.
     */
    heroSoftOverlay: {
      ...StyleSheet.absoluteFillObject,

      backgroundColor:
        'rgba(0,0,0,0.05)',
    },

    /*
     * Gradient chỉ phủ phần dưới
     * của cover.
     */
    heroGradient: {
      position: 'absolute',

      left: 0,
      right: 0,
      bottom: 0,

      height: '72%',
    },

    heroTopBar: {
      position: 'absolute',

      top: 0,
      left: 0,
      right: 0,

      flexDirection: 'row',

      justifyContent:
        'space-between',

      paddingHorizontal: 16,

      paddingTop: 6,
    },

    heroActions: {
      flexDirection: 'row',
      gap: 9,
    },

    heroBtn: {
      width: 42,
      height: 42,

      borderRadius: 21,

      backgroundColor:
        'rgba(255,255,255,0.94)',

      justifyContent: 'center',
      alignItems: 'center',

      shadowColor: '#000',

      shadowOpacity: 0.1,

      shadowRadius: 5,

      shadowOffset: {
        width: 0,
        height: 2,
      },

      elevation: 3,
    },

    heroContent: {
      position: 'absolute',

      left: 0,
      right: 0,
      bottom: 26,

      paddingHorizontal: 18,
    },

    statusBadge: {
      alignSelf: 'flex-start',

      paddingHorizontal: 12,
      paddingVertical: 6,

      borderRadius: 18,

      marginBottom: 8,
    },

    statusText: {
      fontSize: 11,
      fontWeight: '800',
    },

    heroTitle: {
      fontSize: 27,

      lineHeight: 32,

      fontWeight: '900',

      color: COLORS.white,

      letterSpacing: -0.5,

      marginBottom: 9,

      textShadowColor:
        'rgba(0,0,0,0.18)',

      textShadowRadius: 4,

      textShadowOffset: {
        width: 0,
        height: 1,
      },
    },

    heroMeta: {
      gap: 5,
    },

    heroMetaItem: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 6,
    },

    heroMetaText: {
      flex: 1,

      fontSize: 12,

      color:
        'rgba(255,255,255,0.95)',

      fontWeight: '600',

      textShadowColor:
        'rgba(0,0,0,0.15)',

      textShadowRadius: 3,
    },

    /* ================= SUMMARY ================= */

    summaryCardWrap: {
      marginTop: -18,

      paddingHorizontal: 16,

      zIndex: 5,
    },

    heroStats: {
      flexDirection: 'row',

      backgroundColor:
        COLORS.surface,

      borderRadius: 22,

      paddingVertical: 13,

      paddingHorizontal: 7,

      borderWidth: 1,

      borderColor:
        COLORS.border,

      shadowColor: '#000',

      shadowOpacity: 0.06,

      shadowRadius: 12,

      shadowOffset: {
        width: 0,
        height: 5,
      },

      elevation: 4,
    },

    heroStatItem: {
      flex: 1,

      alignItems: 'center',

      gap: 3,
    },

    summaryIconWrap: {
      width: 29,
      height: 29,

      borderRadius: 15,

      alignItems: 'center',
      justifyContent: 'center',

      backgroundColor:
        COLORS.orangeSoft,

      marginBottom: 1,
    },

    heroStatVal: {
      maxWidth: '95%',

      fontSize: 12,

      fontWeight: '900',

      color: COLORS.text,
    },

    heroStatLabel: {
      fontSize: 9,

      color: COLORS.muted,

      marginTop: 1,
    },

    heroStatDivider: {
      width: 1,

      backgroundColor:
        COLORS.border,

      marginVertical: 7,
    },

    /* ================= INTERNAL TAB ================= */

    tabBar: {
      height: 54,

      marginTop: 10,

      marginHorizontal: 12,

      flexDirection: 'row',

      alignItems: 'center',

      position: 'relative',

      backgroundColor:
        COLORS.surface,

      borderRadius: 18,

      borderWidth: 1,

      borderColor:
        COLORS.border,

      overflow: 'hidden',
    },

    tabIndicator: {
      position: 'absolute',

      left: 4,
      bottom: 0,

      height: 3,

      borderRadius: 2,

      backgroundColor:
        COLORS.orange,
    },

    tabItem: {
      flex: 1,

      height: '100%',

      alignItems: 'center',

      justifyContent: 'center',

      position: 'relative',

      zIndex: 1,
    },

    tabText: {
      fontSize: 12,

      color:
        COLORS.lightText,

      fontWeight: '600',
    },

    tabTextActive: {
      color: COLORS.orange,

      fontWeight: '800',
    },

    tabBadge: {
      position: 'absolute',

      top: 4,
      right: 2,

      minWidth: 19,

      paddingHorizontal: 5,

      paddingVertical: 1,

      borderRadius: 8,

      alignItems: 'center',
    },

    tabBadgeText: {
      color: COLORS.white,

      fontSize: 8,

      fontWeight: '800',
    },

    tabContent: {
      flex: 1,
    },

    /* ================= FAB ================= */

    fab: {
      position: 'absolute',

      bottom: 24,
      right: 20,

      width: 58,
      height: 58,

      borderRadius: 29,

      backgroundColor:
        COLORS.orange,

      justifyContent: 'center',
      alignItems: 'center',

      shadowColor:
        COLORS.orange,

      shadowOpacity: 0.3,

      shadowRadius: 12,

      shadowOffset: {
        width: 0,
        height: 7,
      },

      elevation: 9,
    },

    /* ================= PLAN / TIMELINE ================= */

    planDateGroup: {
      marginBottom: 20,
    },

    dateBadge: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 6,

      alignSelf: 'flex-start',

      paddingHorizontal: 11,
      paddingVertical: 6,

      marginBottom: 12,

      borderRadius: 16,

      backgroundColor:
        COLORS.orangeSoft,
    },

    dateHeader: {
      fontSize: 12,

      fontWeight: '800',

      color:
        COLORS.orangeDark,
    },

    /*
     * Row = timeline rail + card.
     */
    timelineRow: {
      flexDirection: 'row',

      alignItems: 'stretch',

      gap: 9,
    },

    timelineRail: {
      width: 56,

      position: 'relative',

      alignItems: 'center',
    },

    timelineTime: {
      minHeight: 18,

      fontSize: 11,

      fontWeight: '700',

      color: COLORS.muted,

      textAlign: 'center',
    },

    timelineDotOuter: {
      width: 18,
      height: 18,

      marginTop: 6,

      borderRadius: 9,

      backgroundColor:
        COLORS.background,

      alignItems: 'center',
      justifyContent: 'center',

      borderWidth: 2,

      borderColor:
        COLORS.surface,

      zIndex: 2,
    },

    timelineDot: {
      width: 9,
      height: 9,

      borderRadius: 5,
    },

    /*
     * Nét đứt nối timeline.
     *
     * bottom âm giúp đường nối
     * vượt qua khoảng cách giữa 2 card.
     */
    timelineLine: {
      position: 'absolute',

      top: 42,

      bottom: -20,

      left: 27,

      borderLeftWidth: 1.5,

      borderColor: '#CFD3CF',

      borderStyle: 'dashed',
    },

    actCard: {
      flex: 1,

      minHeight: 92,

      flexDirection: 'row',

      alignItems: 'center',

      gap: 8,

      padding: 14,

      backgroundColor:
        COLORS.surface,

      borderRadius: 18,

      borderWidth: 1,

      borderColor:
        COLORS.border,

      shadowColor: '#000',

      shadowOpacity: 0.025,

      shadowRadius: 5,

      elevation: 1,
    },

    actBody: {
      flex: 1,

      gap: 4,
    },

    actName: {
      fontSize: 15,

      fontWeight: '800',

      color: COLORS.text,
    },

    actLocRow: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 4,
    },

    actLoc: {
      flex: 1,

      fontSize: 12,

      color:
        COLORS.lightText,
    },

    actTagsRow: {
      flexDirection: 'row',

      flexWrap: 'wrap',

      gap: 5,

      marginTop: 2,
    },

    actTag: {
      paddingHorizontal: 8,

      paddingVertical: 3,

      borderRadius: 8,
    },

    actTagText: {
      fontSize: 11,

      fontWeight: '600',
    },

    actParticipants: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 3,

      paddingHorizontal: 7,

      paddingVertical: 3,

      backgroundColor:
        COLORS.chip,

      borderRadius: 8,
    },

    actParticipantsText: {
      fontSize: 11,

      color: COLORS.muted,

      fontWeight: '600',
    },

    actNote: {
      marginTop: 2,

      fontSize: 12,

      color:
        COLORS.lightText,

      fontStyle: 'italic',
    },

    /* ================= CHECKLIST ================= */

    clTopBar: {
      backgroundColor:
        COLORS.surface,

      padding: 16,

      borderBottomWidth: 1,

      borderBottomColor:
        COLORS.border,

      gap: 10,
    },

    clProgressRow: {
      flexDirection: 'row',

      justifyContent:
        'space-between',

      alignItems: 'center',
    },

    clProgressLabel: {
      fontSize: 14,

      color: COLORS.text,

      fontWeight: '600',
    },

    clPct: {
      fontSize: 16,

      fontWeight: '900',

      color: COLORS.orange,
    },

    clBarBg: {
      height: 8,

      backgroundColor:
        '#ECEDEA',

      borderRadius: 4,

      overflow: 'hidden',
    },

    clBarFill: {
      height: '100%',

      backgroundColor:
        COLORS.orange,

      borderRadius: 4,
    },

    filterChip: {
      paddingHorizontal: 14,

      paddingVertical: 7,

      borderRadius: 20,

      backgroundColor:
        COLORS.chip,
    },

    filterChipActive: {
      backgroundColor:
        COLORS.orange,
    },

    filterChipText: {
      fontSize: 13,

      color: COLORS.muted,

      fontWeight: '600',
    },

    filterChipTextActive: {
      color: COLORS.white,

      fontWeight: '800',
    },

    clItem: {
      flexDirection: 'row',

      alignItems: 'center',

      backgroundColor:
        COLORS.surface,

      borderRadius: 18,

      padding: 14,

      gap: 12,

      borderWidth: 1,

      borderColor:
        COLORS.border,

      shadowColor: '#000',

      shadowOpacity: 0.025,

      shadowRadius: 4,

      elevation: 1,
    },

    /*
     * Không dùng opacity cho
     * toàn card nữa.
     *
     * Nhờ vậy badge vẫn rõ.
     */
    clItemDone: {
      backgroundColor:
        '#FAFAF7',

      borderColor:
        '#E6E7E2',
    },

    clCheck: {
      width: 26,
      height: 26,

      borderRadius: 13,

      borderWidth: 2,

      borderColor:
        '#C8CCC8',

      justifyContent: 'center',

      alignItems: 'center',
    },

    clCheckDone: {
      backgroundColor:
        COLORS.orange,

      borderColor:
        COLORS.orange,
    },

    clName: {
      fontSize: 14,

      fontWeight: '700',

      color: COLORS.text,
    },

    clNameDone: {
      textDecorationLine:
        'line-through',

      color: '#7B807D',
    },

    clMetaContainer: {
      flexDirection: 'row',

      flexWrap: 'wrap',

      alignItems: 'center',

      gap: 8,

      marginTop: 5,
    },

    clMetaItem: {
      maxWidth: '100%',

      flexDirection: 'row',

      alignItems: 'center',

      gap: 4,
    },

    clMetaText: {
      fontSize: 11,

      color: COLORS.muted,

      fontWeight: '500',
    },

    /*
     * Border + text đậm hơn
     * để category vẫn rõ khi
     * checklist đã hoàn thành.
     */
    clCatBadge: {
      paddingHorizontal: 9,

      paddingVertical: 5,

      borderRadius: 9,

      borderWidth: 1,
    },

    clCatText: {
      fontSize: 11,

      fontWeight: '800',
    },

    /* ================= EXPENSE ================= */

    expTopBar: {
      backgroundColor:
        COLORS.surface,

      borderBottomWidth: 1,

      borderBottomColor:
        COLORS.border,

      padding: 16,

      gap: 12,
    },

    expSummary: {
      flexDirection: 'row',

      backgroundColor:
        COLORS.mint,

      borderRadius: 18,

      padding: 14,

      borderWidth: 1,

      borderColor:
        COLORS.mintDeep,
    },

    expSummaryItem: {
      flex: 1,

      alignItems: 'center',

      paddingHorizontal: 4,
    },

    expSummaryVal: {
      fontSize: 13,

      fontWeight: '900',

      color: COLORS.text,
    },

    expSummaryLabel: {
      fontSize: 11,

      color: COLORS.muted,

      marginTop: 2,
    },

    expSummaryDivider: {
      width: 1,

      backgroundColor:
        COLORS.mintDeep,
    },

    reportBtn: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 9,

      backgroundColor:
        COLORS.orangeSoft,

      borderRadius: 16,

      padding: 12,
    },

    reportIcon: {
      width: 34,
      height: 34,

      borderRadius: 17,

      backgroundColor:
        COLORS.white,

      alignItems: 'center',

      justifyContent: 'center',
    },

    reportBtnText: {
      flex: 1,

      fontSize: 14,

      color:
        COLORS.orangeDark,

      fontWeight: '700',
    },

    expCard: {
      flexDirection: 'row',

      alignItems: 'center',

      backgroundColor:
        COLORS.surface,

      borderRadius: 18,

      padding: 14,

      gap: 12,

      borderWidth: 1,

      borderColor:
        COLORS.border,

      shadowColor: '#000',

      shadowOpacity: 0.025,

      shadowRadius: 4,

      elevation: 1,
    },

    expIconWrap: {
      width: 44,
      height: 44,

      borderRadius: 22,

      justifyContent: 'center',

      alignItems: 'center',
    },

    expName: {
      fontSize: 14,

      fontWeight: '800',

      color: COLORS.text,
    },

    expCategory: {
      marginTop: 2,

      fontSize: 11,

      color: COLORS.muted,

      fontWeight: '700',
    },

    expMeta: {
      marginTop: 2,

      fontSize: 11,

      color:
        COLORS.lightText,
    },

    expAmt: {
      fontSize: 14,

      fontWeight: '900',

      color: COLORS.red,
    },

    expPerPerson: {
      marginTop: 2,

      fontSize: 10,

      color:
        COLORS.lightText,
    },

    /* ================= MEMBERS ================= */

    inviteBanner: {
      backgroundColor:
        COLORS.orange,

      padding: 16,

      gap: 8,
    },

    inviteTop: {
      flexDirection: 'row',

      alignItems: 'center',

      justifyContent:
        'space-between',

      gap: 12,
    },

    inviteActions: {
      flexDirection: 'row',

      gap: 8,
    },

    inviteTitleText: {
      fontSize: 10,

      color:
        'rgba(255,255,255,0.72)',

      fontWeight: '700',

      letterSpacing: 1,
    },

    inviteCodeText: {
      fontSize: 26,

      fontWeight: '900',

      color: COLORS.white,

      letterSpacing: 5,
    },

    inviteActionBtn: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 5,

      backgroundColor:
        'rgba(255,255,255,0.16)',

      paddingHorizontal: 11,

      paddingVertical: 8,

      borderRadius: 12,
    },

    inviteActionTxt: {
      fontSize: 12,

      color: COLORS.white,

      fontWeight: '700',
    },

    inviteShareBtn: {
      backgroundColor:
        COLORS.white,
    },

    inviteShareTxt: {
      fontSize: 12,

      color:
        COLORS.orangeDark,

      fontWeight: '800',
    },

    inviteHint: {
      fontSize: 12,

      color:
        'rgba(255,255,255,0.72)',
    },

    membersTopBar: {
      flexDirection: 'row',

      alignItems: 'center',

      backgroundColor:
        COLORS.surface,

      padding: 14,

      borderBottomWidth: 1,

      borderBottomColor:
        COLORS.border,

      gap: 12,
    },

    membersTripName: {
      fontSize: 15,

      fontWeight: '800',

      color: COLORS.text,
    },

    membersMeta: {
      marginTop: 2,

      fontSize: 12,

      color: COLORS.muted,
    },

    addMemberBtn: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 6,

      backgroundColor:
        COLORS.orangeSoft,

      paddingHorizontal: 14,

      paddingVertical: 9,

      borderRadius: 20,
    },

    addMemberTxt: {
      fontSize: 13,

      color:
        COLORS.orangeDark,

      fontWeight: '800',
    },

    memberCard: {
      flexDirection: 'row',

      alignItems: 'center',

      backgroundColor:
        COLORS.surface,

      borderRadius: 18,

      padding: 14,

      gap: 14,

      borderWidth: 1,

      borderColor:
        COLORS.border,

      shadowColor: '#000',

      shadowOpacity: 0.025,

      shadowRadius: 4,

      elevation: 1,
    },

    memberAvatar: {
      width: 46,
      height: 46,

      borderRadius: 23,

      backgroundColor:
        COLORS.orange,

      justifyContent: 'center',

      alignItems: 'center',
    },

    memberAvatarLeader: {
      backgroundColor:
        COLORS.yellow,
    },

    memberAvatarText: {
      color: COLORS.white,

      fontWeight: '800',

      fontSize: 17,
    },

    memberNameRow: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 8,

      flexWrap: 'wrap',

      marginBottom: 2,
    },

    memberName: {
      fontSize: 15,

      fontWeight: '800',

      color: COLORS.text,
    },

    leaderBadge: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 3,

      backgroundColor:
        COLORS.yellowSoft,

      paddingHorizontal: 7,

      paddingVertical: 3,

      borderRadius: 8,
    },

    leaderBadgeText: {
      fontSize: 10,

      color: COLORS.yellow,

      fontWeight: '700',
    },

    memberPhone: {
      fontSize: 12,

      color: COLORS.muted,
    },

    memberPaidAmt: {
      fontSize: 13,

      fontWeight: '800',

      color: COLORS.orange,
    },

    memberPaidLabel: {
      fontSize: 10,

      color:
        COLORS.lightText,
    },

    /* ================= MODAL ================= */

    modalOverlay: {
      flex: 1,

      backgroundColor:
        'rgba(0,0,0,0.42)',

      justifyContent:
        'flex-end',
    },

    actionSheet: {
      backgroundColor:
        COLORS.surface,

      borderTopLeftRadius: 26,

      borderTopRightRadius: 26,

      padding: 20,

      paddingBottom: 36,

      gap: 2,
    },

    sheetMemberHeader: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 14,

      paddingBottom: 16,
    },

    sheetMemberName: {
      fontSize: 17,

      fontWeight: '800',

      color: COLORS.text,
    },

    sheetMemberPhone: {
      fontSize: 13,

      color: COLORS.muted,

      marginTop: 2,
    },

    sheetDivider: {
      height: 1,

      backgroundColor:
        COLORS.border,

      marginBottom: 10,
    },

    sheetItem: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 14,

      paddingVertical: 12,
    },

    sheetIcon: {
      width: 40,
      height: 40,

      borderRadius: 20,

      justifyContent: 'center',

      alignItems: 'center',
    },

    sheetLabel: {
      fontSize: 15,

      color: COLORS.text,

      fontWeight: '600',
    },

    sheetCancel: {
      marginTop: 10,

      backgroundColor:
        COLORS.chip,

      borderRadius: 16,

      paddingVertical: 14,

      alignItems: 'center',
    },

    sheetCancelText: {
      fontSize: 15,

      color: COLORS.text,

      fontWeight: '700',
    },

    addModalHeader: {
      flexDirection: 'row',

      justifyContent:
        'space-between',

      alignItems: 'center',

      marginBottom: 8,
    },

    addModalTitle: {
      fontSize: 19,

      fontWeight: '900',

      color: COLORS.text,
    },

    addModalHint: {
      fontSize: 13,

      color: COLORS.muted,

      marginBottom: 14,
    },

    memberSearchRow: {
      flexDirection: 'row',

      gap: 10,

      marginBottom: 12,
    },

    searchInputWrap: {
      flex: 1,

      flexDirection: 'row',

      alignItems: 'center',

      gap: 8,

      borderRadius: 14,

      paddingHorizontal: 12,

      backgroundColor:
        COLORS.chip,
    },

    searchInput: {
      flex: 1,

      fontSize: 15,

      color: COLORS.text,

      paddingVertical: 12,
    },

    searchBtn: {
      backgroundColor:
        COLORS.orange,

      borderRadius: 14,

      paddingHorizontal: 16,

      paddingVertical: 14,

      justifyContent: 'center',

      alignItems: 'center',
    },

    searchBtnText: {
      color: COLORS.white,

      fontWeight: '800',

      fontSize: 14,
    },

    foundCard: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 12,

      backgroundColor:
        COLORS.greenSoft,

      borderRadius: 16,

      padding: 14,

      borderWidth: 1,

      borderColor:
        '#BFEAD9',

      marginBottom: 10,
    },

    foundName: {
      fontSize: 15,

      fontWeight: '800',

      color: COLORS.text,
    },

    foundMeta: {
      fontSize: 12,

      color: COLORS.muted,

      marginTop: 2,
    },

    notFoundBox: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 10,

      backgroundColor:
        COLORS.yellowSoft,

      borderRadius: 16,

      padding: 14,

      marginBottom: 10,
    },

    notFoundText: {
      fontSize: 13,

      color: COLORS.yellow,

      fontWeight: '700',
    },

    notFoundSub: {
      fontSize: 12,

      color: '#9B6506',

      marginTop: 2,
    },

    inviteBtn: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 5,

      backgroundColor:
        COLORS.orange,

      borderRadius: 12,

      paddingHorizontal: 12,

      paddingVertical: 9,
    },

    inviteBtnText: {
      color: COLORS.white,

      fontWeight: '800',

      fontSize: 13,
    },

    /* ================= EDIT ================= */

    editSafe: {
      flex: 1,

      backgroundColor:
        COLORS.background,
    },

    editHeader: {
      flexDirection: 'row',

      alignItems: 'center',

      justifyContent:
        'space-between',

      paddingHorizontal: 16,

      paddingVertical: 12,

      backgroundColor:
        COLORS.surface,

      borderBottomWidth: 1,

      borderBottomColor:
        COLORS.border,
    },

    editHeaderBtn: {
      width: 44,
      height: 44,

      borderRadius: 22,

      alignItems: 'center',

      justifyContent: 'center',

      backgroundColor:
        COLORS.chip,
    },

    editHeaderTitle: {
      fontSize: 17,

      fontWeight: '800',

      color: COLORS.text,
    },

    editSaveBtn: {
      minWidth: 64,

      height: 44,

      paddingHorizontal: 14,

      borderRadius: 22,

      alignItems: 'center',

      justifyContent: 'center',

      backgroundColor:
        COLORS.orange,
    },

    editSaveText: {
      color: COLORS.white,

      fontWeight: '800',

      fontSize: 14,
    },

    editCoverUpload: {
      borderRadius: 20,

      overflow: 'hidden',

      backgroundColor:
        COLORS.surface,

      borderWidth: 1,

      borderColor:
        COLORS.border,
    },

    editCoverPlaceholder: {
      height: 180,

      justifyContent: 'center',

      alignItems: 'center',

      backgroundColor:
        COLORS.orangeSoft,

      gap: 8,
    },

    editCoverIconWrap: {
      width: 54,
      height: 54,

      borderRadius: 27,

      backgroundColor:
        COLORS.white,

      justifyContent: 'center',

      alignItems: 'center',
    },

    editCoverTitle: {
      fontSize: 15,

      fontWeight: '800',

      color: COLORS.orange,
    },

    editCoverHint: {
      fontSize: 12,

      color: COLORS.muted,

      marginTop: 8,
    },

    editCoverPreview: {
      width: '100%',

      height: 180,
    },

    editLabel: {
      fontSize: 13,

      fontWeight: '700',

      color: COLORS.text,

      marginBottom: 8,
    },

    editInput: {
      borderRadius: 14,

      paddingHorizontal: 14,

      paddingVertical: 13,

      fontSize: 15,

      color: COLORS.text,

      backgroundColor:
        COLORS.surface,

      borderWidth: 1,

      borderColor:
        COLORS.border,
    },

    editDatesRow: {
      flexDirection: 'row',

      gap: 12,
    },

    editDateWrap: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 8,

      borderRadius: 14,

      paddingHorizontal: 12,

      backgroundColor:
        COLORS.surface,

      borderWidth: 1,

      borderColor:
        COLORS.border,
    },

    editDateInput: {
      flex: 1,

      fontSize: 14,

      color: COLORS.text,

      paddingVertical: 13,
    },

    destinationInputRow: {
      flexDirection: 'row',

      gap: 10,

      marginBottom: 10,
    },

    destinationInput: {
      flex: 1,

      flexDirection: 'row',

      alignItems: 'center',

      gap: 8,

      paddingVertical: 0,
    },

    destinationTextInput: {
      flex: 1,

      fontSize: 14,

      color: COLORS.text,

      paddingVertical: 12,
    },

    destinationChips: {
      flexDirection: 'row',

      flexWrap: 'wrap',

      gap: 8,
    },

    destChip: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 6,

      backgroundColor:
        COLORS.orangeSoft,

      borderRadius: 20,

      paddingHorizontal: 12,

      paddingVertical: 7,
    },

    destChipText: {
      fontSize: 13,

      color:
        COLORS.orangeDark,

      fontWeight: '700',
    },

    /* ================= EMPTY ================= */

    emptyFull: {
      alignItems: 'center',

      paddingTop: 60,

      gap: 10,
    },

    emptyIcon: {
      width: 80,
      height: 80,

      borderRadius: 40,

      backgroundColor:
        COLORS.orangeSoft,

      justifyContent: 'center',

      alignItems: 'center',

      marginBottom: 4,
    },

    emptyTitle: {
      fontSize: 16,

      fontWeight: '800',

      color: COLORS.text,
    },

    emptySub: {
      fontSize: 13,

      color: COLORS.muted,
    },

    /* ================= NOT FOUND ================= */

    notFoundScreen: {
      flex: 1,

      backgroundColor:
        COLORS.background,

      justifyContent: 'center',

      alignItems: 'center',

      padding: 30,
    },

    notFoundMainIcon: {
      width: 90,
      height: 90,

      borderRadius: 45,

      backgroundColor:
        COLORS.orangeSoft,

      alignItems: 'center',

      justifyContent: 'center',

      marginBottom: 16,
    },

    notFoundMainTitle: {
      fontSize: 18,

      fontWeight: '800',

      color: COLORS.text,

      marginBottom: 18,
    },

    backMainBtn: {
      backgroundColor:
        COLORS.orange,

      paddingHorizontal: 24,

      paddingVertical: 13,

      borderRadius: 22,
    },

    backMainBtnText: {
      color: COLORS.white,

      fontWeight: '800',
    },
  });