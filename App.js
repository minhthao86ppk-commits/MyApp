import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, Alert, StatusBar } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Thiết lập thông báo hiển thị cả khi app đang mở
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// --- THUẬT TOÁN TÍNH LỊCH ÂM VIỆT NAM ---
function INT(d) { return Math.floor(d); }
function jdFromDate(dd, mm, yy) {
  let a = INT((14 - mm) / 12);
  let y = yy + 4800 - a;
  let m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  return jd;
}
function getNewMoonDay(k, timeZone) {
  let T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = Math.PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  let M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  let Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  let F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(2 * dr * Mpr) - 0.0004 * Math.sin(3 * dr * Mpr);
  C1 = C1 + 0.0104 * Math.sin(2 * dr * F) - 0.0051 * Math.sin((M + Mpr) * dr) - 0.0074 * Math.sin((M - Mpr) * dr);
  let deltat = (T < -4) ? 0 : (102.3 + 123.5 * T + 32.5 * T2) / 86400;
  return INT(Jd1 + C1 - deltat + 0.5 + timeZone / 24);
}
function getSunLongitude(dayNumber, timeZone) {
  let T = (dayNumber - 2451545.0 + 0.5 - timeZone / 24) / 36525;
  let dr = Math.PI / 180;
  let L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T * T;
  let M = 357.52910 + 35999.05030 * T - 0.0001559 * T * T;
  let C = (1.914600 - 0.004817 * T) * Math.sin(M * dr) + 0.019993 * Math.sin(2 * M * dr);
  let theta = (L0 + C) * dr;
  theta = theta - Math.PI * 2 * INT(theta / (Math.PI * 2));
  return INT(theta / (Math.PI / 6));
}
function getLunarMonth11(yy, timeZone) {
  let off = jdFromDate(31, 12, yy) - 2415021;
  let k = INT(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  if (getSunLongitude(nm, timeZone) >= 9) nm = getNewMoonDay(k - 1, timeZone);
  return nm;
}
function getLeapMonthOffset(a11, timeZone) {
  let k = INT((a11 - 2415021.0769986) / 29.530588853 + 0.5);
  let last = 0, i = 1, arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}
function convertSolar2Lunar(dd, mm, yy, timeZone = 7) {
  let dayNumber = jdFromDate(dd, mm, yy);
  let k = INT((dayNumber - 2415021.0769986) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) monthStart = getNewMoonDay(k, timeZone);
  let a11 = getLunarMonth11(yy, timeZone);
  let b11 = a11, lunarYear = yy;
  if (a11 >= monthStart) {
    lunarYear = yy - 1;
    a11 = getLunarMonth11(yy - 1, timeZone);
  } else {
    b11 = getLunarMonth11(yy + 1, timeZone);
  }
  let lunarDay = dayNumber - monthStart + 1;
  let diff = INT((monthStart - a11) / 29);
  let lunarLeap = false, lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    let leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) lunarLeap = true;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear = yy - 1;
  return { day: lunarDay, month: lunarMonth, year: lunarYear, isLeap: lunarLeap };
}

