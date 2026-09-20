import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator, Alert, Dimensions, Image, KeyboardAvoidingView,
  Linking, Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { logAction, logError, logInfo, logWarn } from '../../utils/logger';

const TAG = 'CreateTrip';
const { width, height } = Dimensions.get('window');

// Lấy tại: https://console.cloud.google.com → Enable "Places API" + "Maps JavaScript API"

const SUGGESTED = [
  'Đà Lạt', 'Phú Quốc', 'Hội An', 'Huế', 'Sa Pa',
  'Hà Nội', 'Nha Trang', 'Đà Nẵng', 'Hạ Long', 'Mũi Né',
];

function formatDateInput(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`;
  return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
}

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  const labels = ['Cơ bản', 'Điểm đến', 'Thành viên'];
  return (
    <View style={st.stepWrap}>
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <View style={st.stepItem}>
            <View style={[st.stepCircle, i < current-1 ? st.stepDone : i === current-1 ? st.stepActive : st.stepInactive]}>
              {i < current-1
                ? <Ionicons name="checkmark" size={14} color="#fff" />
                : <Text style={[st.stepNum, i === current-1 ? {color:'#fff'} : {color:'#9CA3AF'}]}>{i+1}</Text>
              }
            </View>
            <Text style={[st.stepLabel, i === current-1 && {color:'#1B4F8A',fontWeight:'700'}]}>{labels[i]}</Text>
          </View>
          {i < total-1 && <View style={[st.stepLine, i < current-1 ? st.stepLineDone : {}]} />}
        </React.Fragment>
      ))}
    </View>
  );
}

// ── Google Maps Picker (Web embedded iframe + Native fallback) ────────────────
function MapPickerModal({ visible, onClose, onSelectPlace, initialQuery }: {
  visible: boolean;
  onClose: () => void;
  onSelectPlace: (name: string, address: string) => void;
  initialQuery?: string;
}) {
  const [searchText, setSearchText] = useState(initialQuery || '');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchPlaces = async (text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        // Nominatim OpenStreetMap — free, no API key needed
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=6&accept-language=vi&countrycodes=vn,la,kh,th,sg,my`;
        const res  = await fetch(url, {
          headers: { 'User-Agent': 'TripMateApp/1.0 (contact@tripmate.app)' },
        });
        const data: any[] = await res.json();
        if (data.length > 0) {
          // Map Nominatim format → same shape the rest of the code expects
          const preds = data.map(item => {
            const parts = item.display_name.split(', ');
            return {
              place_id: item.place_id?.toString() || item.display_name,
              description: item.display_name,
              structured_formatting: {
                main_text: parts[0],
                secondary_text: parts.slice(1).join(', '),
              },
              lat: item.lat,
              lon: item.lon,
            };
          });
          setSuggestions(preds);
        } else {
          setSuggestions(getLocalSuggestions(text));
        }
      } catch {
        // Network error → fallback to local list
        setSuggestions(getLocalSuggestions(text));
      } finally {
        setLoading(false);
      }
    }, 600); // 600ms debounce — Nominatim rate limit: max 1 req/s
  };

  const getLocalSuggestions = (text: string) => {
    const matches = SUGGESTED.filter(d => d.toLowerCase().includes(text.toLowerCase()))
      .map(d => ({ place_id: d, description: `${d}, Việt Nam`, structured_formatting: { main_text: d, secondary_text: 'Việt Nam' } }));
    const hasExact = matches.find(m => m.structured_formatting.main_text.toLowerCase() === text.toLowerCase());
    if (!hasExact && text.trim()) {
      matches.push({ place_id: '__custom__', description: text.trim(), structured_formatting: { main_text: text.trim(), secondary_text: 'Địa điểm tùy chọn' } });
    }
    return matches;
  };

  const handleSelect = (pred: any) => {
    const name    = pred.structured_formatting?.main_text || pred.description;
    const address = pred.description;
    logAction(TAG, 'Place selected', { name, address });
    onSelectPlace(name, address);
    setSearchText('');
    setSuggestions([]);
    onClose();
  };

  const openExternalMaps = () => {
    const q = searchText.trim() || 'Việt Nam du lịch';
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}&hl=vi`);
    logAction(TAG, 'Open external Google Maps', { q });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mp.overlay}>
        <View style={mp.sheet}>
          {/* Handle + Header */}
          <View style={mp.handle} />
          <View style={mp.header}>
            <TouchableOpacity onPress={onClose} style={mp.closeBtn}>
              <Ionicons name="close" size={22} color="#374151" />
            </TouchableOpacity>
            <Text style={mp.title}>🗺️ Chọn địa điểm</Text>
            <TouchableOpacity
              style={mp.toggleMapBtn}
              onPress={openExternalMaps}
            >
              <Ionicons name={'map-outline'} size={16} color={'#1B4F8A'} />
              <Text style={mp.toggleMapTxt}>Mở Maps</Text>
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={mp.searchRow}>
            <View style={mp.searchWrap}>
              <Ionicons name="search-outline" size={17} color="#9CA3AF" />
              <TextInput
                style={mp.searchInput}
                placeholder="Nhập tên thành phố, địa điểm..."
                placeholderTextColor="#C0C8D0"
                value={searchText}
                onChangeText={t => { setSearchText(t); searchPlaces(t); }}
                returnKeyType="search"
                onSubmitEditing={() => {
                  if (searchText.trim()) {
                    handleSelect({ place_id: '__custom__', description: searchText, structured_formatting: { main_text: searchText, secondary_text: 'Địa điểm tùy chọn' } });
                  }
                }}
                autoFocus
              />
              {loading && <ActivityIndicator size="small" color="#1B4F8A" />}
              {searchText.length > 0 && !loading && (
                <TouchableOpacity onPress={() => { setSearchText(''); setSuggestions([]); }}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Suggestions list */}
          {(
            <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
              {suggestions.length > 0
                ? suggestions.map((p, i) => (
                    <TouchableOpacity key={p.place_id + i} style={mp.predRow} onPress={() => handleSelect(p)}>
                      <View style={mp.predIcon}>
                        <Ionicons name="location" size={17} color="#1B4F8A" />
                      </View>
                      <View style={{flex:1}}>
                        <Text style={mp.predMain}>{p.structured_formatting?.main_text || p.description}</Text>
                        {p.structured_formatting?.secondary_text
                          ? <Text style={mp.predSub} numberOfLines={1}>{p.structured_formatting.secondary_text}</Text>
                          : null}
                      </View>
                      <Ionicons name="add-circle-outline" size={22} color="#10B981" />
                    </TouchableOpacity>
                  ))
                : !searchText
                  ? <>
                      <Text style={mp.sectionHint}>📍 Phổ biến tại Việt Nam</Text>
                      <View style={mp.popularGrid}>
                        {SUGGESTED.map(d => (
                          <TouchableOpacity key={d} style={mp.popularChip}
                            onPress={() => handleSelect({ place_id: d, description: `${d}, Việt Nam`, structured_formatting: { main_text: d, secondary_text: 'Việt Nam' } })}>
                            <Text style={mp.popularChipText}>{d}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  : <View style={mp.noResult}>
                      <Text style={mp.noResultText}>Không có gợi ý — bấm bản đồ để xem vị trí</Text>
                      <TouchableOpacity style={mp.noResultBtn}
                        onPress={() => handleSelect({ place_id: '__custom__', description: searchText, structured_formatting: { main_text: searchText, secondary_text: 'Địa điểm tùy chọn' } })}>
                        <Ionicons name="add" size={15} color="#fff" />
                        <Text style={{color:'#fff',fontWeight:'700',fontSize:13}}>Thêm "{searchText}"</Text>
                      </TouchableOpacity>
                    </View>
              }
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const mp = StyleSheet.create({
  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'flex-end' },
  sheet: { backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, paddingHorizontal:18, paddingTop:10, paddingBottom:Platform.OS==='ios'?36:24, maxHeight:height*0.88 },
  handle: { width:40, height:4, backgroundColor:'#E5E7EB', borderRadius:2, alignSelf:'center', marginBottom:14 },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:14 },
  closeBtn: { width:36, height:36, justifyContent:'center', alignItems:'center' },
  title: { fontSize:17, fontWeight:'700', color:'#111', flex:1, textAlign:'center' },
  toggleMapBtn: { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:12, paddingVertical:7, borderRadius:20, borderWidth:1.5, borderColor:'#1B4F8A' },
  toggleMapBtnActive: { backgroundColor:'#1B4F8A' },
  toggleMapTxt: { fontSize:12, color:'#1B4F8A', fontWeight:'700' },
  searchRow: { marginBottom:10 },
  searchWrap: { flexDirection:'row', alignItems:'center', gap:8, borderWidth:1.5, borderColor:'#E5E7EB', borderRadius:12, paddingHorizontal:12, paddingVertical:11, backgroundColor:'#F9FAFB' },
  searchInput: { flex:1, fontSize:15, color:'#111' },
  mapContainer: { marginBottom:10, gap:8 },
  mapFrame: { width:'100%', height:280, borderRadius:12, overflow:'hidden', borderWidth:1, borderColor:'#E5E7EB' },
  mapNativeBox: { alignItems:'center', gap:8, paddingVertical:28, backgroundColor:'#F0F9FF', borderRadius:14, borderWidth:1.5, borderColor:'#BFDBFE' },
  mapNativeTitle: { fontSize:16, fontWeight:'700', color:'#1B4F8A' },
  mapNativeSub: { fontSize:13, color:'#64B5F6', textAlign:'center', paddingHorizontal:24 },
  mapNativeBtn: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#1B4F8A', borderRadius:12, paddingHorizontal:20, paddingVertical:11, marginTop:4 },
  mapNativeBtnText: { color:'#fff', fontWeight:'700', fontSize:14 },
  confirmFromMapBtn: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:'#10B981', borderRadius:12, paddingVertical:13 },
  confirmFromMapTxt: { color:'#fff', fontWeight:'700', fontSize:14 },
  predRow: { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:12, borderBottomWidth:1, borderBottomColor:'#F9FAFB' },
  predIcon: { width:36, height:36, borderRadius:18, backgroundColor:'#EFF6FF', justifyContent:'center', alignItems:'center' },
  predMain: { fontSize:15, fontWeight:'600', color:'#111' },
  predSub: { fontSize:12, color:'#9CA3AF', marginTop:1 },
  sectionHint: { fontSize:13, fontWeight:'600', color:'#6B7280', paddingVertical:12 },
  popularGrid: { flexDirection:'row', flexWrap:'wrap', gap:8, paddingBottom:12 },
  popularChip: { paddingHorizontal:14, paddingVertical:8, borderRadius:20, backgroundColor:'#F3F4F6', borderWidth:1.5, borderColor:'#E5E7EB' },
  popularChipText: { fontSize:13, color:'#374151', fontWeight:'500' },
  noResult: { alignItems:'center', gap:10, paddingVertical:24 },
  noResultText: { fontSize:13, color:'#9CA3AF', textAlign:'center' },
  noResultBtn: { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'#1B4F8A', borderRadius:10, paddingHorizontal:16, paddingVertical:10 },
});

// ── Member Search Modal ───────────────────────────────────────────────────────
function MemberSearchModal({ visible, onClose, onAdd, existingPhones }: {
  visible: boolean; onClose: () => void;
  onAdd: (phone: string, name?: string) => void;
  existingPhones: string[];
}) {
  const { findUser } = useApp() as any;
  const [query, setQuery]       = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound]   = useState(false);

  const doSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true); setFoundUser(null); setNotFound(false);
    try {
      const result = findUser ? await findUser(q) : null;
      if (result) { setFoundUser(result); }
      else { setNotFound(true); }
    } catch { setNotFound(true); }
    finally { setSearching(false); }
  };

  const handleAdd = (phone: string, name?: string) => {
    if (existingPhones.includes(phone)) return;
    onAdd(phone, name);
    setQuery(''); setFoundUser(null); setNotFound(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mp.overlay}>
        <View style={mp.sheet}>
          <View style={mp.handle} />
          <View style={mp.header}>
            <TouchableOpacity onPress={onClose} style={mp.closeBtn}><Ionicons name="close" size={22} color="#374151" /></TouchableOpacity>
            <Text style={mp.title}>👤 Tìm thành viên</Text>
            <View style={{ width:36 }} />
          </View>
          <Text style={{fontSize:13,color:'#6B7280',marginBottom:12}}>Tìm qua số điện thoại hoặc email</Text>
          <View style={{flexDirection:'row',gap:10,marginBottom:12}}>
            <View style={[mp.searchWrap,{flex:1}]}>
              <Ionicons name="person-outline" size={16} color="#9CA3AF" />
              <TextInput style={mp.searchInput} placeholder="0912 345 678 hoặc email@..."
                placeholderTextColor="#C0C8D0" value={query} onChangeText={setQuery}
                autoCapitalize="none" returnKeyType="search" onSubmitEditing={doSearch} autoFocus />
            </View>
            <TouchableOpacity style={{backgroundColor:'#1B4F8A',borderRadius:12,paddingHorizontal:18,justifyContent:'center'}} onPress={doSearch} disabled={searching}>
              {searching ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{color:'#fff',fontWeight:'700',fontSize:14}}>Tìm</Text>}
            </TouchableOpacity>
          </View>
          {foundUser && (
            <View style={{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#ECFDF5',borderRadius:12,padding:14,borderWidth:1.5,borderColor:'#A7F3D0',marginBottom:10}}>
              <View style={{width:42,height:42,borderRadius:21,backgroundColor:'#1B4F8A',justifyContent:'center',alignItems:'center'}}>
                <Text style={{color:'#fff',fontWeight:'800',fontSize:16}}>{(foundUser.username||'?')[0].toUpperCase()}</Text>
              </View>
              <View style={{flex:1}}>
                <Text style={{fontSize:15,fontWeight:'700',color:'#111'}}>{foundUser.username||foundUser.name}</Text>
                <Text style={{fontSize:12,color:'#6B7280',marginTop:2}}>{foundUser.phone||foundUser.email}</Text>
              </View>
              <TouchableOpacity style={{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'#1B4F8A',borderRadius:10,paddingHorizontal:12,paddingVertical:8}}
                onPress={() => handleAdd(foundUser.phone||query, foundUser.username)}>
                <Ionicons name="person-add" size={15} color="#fff" />
                <Text style={{color:'#fff',fontWeight:'700',fontSize:13}}>Mời</Text>
              </TouchableOpacity>
            </View>
          )}
          {notFound && (
            <View style={{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#FFFBEB',borderRadius:12,padding:14,borderWidth:1,borderColor:'#FDE68A',marginBottom:10}}>
              <Ionicons name="information-circle-outline" size={20} color="#F59E0B" />
              <View style={{flex:1}}>
                <Text style={{fontSize:13,color:'#92400E',fontWeight:'600'}}>Không tìm thấy tài khoản</Text>
                <Text style={{fontSize:12,color:'#B45309',marginTop:2}}>Vẫn có thể mời qua số điện thoại</Text>
              </View>
              <TouchableOpacity style={{backgroundColor:'#F59E0B',borderRadius:10,paddingHorizontal:12,paddingVertical:8}}
                onPress={() => handleAdd(query.trim())}>
                <Text style={{color:'#fff',fontWeight:'700',fontSize:13}}>Thêm</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CreateTripScreen() {
  const router = useRouter();
  const { createTrip } = useApp();
  const [step, setStep]     = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdTrip, setCreatedTrip] = useState<any>(null);
  const [showPlaces, setShowPlaces]   = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  const [basic, setBasic] = useState({ name:'', startDate:'', endDate:'', description:'' });
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<{name:string;address:string}[]>([]);
  const [destInput, setDestInput]       = useState('');
  const [members, setMembers]           = useState<{phone:string;name?:string}[]>([]);

  const goBack = () => {
    if (step > 1) setStep(s => s-1);
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/trips' as any);
  };

  const addDest = (name: string, address: string) => {
    if (!name.trim()) return;
    if (destinations.find(d => d.name.toLowerCase() === name.toLowerCase().trim())) {
      logWarn(TAG, 'Dest already added', {name}); return;
    }
    logAction(TAG, 'Add dest', {name});
    setDestinations(prev => [...prev, { name: name.trim(), address }]);
    setDestInput('');
  };

  const removeDest = (name: string) => setDestinations(prev => prev.filter(d => d.name !== name));

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
    setCoverImage(result.assets[0].uri);
  };

  const handleNext = async () => {
    if (step === 1) {
      if (!basic.name.trim()) { alert('Vui lòng nhập tên chuyến đi'); return; }
      if (basic.startDate.length < 10) { alert('Ngày bắt đầu chưa đúng định dạng DD/MM/YYYY'); return; }
      if (basic.endDate.length < 10)   { alert('Ngày kết thúc chưa đúng định dạng DD/MM/YYYY'); return; }
      setStep(2);
    } else if (step === 2) {
      if (!destinations.length) { alert('Vui lòng chọn ít nhất 1 điểm đến'); return; }
      setStep(3);
    } else {
      await doCreate();
    }
  };

  const doCreate = async (skipMembers = false) => {
    setLoading(true);
    try {
      const trip = await createTrip({
        ...basic,
        image: coverImage || undefined,
        destinations: destinations.map(d => d.name),
        memberPhones: skipMembers ? [] : members.map(m => m.phone),
      });
      setCreatedTrip(trip);
      setSuccess(true);
    } catch (err: any) {
      logError(TAG, 'Create error', err);
      alert(err.message || 'Không thể tạo chuyến đi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={st.safe}>
      <View style={st.header}>
        <TouchableOpacity onPress={goBack} style={st.iconBtn}>
          <Ionicons name={step > 1 ? 'arrow-back' : 'close'} size={22} color="#111" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Tạo chuyến đi</Text>
        <View style={{width:40}} />
      </View>

      <StepIndicator current={step} total={3} />

      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1}}>
        <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">

          {/* ── Step 1 ── */}
          {step === 1 && (
            <View style={st.stepBody}>
              <Text style={st.label}>Tên chuyến đi *</Text>
              <TextInput style={st.input} placeholder="Đà Lạt Summer 2025" placeholderTextColor="#C0C8D0"
                value={basic.name} onChangeText={v => setBasic(p=>({...p,name:v}))} />

              <View style={{flexDirection:'row',gap:12}}>
                <View style={{flex:1}}>
                  <Text style={st.label}>Ngày bắt đầu *</Text>
                  <View style={st.dateWrap}>
                    <Ionicons name="calendar-outline" size={15} color="#6B7280" />
                    <TextInput style={{flex:1,fontSize:15,color:'#111'}} placeholder="DD/MM/YYYY"
                      placeholderTextColor="#C0C8D0" value={basic.startDate} keyboardType="numeric" maxLength={10}
                      onChangeText={v=>setBasic(p=>({...p,startDate:formatDateInput(v)}))} />
                  </View>
                </View>
                <View style={{flex:1}}>
                  <Text style={st.label}>Ngày kết thúc *</Text>
                  <View style={st.dateWrap}>
                    <Ionicons name="calendar-outline" size={15} color="#6B7280" />
                    <TextInput style={{flex:1,fontSize:15,color:'#111'}} placeholder="DD/MM/YYYY"
                      placeholderTextColor="#C0C8D0" value={basic.endDate} keyboardType="numeric" maxLength={10}
                      onChangeText={v=>setBasic(p=>({...p,endDate:formatDateInput(v)}))} />
                  </View>
                </View>
              </View>

              <Text style={st.label}>Mô tả (tùy chọn)</Text>
              <TextInput style={[st.input,{height:80,textAlignVertical:'top'}]} multiline numberOfLines={3}
                placeholder="Chuyến hè cùng những người bạn thân..." placeholderTextColor="#C0C8D0"
                value={basic.description} onChangeText={v=>setBasic(p=>({...p,description:v}))} />

              <Text style={st.label}>Ảnh bìa</Text>
              <TouchableOpacity style={st.coverUploadBtn} onPress={pickCoverImage}>
                {coverImage ? (
                  <Image source={{ uri: coverImage }} style={st.coverImagePreview} resizeMode="cover" />
                ) : (
                  <View style={st.coverPlaceholder}>
                    <View style={st.coverIconWrap}>
                      <Ionicons name="camera" size={20} color="#1B4F8A" />
                    </View>
                    <Text style={st.coverTitle}>Thêm ảnh bìa</Text>
                  </View>
                )}
              </TouchableOpacity>
              <Text style={st.coverHint}>Hãy update ảnh có tỉ lệ ngang khoảng 16:9.</Text>
            </View>
          )}

          {/* ── Step 2: Destinations ── */}
          {step === 2 && (
            <View style={st.stepBody}>
              <Text style={st.label}>Điểm đến</Text>

              {/* Map button */}
              <TouchableOpacity style={st.mapsBtn} onPress={() => setShowPlaces(true)}>
                <View style={st.mapsBtnIcon}>
                  <Ionicons name="map" size={22} color="#fff" />
                </View>
                <View style={{flex:1}}>
                  <Text style={st.mapsBtnTitle}>Tìm trên bản đồ</Text>
                  <Text style={st.mapsBtnSub}>
                    {Platform.OS === 'web'
                      ? 'Gõ tên → xem ngay trên bản đồ → chọn về app'
                      : 'Tìm kiếm và thêm địa điểm từ bản đồ'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#1B4F8A" />
              </TouchableOpacity>

              {/* Manual input */}
              <View style={st.searchRow}>
                <View style={st.searchWrap}>
                  <Ionicons name="location-outline" size={15} color="#9CA3AF" />
                  <TextInput style={st.searchInput} placeholder="Hoặc nhập tay tên địa điểm..."
                    placeholderTextColor="#C0C8D0" value={destInput} onChangeText={setDestInput}
                    returnKeyType="done" onSubmitEditing={() => { if(destInput.trim()) addDest(destInput.trim(), destInput.trim()); }} />
                </View>
                <TouchableOpacity style={st.addBtn} onPress={() => { if(destInput.trim()) addDest(destInput.trim(), destInput.trim()); }}>
                  <Text style={st.addBtnText}>Thêm</Text>
                </TouchableOpacity>
              </View>

              {/* Selected destinations */}
              {destinations.length > 0 && (
                <View style={{gap:8}}>
                  <Text style={st.subLabel}>Đã chọn ({destinations.length})</Text>
                  {destinations.map(d => (
                    <View key={d.name} style={st.destChip}>
                      <View style={st.destChipIcon}>
                        <Ionicons name="location" size={16} color="#1B4F8A" />
                      </View>
                      <View style={{flex:1}}>
                        <Text style={st.destChipName}>{d.name}</Text>
                        {d.address && d.address !== d.name && (
                          <Text style={st.destChipAddr} numberOfLines={1}>{d.address}</Text>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => removeDest(d.name)} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                        <Ionicons name="close-circle" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Popular picks */}
              <Text style={st.subLabel}>Gợi ý phổ biến</Text>
              <View style={st.quickGrid}>
                {SUGGESTED.map(d => {
                  const active = !!destinations.find(x => x.name === d);
                  return (
                    <TouchableOpacity key={d}
                      style={[st.quickChip, active && st.quickChipActive]}
                      onPress={() => active ? removeDest(d) : addDest(d, `${d}, Việt Nam`)}>
                      {active && <Ionicons name="checkmark" size={12} color="#1B4F8A" />}
                      <Text style={[st.quickChipText, active && st.quickChipTextActive]}>📍 {d}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Step 3: Members ── */}
          {step === 3 && (
            <View style={st.stepBody}>
              <Text style={st.label}>Thêm thành viên</Text>
              <TouchableOpacity style={[st.mapsBtn,{borderColor:'#A7F3D0',backgroundColor:'#ECFDF5'}]} onPress={() => setShowMembers(true)}>
                <View style={[st.mapsBtnIcon,{backgroundColor:'#10B981'}]}>
                  <Ionicons name="person-add" size={18} color="#fff" />
                </View>
                <View style={{flex:1}}>
                  <Text style={[st.mapsBtnTitle,{color:'#065F46'}]}>Tìm & thêm thành viên</Text>
                  <Text style={[st.mapsBtnSub,{color:'#6EE7B7'}]}>Tìm qua số điện thoại hoặc email</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#10B981" />
              </TouchableOpacity>

              {members.length > 0 ? (
                <View style={{gap:8}}>
                  <Text style={st.subLabel}>Danh sách mời ({members.length})</Text>
                  {members.map(m => (
                    <View key={m.phone} style={st.memberRow}>
                      <View style={st.memberAv}>
                        <Text style={st.memberAvText}>{(m.name||m.phone)[0].toUpperCase()}</Text>
                      </View>
                      <View style={{flex:1}}>
                        <Text style={{fontSize:14,fontWeight:'600',color:'#111'}}>{m.name||m.phone}</Text>
                        {m.name && <Text style={{fontSize:12,color:'#6B7280'}}>{m.phone}</Text>}
                      </View>
                      <TouchableOpacity onPress={() => setMembers(prev=>prev.filter(x=>x.phone!==m.phone))}
                        hitSlop={{top:8,bottom:8,left:8,right:8}}>
                        <Ionicons name="close-circle" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={st.emptyMems}>
                  <Ionicons name="people-outline" size={40} color="#D1D5DB" />
                  <Text style={{fontSize:13,color:'#9CA3AF',textAlign:'center'}}>Bạn có thể thêm thành viên sau khi tạo</Text>
                </View>
              )}

              <View style={st.inviteRow}>
                <Ionicons name="link-outline" size={16} color="#1B4F8A" />
                <Text style={st.inviteText} numberOfLines={1}>tripmate.app/invite/abc123</Text>
                <TouchableOpacity style={st.copyBtn}
                  onPress={async () => { await Clipboard.setStringAsync('tripmate.app/invite/abc123'); }}>
                  <Text style={st.copyBtnText}>Sao chép</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom bar */}
      <View style={st.bottomBar}>
        {step === 3 && (
          <TouchableOpacity style={st.skipBtn} onPress={() => doCreate(true)} disabled={loading}>
            <Text style={st.skipBtnText}>Bỏ qua, tạo ngay</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[st.nextBtn,loading&&{opacity:0.6}]} onPress={handleNext} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <>
                <Text style={st.nextBtnText}>{step < 3 ? 'Tiếp tục' : 'Tạo chuyến đi 🎉'}</Text>
                {step < 3 && <Ionicons name="arrow-forward" size={18} color="#fff" />}
              </>
          }
        </TouchableOpacity>
      </View>

      {/* Success modal */}
      <Modal visible={success} transparent animationType="fade">
        <View style={st.successOverlay}>
          <View style={st.successModal}>
            <Ionicons name="checkmark-circle" size={72} color="#10B981" />
            <Text style={st.successTitle}>Tạo thành công! 🎉</Text>
            <Text style={st.successDesc}>
              Chuyến đi <Text style={{fontWeight:'800',color:'#1B4F8A'}}>{basic.name}</Text> đã sẵn sàng!
            </Text>
            <View style={st.successInfo}>
              <Text style={st.successInfoRow}>📅 {basic.startDate} – {basic.endDate}</Text>
              <Text style={st.successInfoRow}>📍 {destinations.map(d=>d.name).join(', ')}</Text>
              <Text style={st.successInfoRow}>👥 {1+members.length} thành viên</Text>
            </View>
            <TouchableOpacity style={st.successBtn}
              onPress={() => { setSuccess(false); router.replace(`/trip/${createdTrip?.id}` as any); }}>
              <Text style={st.successBtnText}>Đến Trip Dashboard →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setSuccess(false); router.replace('/(tabs)/trips' as any); }}>
              <Text style={{fontSize:14,color:'#9CA3AF',textDecorationLine:'underline',marginTop:10}}>Xem danh sách</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modals */}
      <MapPickerModal
        visible={showPlaces}
        onClose={() => setShowPlaces(false)}
        onSelectPlace={addDest}
        initialQuery={destInput}
      />
      <MemberSearchModal
        visible={showMembers}
        onClose={() => setShowMembers(false)}
        onAdd={(phone, name) => setMembers(prev => [...prev, {phone, name}])}
        existingPhones={members.map(m=>m.phone)}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: {flex:1,backgroundColor:'#fff'},
  header: {flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:14,borderBottomWidth:1,borderBottomColor:'#F3F4F6'},
  iconBtn: {width:40,height:40,justifyContent:'center',alignItems:'center'},
  headerTitle: {fontSize:18,fontWeight:'700',color:'#111'},
  stepWrap: {flexDirection:'row',alignItems:'center',justifyContent:'center',paddingVertical:20,paddingHorizontal:24},
  stepItem: {alignItems:'center',gap:4},
  stepCircle: {width:36,height:36,borderRadius:18,justifyContent:'center',alignItems:'center'},
  stepActive: {backgroundColor:'#1B4F8A'},
  stepDone: {backgroundColor:'#10B981'},
  stepInactive: {backgroundColor:'#F3F4F6',borderWidth:1.5,borderColor:'#E5E7EB'},
  stepNum: {fontSize:14,fontWeight:'700'},
  stepLabel: {fontSize:11,color:'#9CA3AF',fontWeight:'500'},
  stepLine: {flex:1,height:2,backgroundColor:'#E5E7EB',marginBottom:14,marginHorizontal:4},
  stepLineDone: {backgroundColor:'#10B981'},
  content: {padding:20,paddingBottom:100},
  stepBody: {gap:16},
  label: {fontSize:14,fontWeight:'600',color:'#374151'},
  subLabel: {fontSize:13,fontWeight:'600',color:'#6B7280'},
  input: {borderWidth:1.5,borderColor:'#E5E7EB',borderRadius:12,paddingHorizontal:14,paddingVertical:13,fontSize:15,color:'#111',backgroundColor:'#F9FAFB'},
  coverUploadBtn: {borderWidth:1.5,borderColor:'#D1D5DB',borderRadius:16,overflow:'hidden',backgroundColor:'#F9FAFB'},
  coverPlaceholder: {height:180,justifyContent:'center',alignItems:'center',backgroundColor:'#F4F7FB',gap:8},
  coverIconWrap: {width:52,height:52,borderRadius:26,backgroundColor:'#E0ECFF',justifyContent:'center',alignItems:'center'},
  coverTitle: {fontSize:15,fontWeight:'700',color:'#1B4F8A'},
  coverHint: {fontSize:12,color:'#6B7280',marginTop:-4},
  coverImagePreview: {width:'100%',height:180},
  dateWrap: {flexDirection:'row',alignItems:'center',gap:8,borderWidth:1.5,borderColor:'#E5E7EB',borderRadius:12,paddingHorizontal:12,paddingVertical:12,backgroundColor:'#F9FAFB'},
  mapsBtn: {flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#F0F9FF',borderRadius:14,padding:14,borderWidth:1.5,borderColor:'#BFDBFE'},
  mapsBtnIcon: {width:44,height:44,borderRadius:22,backgroundColor:'#1B4F8A',justifyContent:'center',alignItems:'center'},
  mapsBtnTitle: {fontSize:15,fontWeight:'700',color:'#1B4F8A'},
  mapsBtnSub: {fontSize:12,color:'#64B5F6',marginTop:2},
  searchRow: {flexDirection:'row',gap:10,alignItems:'center'},
  searchWrap: {flex:1,flexDirection:'row',alignItems:'center',gap:8,borderWidth:1.5,borderColor:'#E5E7EB',borderRadius:12,paddingHorizontal:12,paddingVertical:12,backgroundColor:'#F9FAFB'},
  searchInput: {flex:1,fontSize:15,color:'#111'},
  addBtn: {backgroundColor:'#1B4F8A',borderRadius:12,paddingHorizontal:16,paddingVertical:14},
  addBtnText: {color:'#fff',fontWeight:'700',fontSize:14},
  destChip: {flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#EFF6FF',borderRadius:12,padding:12,borderWidth:1.5,borderColor:'#BFDBFE'},
  destChipIcon: {width:32,height:32,borderRadius:16,backgroundColor:'#DBEAFE',justifyContent:'center',alignItems:'center'},
  destChipName: {fontSize:14,fontWeight:'700',color:'#1D4ED8'},
  destChipAddr: {fontSize:11,color:'#93C5FD',marginTop:1},
  quickGrid: {flexDirection:'row',flexWrap:'wrap',gap:8},
  quickChip: {flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:12,paddingVertical:8,borderRadius:20,backgroundColor:'#F3F4F6',borderWidth:1.5,borderColor:'#E5E7EB'},
  quickChipActive: {backgroundColor:'#EFF6FF',borderColor:'#1B4F8A'},
  quickChipText: {fontSize:13,color:'#6B7280',fontWeight:'500'},
  quickChipTextActive: {color:'#1B4F8A',fontWeight:'700'},
  memberRow: {flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#F9FAFB',borderRadius:12,padding:12,borderWidth:1,borderColor:'#E5E7EB'},
  memberAv: {width:40,height:40,borderRadius:20,backgroundColor:'#1B4F8A',justifyContent:'center',alignItems:'center'},
  memberAvText: {color:'#fff',fontWeight:'700',fontSize:15},
  emptyMems: {alignItems:'center',paddingVertical:24,gap:10,backgroundColor:'#F9FAFB',borderRadius:12,borderWidth:1.5,borderColor:'#E5E7EB',borderStyle:'dashed'},
  inviteRow: {flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#F0F9FF',borderRadius:12,padding:14,borderWidth:1,borderColor:'#BAE6FD'},
  inviteText: {flex:1,fontSize:13,color:'#0369A1'},
  copyBtn: {backgroundColor:'#1B4F8A',borderRadius:8,paddingHorizontal:12,paddingVertical:6},
  copyBtnText: {color:'#fff',fontSize:12,fontWeight:'700'},
  bottomBar: {padding:16,borderTopWidth:1,borderTopColor:'#F3F4F6',backgroundColor:'#fff',gap:10},
  skipBtn: {alignItems:'center',paddingVertical:8},
  skipBtnText: {fontSize:14,color:'#9CA3AF',textDecorationLine:'underline'},
  nextBtn: {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#1B4F8A',borderRadius:14,paddingVertical:16,shadowColor:'#1B4F8A',shadowOpacity:0.3,shadowRadius:8,elevation:4},
  nextBtnText: {color:'#fff',fontSize:16,fontWeight:'700'},
  successOverlay: {flex:1,backgroundColor:'rgba(0,0,0,0.55)',justifyContent:'center',alignItems:'center',padding:24},
  successModal: {backgroundColor:'#fff',borderRadius:24,padding:28,alignItems:'center',width:'100%',gap:14},
  successTitle: {fontSize:26,fontWeight:'800',color:'#111'},
  successDesc: {fontSize:14,color:'#6B7280',textAlign:'center',lineHeight:20},
  successInfo: {backgroundColor:'#F9FAFB',borderRadius:14,padding:16,width:'100%',gap:8,borderWidth:1,borderColor:'#E5E7EB'},
  successInfoRow: {fontSize:14,color:'#374151'},
  successBtn: {backgroundColor:'#1B4F8A',borderRadius:14,paddingVertical:15,paddingHorizontal:24,width:'100%',alignItems:'center'},
  successBtnText: {color:'#fff',fontWeight:'700',fontSize:15},
});