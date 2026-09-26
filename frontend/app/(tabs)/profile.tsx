import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Modal, Platform, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import TabPageTransition from "../../components/TabPageTransition";

function useConfirm() {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [callback, setCallback] = useState<(() => void) | null>(null);

  const confirm = (t: string, msg: string, cb: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${t}\n\n${msg}`)) cb();
    } else {
      setTitle(t);
      setMessage(msg);
      setCallback(() => cb);
      setVisible(true);
    }
  };

  const Dialog = () => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={ds.overlay}>
        <View style={ds.box}>
          <Text style={ds.title}>{title}</Text>
          <Text style={ds.msg}>{message}</Text>
          <View style={ds.row}>
            <TouchableOpacity style={ds.cancelBtn} onPress={() => setVisible(false)}>
              <Text style={ds.cancelTxt}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ds.confirmBtn} onPress={() => { setVisible(false); callback?.(); }}>
              <Text style={ds.confirmTxt}>Đăng xuất</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return { confirm, Dialog };
}

const ds = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  box: { backgroundColor: '#fff', borderRadius: 18, padding: 24, width: '100%', gap: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#111', textAlign: 'center' },
  msg: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelTxt: { fontSize: 15, fontWeight: '600', color: '#374151' },
  confirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center' },
  confirmTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

const MenuItem = ({ icon, label, onPress, danger }: {
  icon: string; label: string; onPress: () => void; danger?: boolean;
}) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.menuLeft}>
      <View style={[styles.menuIconWrap, danger && { backgroundColor: '#FEE2E2' }]}>
        <Ionicons name={icon as any} size={18} color={danger ? '#EF4444' : '#6B7280'} />
      </View>
      <Text style={[styles.menuLabel, danger && { color: '#EF4444' }]}>{label}</Text>
    </View>
    <Ionicons name="chevron-forward" size={16} color={danger ? '#FCA5A5' : '#D1D5DB'} />
  </TouchableOpacity>
);

export default function ProfileTab() {
  const router = useRouter();
  const { user, signOut } = useApp();
  const { confirm, Dialog } = useConfirm();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    console.log('[ProfileTab] handleSignOut called');
    setSigningOut(true);
    try {
      console.log('[ProfileTab] calling signOut...');
      await signOut();
      console.log('[ProfileTab] signOut done, navigating to sign-in');
      router.replace('/(auth)/sign-in' as any);
    } catch (err) {
      console.error('[ProfileTab] signOut error:', err);
      setSigningOut(false);
    }
  };

  return (
    <TabPageTransition index={2}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push("/settings")}
          >
            <Ionicons name="settings-outline" size={22} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cá nhân</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.avatarArea}>
          <View style={styles.avatarBig}>
            <Text style={styles.avatarBigText}>
              {user?.username ? user.username[0].toUpperCase() : "U"}
            </Text>
          </View>
          <Text style={styles.nameText}>{user?.username || "Người dùng"}</Text>
          <Text style={styles.emailText}>{user?.email || ""}</Text>
        </View>
        <View style={styles.card}>
          <MenuItem
            icon="person-outline"
            label="Thông tin cá nhân"
            onPress={() => router.push("/profile/setup" as any)}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="qr-code-outline"
            label="QR & Số tài khoản ngân hàng"
            onPress={() => router.push("/profile/qr" as any)}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="time-outline"
            label="Lịch sử chuyến đi"
            onPress={() => router.push("/profile/history" as any)}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="settings-outline"
            label="Cài đặt"
            onPress={() => router.push("/settings" as any)}
          />
          <View style={styles.divider} />
          <MenuItem
            icon={signingOut ? "reload-outline" : "log-out-outline"}
            label={signingOut ? "Đang đăng xuất..." : "Đăng xuất"}
            onPress={signingOut ? () => {} : handleSignOut}
            danger
          />
        </View>
      </SafeAreaView>
    </TabPageTransition>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  iconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  avatarArea: { alignItems: 'center', paddingVertical: 28, backgroundColor: '#fff', marginBottom: 16 },
  avatarBig: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#1B4F8A', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: '#1B4F8A', shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  avatarBigText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  nameText: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 4 },
  emailText: { fontSize: 14, color: '#6B7280' },
  card: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  menuIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  menuLabel: { fontSize: 15, color: '#111', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 68 },
});