const CAN = ["Canh", "Tân", "Nhâm", "Quý", "Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ"];
const CHI = ["Thân", "Dậu", "Tuất", "Hợi", "Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi"];
const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export default function App() {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [schedule, setSchedule] = useState({});

  useEffect(() => {
    loadSavedSchedule();
    requestNotificationPermission();
  }, []);

  const requestNotificationPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Lưu ý', 'Vui lòng cấp quyền thông báo để nhận lời nhắc lúc 05:00 sáng.');
    }
  };

  const loadSavedSchedule = async () => {
    try {
      const data = await AsyncStorage.getItem('@teaching_schedule');
      if (data) setSchedule(JSON.parse(data));
    } catch (e) {
      console.error(e);
    }
  };

  // Tự động lên lịch thông báo 05:00 sáng cho các ngày có lịch dạy
  const scheduleDailyNotifications = async (scheduleData) => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = new Date();

    for (const [dateStr, info] of Object.entries(scheduleData)) {
      const [d, m, y] = dateStr.split('/').map(Number);
      const targetDate = new Date(y, m - 1, d, 5, 0, 0); // 05:00:00 sáng

      if (targetDate > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⏰ Nhắc Lịch Giảng Dạy Hôm Nay',
            body: `Hôm nay (${dateStr}) bạn có ${info.periods}. ${info.note ? `Chi tiết: ${info.note}` : ''}`,
            sound: true,
          },
          trigger: targetDate,
        });
      }
    }
  };

  // Tải và đọc file .txt
  const pickAndParseTxtFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'text/plain',
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const fileUri = res.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri);

      // Phân tích cú pháp từng dòng
      const lines = content.split('\n');
      const newSchedule = {};

      lines.forEach((line) => {
        const clean = line.trim();
        if (!clean) return;
        // Hỗ trợ định dạng DD/MM/YYYY: X tiết hoặc YYYY-MM-DD
        const match = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*[:\-]\s*(.+)$/);
        if (match) {
          const day = parseInt(match[1], 10);
          const month = parseInt(match[2], 10);
          const year = parseInt(match[3], 10);
          const key = `${day}/${month}/${year}`;
          newSchedule[key] = {
            periods: match[4].trim(),
            note: '',
          };
        }
      });

      setSchedule(newSchedule);
      await AsyncStorage.setItem('@teaching_schedule', JSON.stringify(newSchedule));
      await scheduleDailyNotifications(newSchedule);

      Alert.alert('Thành Công', `Đã cập nhật ${Object.keys(newSchedule).length} ngày giảng dạy và cài đặt báo thức 05:00 sáng!`);
    } catch (err) {
      Alert.alert('Lỗi', 'Không thể đọc file .txt. Vui lòng kiểm tra lại định dạng file.');
    }
  };

  const sDay = selectedDate.getDate();
  const sMonth = selectedDate.getMonth() + 1;
  const sYear = selectedDate.getFullYear();
  const selectedKey = `${sDay}/${sMonth}/${sYear}`;
  const currentTeaching = schedule[selectedKey];

  const lunar = convertSolar2Lunar(sDay, sMonth, sYear);
  const canChiYear = `${CAN[lunar.year % 10]} ${CHI[lunar.year % 12]}`;

  const currentViewMonth = viewDate.getMonth() + 1;
  const currentViewYear = viewDate.getFullYear();
  const daysInMonth = new Date(currentViewYear, currentViewMonth, 0).getDate();
  const firstDayIndex = new Date(currentViewYear, currentViewMonth - 1, 1).getDay();

  const changeMonth = (offset) => {
    setViewDate(new Date(currentViewYear, viewDate.getMonth() + offset, 1));
  };

  const renderCalendarGrid = () => {
    const totalCells = [];
    for (let i = 0; i < firstDayIndex; i++) {
      totalCells.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const l = convertSolar2Lunar(d, currentViewMonth, currentViewYear);
      const isSelected = d === sDay && currentViewMonth === sMonth && currentViewYear === sYear;
      const isToday = d === today.getDate() && currentViewMonth === (today.getMonth() + 1) && currentViewYear === today.getFullYear();
      const hasTeaching = !!schedule[`${d}/${currentViewMonth}/${currentViewYear}`];

      totalCells.push(
        <TouchableOpacity
          key={`day-${d}`}
          style={[styles.dayCell, isSelected && styles.selectedCell, isToday && !isSelected && styles.todayCell]}
          onPress={() => setSelectedDate(new Date(currentViewYear, currentViewMonth - 1, d))}
        >
          <Text style={[styles.solarDayText, isSelected && styles.selectedText]}>{d}</Text>
          <Text style={[styles.lunarDayText, isSelected && styles.selectedSubText]}>
            {l.day === 1 ? `${l.day}/${l.month}` : l.day}
          </Text>
          {hasTeaching && <View style={[styles.teachingDot, isSelected && { backgroundColor: '#8B0000' }]} />}
        </TouchableOpacity>
      );
    }
    return totalCells;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll}>
        
        {/* NÚT TẢI FILE TXT */}
        <TouchableOpacity style={styles.uploadButton} onPress={pickAndParseTxtFile}>
          <Text style={styles.uploadButtonText}>📂 Tải lên file lịch giảng (.txt)</Text>
        </TouchableOpacity>

        {/* THẺ NGÀY ĐANG CHỌN */}
        <View style={styles.heroCard}>
          <Text style={styles.weekdayText}>{WEEKDAYS[selectedDate.getDay()]}</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroBlock}>
              <Text style={styles.heroNumber}>{sDay}</Text>
              <Text style={styles.heroLabel}>Tháng {sMonth}, {sYear}</Text>
              <Text style={styles.tagSolar}>DƯƠNG LỊCH</Text>
            </View>
            <View style={styles.verticalLine} />
            <View style={styles.heroBlock}>
              <Text style={[styles.heroNumber, { color: '#FFD700' }]}>{lunar.day}</Text>
              <Text style={styles.heroLabel}>Tháng {lunar.month}{lunar.isLeap ? ' (Nhuận)' : ''}</Text>
              <Text style={styles.tagLunar}>Năm {canChiYear}</Text>
            </View>
          </View>

          {/* CHI TIẾT TIẾT GIẢNG TRONG NGÀY */}
          <View style={styles.scheduleInfoBox}>
            <Text style={styles.scheduleInfoTitle}>📚 Lịch giảng dạy:</Text>
            <Text style={styles.scheduleInfoContent}>
              {currentTeaching ? `Có ${currentTeaching.periods} (Báo thức 05:00 sáng)` : 'Không có tiết giảng'}
            </Text>
          </View>
        </View>

        {/* BẢNG LỊCH */}
        <View style={styles.calendarContainer}>
          <View style={styles.monthHeader}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navBtn}>
              <Text style={styles.navBtnText}>{'◀'}</Text>
            </TouchableOpacity>
            <Text style={styles.monthTitle}>Tháng {currentViewMonth} / {currentViewYear}</Text>
            <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navBtn}>
              <Text style={styles.navBtnText}>{'▶'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekHeader}>
            {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((w, idx) => (
              <Text key={w} style={[styles.weekHeaderText, idx === 0 && { color: '#E63946' }]}>{w}</Text>
            ))}
          </View>

          <View style={styles.grid}>{renderCalendarGrid()}</View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A24' },
  scroll: { padding: 16, alignItems: 'center' },
  uploadButton: {
    width: '100%',
    backgroundColor: '#2E7D32',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 14,
    elevation: 3,
  },
  uploadButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  heroCard: {
    width: '100%',
    backgroundColor: '#8B0000',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  weekdayText: { fontSize: 16, color: '#FFD700', fontWeight: 'bold', marginBottom: 8 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', alignItems: 'center' },
  heroBlock: { alignItems: 'center' },
  heroNumber: { fontSize: 46, fontWeight: '900', color: '#FFFFFF' },
  heroLabel: { fontSize: 13, color: '#F0F0F0', marginTop: 2 },
  tagSolar: { marginTop: 4, fontSize: 10, color: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  tagLunar: { marginTop: 4, fontSize: 10, color: '#1A1A24', backgroundColor: '#FFD700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, fontWeight: 'bold' },
  verticalLine: { width: 1, height: 60, backgroundColor: 'rgba(255,255,255,0.2)' },
  scheduleInfoBox: {
    marginTop: 14,
    backgroundColor: 'rgba(0,0,0,0.25)',
    width: '100%',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  scheduleInfoTitle: { color: '#FFD700', fontSize: 13, fontWeight: 'bold' },
  scheduleInfoContent: { color: '#FFFFFF', fontSize: 14, marginTop: 2, fontWeight: '600' },
  calendarContainer: { width: '100%', backgroundColor: '#242432', borderRadius: 20, padding: 16 },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  monthTitle: { fontSize: 17, fontWeight: 'bold', color: '#FFFFFF' },
  navBtn: { padding: 6, backgroundColor: '#323244', borderRadius: 8 },
  navBtnText: { color: '#FFD700', fontSize: 13 },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  weekHeaderText: { width: '14.2%', textAlign: 'center', color: '#8E8E93', fontWeight: 'bold', fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.2%', height: 50, justifyContent: 'center', alignItems: 'center', marginVertical: 2, borderRadius: 8 },
  selectedCell: { backgroundColor: '#FFD700' },
  todayCell: { borderWidth: 1, borderColor: '#E63946' },
  solarDayText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  lunarDayText: { fontSize: 9, color: '#8E8E93' },
  selectedText: { color: '#000000' },
  selectedSubText: { color: '#333333', fontWeight: 'bold' },
  teachingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00E676', marginTop: 2 },
});
