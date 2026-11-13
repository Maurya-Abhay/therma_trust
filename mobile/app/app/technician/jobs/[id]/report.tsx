import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import axios from 'axios';
import { Check } from 'lucide-react-native';
import { createServiceReport, fetchCylinders, fetchRefrigerantTypes, uploadServiceReportPhoto } from '@/src/api/endpoints';
import { RefrigerantCylinder, RefrigerantType, ServiceReport } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { State, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthContext';
import { Outbox } from '@/src/offline/Outbox';
import { useOffline } from '@/src/offline/OfflineContext';
import { getApiErrorMessage } from '@/src/api/errorMessage';

const STEPS = ['Basics', 'Readings', 'Refrigerant', 'Safety', 'Photos', 'Review'];
const READINGS = [['suction_pressure', 'Suction pressure (PSI)'], ['discharge_pressure', 'Discharge pressure (PSI)'], ['suction_temp', 'Suction temp (°F)'], ['discharge_temp', 'Discharge temp (°F)'], ['superheat', 'Superheat (°F)'], ['subcooling', 'Subcooling (°F)'], ['amp_draw', 'Amp draw (A)'], ['voltage', 'Voltage (V)']];
const CHECKS = ['lockout_tagout_applied', 'pressure_relieved', 'ventilation_adequate', 'ppe_worn', 'refrigerant_handling_procedures', 'electrical_safety_verified'];
const RESULT_OPTIONS = [
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
  { value: 'not_applicable', label: 'Not applicable' },
];
type Photo = { uri: string; name: string; type: string; is_before: boolean };

function Choice<T extends { id: number }>({ label, items, value, text, onPick }: { label: string; items: T[]; value: number | null | undefined; text: (i: T) => string; onPick: (id: number) => void }) {
  const { t } = useTheme();
  return (
    <View style={{ marginTop: 6 }}>
      <Text style={{ color: t.sub, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {items.map((i) => (
          <Pressable key={i.id} onPress={() => onPick(i.id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: value === i.id ? t.primary : t.line, backgroundColor: value === i.id ? t.tint : 'transparent' }}>
            <Text style={{ color: value === i.id ? t.primary : t.text, fontWeight: '700', fontSize: 13 }}>{text(i)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ResultChoice({ label, value, onPick }: { label: string; value: string; onPick: (value: string) => void }) {
  const { t } = useTheme();
  return (
    <View style={{ marginTop: 6 }}>
      <Text style={{ color: t.sub, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {RESULT_OPTIONS.map((option) => {
          const active = value === option.value;
          return (
            <Pressable key={option.value} onPress={() => onPick(option.value)} style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: active ? t.primary : t.line, backgroundColor: active ? t.tint : 'transparent' }}>
              <Text style={{ color: active ? t.primary : t.text, fontWeight: '700', fontSize: 12 }}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function isUnreachable(error: unknown) {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === undefined || status === 502 || status === 503 || status === 504;
}

async function persistPhotos(jobId: number, photos: Photo[]) {
  if (!photos.length) return [];
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) throw new Error('Device storage is unavailable for saving offline photos.');

  const directory = `${documentDirectory}offline-reports/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  return Promise.all(photos.map(async (photo, index) => {
    const safeName = photo.name.replace(/[^\w.-]/g, '_');
    const destination = `${directory}job-${jobId}-${Date.now()}-${index}-${safeName}`;
    await FileSystem.copyAsync({ from: photo.uri, to: destination });
    return { ...photo, uri: destination };
  }));
}

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = parseInt(id ?? '0', 10);
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { t } = useTheme();
  const { isOnline, pendingCount, refreshPendingCount } = useOffline();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const typesQuery = useQuery({ queryKey: ['refrigerant-types'], queryFn: fetchRefrigerantTypes });
  const cylindersQuery = useQuery({ queryKey: ['cylinders'], queryFn: fetchCylinders });
  const types: RefrigerantType[] = typesQuery.data ?? [];
  const cyls: RefrigerantCylinder[] = cylindersQuery.data ?? [];
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [f, setF] = useState<Partial<ServiceReport>>({
    job: jobId, fault_description: '', diagnostic_readings: {}, refrigerant_type: 0, refrigerant_code: '',
    refrigerant_added_kg: '0', refrigerant_recovered_kg: '0', added_from_cylinder: null, recovered_into_cylinder: null,
    leak_test_result: 'pass', vacuum_result: 'pass', parts_replaced: '', safety_checklist: {}, summary: '',
  });
  const set = (k: keyof ServiceReport, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  const pick = async (is_before: boolean) => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled && r.assets[0]) {
      const asset = r.assets[0];
      setPhotos((p) => [...p, {
        uri: asset.uri,
        name: asset.fileName || `service-photo-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
        is_before,
      }]);
    }
  };

  const submit = async () => {
    if (!f.fault_description?.trim()) return Alert.alert('Missing details', 'Fault description is required.');
    if (!f.refrigerant_type) return Alert.alert('Missing refrigerant', 'Please select the refrigerant type.');
    if (!f.summary?.trim()) return Alert.alert('Missing summary', 'A report summary is required.');
    setBusy(true);
    try {
      let report: ServiceReport | undefined;
      let uploadedPhotoCount = 0;
      let queued = false;
      const queueReport = async () => {
        if (!user?.id) throw new Error('You must be signed in to save an offline report.');
        const savedPhotos = await persistPhotos(jobId, photos);
        Outbox.enqueue('createServiceReport', {
          report: f,
          photos: savedPhotos,
          reportId: report?.id,
          uploadedPhotoCount,
        }, user.id);
        await refreshPendingCount();
        queued = true;
      };

      if (isOnline) {
        try {
          report = await createServiceReport(f);
          for (const photo of photos) {
            await uploadServiceReportPhoto(report.id, photo, '', photo.is_before);
            uploadedPhotoCount += 1;
          }
        } catch (error) {
          if (!isUnreachable(error)) throw error;
          await queueReport();
        }
      } else {
        await queueReport();
      }

      qc.invalidateQueries({ queryKey: ['technician-jobs'] });
      qc.invalidateQueries({ queryKey: ['job', jobId] });
      qc.invalidateQueries({ queryKey: ['service-reports', jobId] });
      if (queued) {
        Alert.alert('Saved offline', 'Your service report is saved on this device and will sync when the server is reachable.');
      } else {
        Alert.alert('Submitted', 'Service report submitted.');
      }
      router.back();
    } catch (error) {
      Alert.alert('Error', getApiErrorMessage(error, 'Failed to submit report.'));
    } finally {
      setBusy(false);
    }
  };

  const supply = cyls.filter((c) => c.kind === 'supply');
  const recovery = cyls.filter((c) => c.kind === 'recovery');
  const last = step === STEPS.length - 1;

  return (
    <ScreenContainer headerTitle="Service report" showProfile={false}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
        {!isOnline ? <Text style={{ color: t.warn, fontSize: 12, fontWeight: '700', marginBottom: 10 }}>Offline mode: your report will be queued on this device.</Text> : null}
        {pendingCount > 0 ? <Text style={{ color: t.sub, fontSize: 11, marginBottom: 10 }}>{pendingCount} item{pendingCount === 1 ? '' : 's'} waiting to sync.</Text> : null}
        <Text style={{ color: t.sub, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>Job #{jobId} · {STEPS[step]} ({step + 1}/{STEPS.length})</Text>
        <View style={{ flexDirection: 'row', gap: 4, marginBottom: 14 }}>
          {STEPS.map((s, i) => <View key={s} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i <= step ? t.primary : t.line }} />)}
        </View>
        <Surface style={{ gap: 12 }}>
          {step === 0 && (<>
            <Input label="Fault description *" multiline numberOfLines={4} value={f.fault_description} onChangeText={(v) => set('fault_description', v)} placeholder="Describe the fault found" />
            <Input label="Parts replaced" value={f.parts_replaced} onChangeText={(v) => set('parts_replaced', v)} />
            <ResultChoice label="Leak test result" value={f.leak_test_result || 'pass'} onPick={(v) => set('leak_test_result', v)} />
            <ResultChoice label="Vacuum result" value={f.vacuum_result || 'pass'} onPick={(v) => set('vacuum_result', v)} />
            <Input label="Summary" multiline numberOfLines={3} value={f.summary} onChangeText={(v) => set('summary', v)} />
          </>)}
          {step === 1 && READINGS.map(([k, label]) => (
            <Input key={k} label={label} keyboardType="numeric" value={String(f.diagnostic_readings?.[k] ?? '')} onChangeText={(v) => set('diagnostic_readings', { ...f.diagnostic_readings, [k]: v })} />
          ))}
          {step === 2 && (<>
            {typesQuery.isLoading ? <State loading /> : typesQuery.isError ? (
              <State error onRetry={() => { void typesQuery.refetch(); }} />
            ) : (
              <Choice label="Refrigerant type *" items={types} value={f.refrigerant_type} text={(r) => r.code} onPick={(v) => { set('refrigerant_type', v); set('refrigerant_code', types.find((r) => r.id === v)?.code ?? ''); }} />
            )}
            {cylindersQuery.isError ? <Text style={{ color: t.bad, fontSize: 11 }}>Cylinder records could not be loaded. You can still submit without linking a cylinder.</Text> : null}
            <Input label="Added (kg)" keyboardType="decimal-pad" value={f.refrigerant_added_kg} onChangeText={(v) => set('refrigerant_added_kg', v)} />
            {parseFloat(f.refrigerant_added_kg || '0') > 0 && <Choice label="Supply cylinder" items={supply} value={f.added_from_cylinder} text={(c) => c.serial_number} onPick={(v) => set('added_from_cylinder', v)} />}
            <Input label="Recovered (kg)" keyboardType="decimal-pad" value={f.refrigerant_recovered_kg} onChangeText={(v) => set('refrigerant_recovered_kg', v)} />
            {parseFloat(f.refrigerant_recovered_kg || '0') > 0 && <Choice label="Recovery cylinder" items={recovery} value={f.recovered_into_cylinder} text={(c) => c.serial_number} onPick={(v) => set('recovered_into_cylinder', v)} />}
          </>)}
          {step === 3 && CHECKS.map((c) => {
            const on = !!f.safety_checklist?.[c];
            return (
              <Pressable key={c} onPress={() => set('safety_checklist', { ...f.safety_checklist, [c]: !on })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: on ? t.primary : t.line, backgroundColor: on ? t.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <Check size={15} color="#FFFFFF" /> : null}
                </View>
                <Text style={{ color: t.text, fontSize: 14, textTransform: 'capitalize', flex: 1 }}>{c.replace(/_/g, ' ')}</Text>
              </Pressable>
            );
          })}
          {step === 4 && ([true, false] as const).map((before) => (
            <View key={String(before)}>
              <Text style={{ color: t.text, fontWeight: '800', marginBottom: 8 }}>{before ? 'Before' : 'After'} photos</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {photos.filter((p) => p.is_before === before).map((p, i) => <Image key={i} source={{ uri: p.uri }} style={{ width: 84, height: 84, borderRadius: 14 }} />)}
                <Pressable onPress={() => pick(before)} style={{ width: 84, height: 84, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: t.primary, fontSize: 26 }}>+</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {step === 5 && (
            <View style={{ gap: 8 }}>
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '800' }}>Review your report</Text>
              <Text style={{ color: t.sub, fontSize: 12 }}>Fault: {f.fault_description?.trim() || 'Not provided'}</Text>
              <Text style={{ color: t.sub, fontSize: 12 }}>Summary: {f.summary?.trim() || 'Not provided'}</Text>
              <Text style={{ color: t.sub, fontSize: 12 }}>Refrigerant: {f.refrigerant_code || 'Not selected'}</Text>
              <Text style={{ color: t.sub, fontSize: 12 }}>Evidence photos: {photos.length}</Text>
              <Text style={{ color: t.sub, fontSize: 11, lineHeight: 16, marginTop: 4 }}>
                Submitting records this report against the assigned job.
              </Text>
            </View>
          )}
        </Surface>
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 10, paddingTop: 10 }}>
        {step > 0 && <Button style={{ flex: 1 }} variant="outline" onPress={() => setStep(step - 1)}>Back</Button>}
        <Button style={{ flex: 2 }} loading={busy} onPress={last ? submit : () => setStep(step + 1)}>{last ? 'Submit report' : 'Next'}</Button>
      </View>
    </ScreenContainer>
  );
}
