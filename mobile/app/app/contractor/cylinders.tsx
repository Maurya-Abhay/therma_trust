import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ChevronRight, Plus, X } from 'lucide-react-native';
import {
  createCylinder,
  fetchContractors,
  fetchCylinders,
  fetchCylinderHistory,
  fetchRefrigerantTypes,
} from '@/src/api/endpoints';
import { RefrigerantCylinder, RefrigerantType } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Card, CardHeader } from '@/src/components/ui/Card';
import { Chip } from '@/src/components/ui/Chip';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Palette, useTheme } from '@/src/theme/ThemeProvider';

export default function CylindersScreen() {
  const params = useLocalSearchParams<{ add?: string }>();
  const queryClient = useQueryClient();
  const { t } = useTheme();
  const styles = useCylinderStyles();
  const [refreshing, setRefreshing] = React.useState(false);
  const [showCreate, setShowCreate] = React.useState(false);
  const [selectedCylinder, setSelectedCylinder] = React.useState<RefrigerantCylinder | null>(null);

  const { data: companies = [], isLoading: companiesLoading, isError: companiesError, refetch: refetchCompanies } = useQuery({
    queryKey: ['my-contractor-company'],
    queryFn: fetchContractors,
    staleTime: 60_000,
  });
  const companyId = companies[0]?.id;

  React.useEffect(() => {
    if (companyId && params.add === '1') setShowCreate(true);
  }, [companyId, params.add]);

  const {
    data: cylinders = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['contractor-cylinders', companyId],
    queryFn: fetchCylinders,
    enabled: Boolean(companyId),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: createCylinder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractor-cylinders', companyId] });
      setShowCreate(false);
      Alert.alert('Cylinder added', 'The cylinder has been added to your company inventory.');
    },
    onError: (error: any) => {
      Alert.alert('Could not add cylinder', error.response?.data?.detail || 'Please check the details and try again.');
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ['my-contractor-company'] })]);
    } finally {
      setRefreshing(false);
    }
  };

  const supplyCylinders = cylinders.filter((item) => item.kind === 'supply');
  const recoveryCylinders = cylinders.filter((item) => item.kind === 'recovery');

  const renderCylinder = (item: RefrigerantCylinder) => {
    const capacity = Number(item.capacity_kg) || 0;
    const current = Number(item.current_kg) || 0;
    const fill = capacity > 0 ? Math.max(0, Math.min(100, (current / capacity) * 100)) : 0;

    return (
      <TouchableOpacity
        key={item.id}
        activeOpacity={0.78}
        onPress={() => setSelectedCylinder(item)}
        style={styles.cylinderCard}
        accessibilityRole="button"
        accessibilityLabel={`Cylinder ${item.serial_number}, ${item.kind}`}
      >
        <View style={styles.cylinderTop}>
          <View style={styles.cylinderBadges}>
            <Chip variant={item.kind === 'supply' ? 'info' : 'warning'} size="sm">{item.kind}</Chip>
            <Chip variant="default" size="sm">{item.refrigerant_type_code}</Chip>
          </View>
          <ChevronRight size={17} color={t.sub} />
        </View>
        <Text style={styles.cylinderSerial}>Serial · {item.serial_number}</Text>
        <View style={styles.cylinderLevels}>
          <View style={styles.level}>
            <Text style={styles.levelLabel}>Current fill</Text>
            <Text style={styles.levelValue}>{current.toFixed(1)} <Text style={styles.unit}>kg</Text></Text>
          </View>
          <View style={styles.levelRight}>
            <Text style={styles.levelLabel}>Capacity</Text>
            <Text style={styles.levelValue}>{capacity.toFixed(1)} <Text style={styles.unit}>kg</Text></Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${fill}%` }]} />
        </View>
        <Text style={styles.fillCaption}>{fill.toFixed(0)}% filled</Text>
      </TouchableOpacity>
    );
  };

  if (companiesLoading || (isLoading && Boolean(companyId))) {
    return (
      <ScreenContainer headerTitle="Refrigerant inventory" headerSubtitle="Supply and recovery cylinders">
        <View style={styles.stateWrap}><ActivityIndicator color={t.primary} /><Text style={styles.stateText}>Loading inventory…</Text></View>
      </ScreenContainer>
    );
  }

  if (companiesError) {
    return (
      <ScreenContainer headerTitle="Refrigerant inventory" headerSubtitle="Supply and recovery cylinders">
        <Card style={styles.stateCard}>
          <Text style={styles.stateTitle}>Company information unavailable</Text>
          <Text style={styles.stateText}>Check your connection and try again.</Text>
          <Button variant="outline" size="sm" onPress={() => { void refetchCompanies(); }}>Try again</Button>
        </Card>
      </ScreenContainer>
    );
  }

  if (!companyId) {
    return (
      <ScreenContainer headerTitle="Refrigerant inventory" headerSubtitle="Supply and recovery cylinders">
        <Card style={styles.stateCard}>
          <Text style={styles.stateTitle}>No company linked</Text>
          <Text style={styles.stateText}>A contractor company must be linked to your account before you can manage its cylinders.</Text>
        </Card>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer headerTitle="Refrigerant inventory" headerSubtitle={`${cylinders.length} cylinders in your company`}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
      >
        <View style={styles.summaryRow}>
          <Summary value={supplyCylinders.length} label="Supply" />
          <Summary value={recoveryCylinders.length} label="Recovery" />
          <Summary value={cylinders.length} label="Total" />
        </View>

        <View style={styles.actionRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionEyebrow}>INVENTORY</Text>
            <Text style={styles.sectionTitle}>Cylinder stock</Text>
          </View>
          <Button size="sm" leftIcon={<Plus size={16} color="#FFFFFF" />} onPress={() => setShowCreate(true)}>Add cylinder</Button>
        </View>

        {isError ? (
          <Card style={styles.stateCard}>
            <Text style={styles.stateTitle}>Inventory unavailable</Text>
            <Text style={styles.stateText}>Check your connection and try again.</Text>
            <Button variant="outline" size="sm" onPress={() => refetch()}>Try again</Button>
          </Card>
        ) : (
          <>
            <Card style={styles.sectionCard}>
              <CardHeader title="Supply cylinders" subtitle="Available refrigerant stock" />
              {supplyCylinders.length ? supplyCylinders.map(renderCylinder) : <EmptySection label="No supply cylinders have been added." />}
            </Card>
            <Card style={styles.sectionCard}>
              <CardHeader title="Recovery cylinders" subtitle="Recovered refrigerant stock" />
              {recoveryCylinders.length ? recoveryCylinders.map(renderCylinder) : <EmptySection label="No recovery cylinders have been added." />}
            </Card>
          </>
        )}
      </ScrollView>

      <CreateCylinderModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        companyId={companyId}
        onCreate={createMutation.mutate}
        loading={createMutation.isPending}
      />
      <CylinderDetailModal cylinder={selectedCylinder} onClose={() => setSelectedCylinder(null)} />
    </ScreenContainer>
  );
}

function Summary({ value, label }: { value: number; label: string }) {
  const styles = useCylinderStyles();
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function EmptySection({ label }: { label: string }) {
  const styles = useCylinderStyles();
  return <View style={styles.emptySection}><Text style={styles.stateText}>{label}</Text></View>;
}

interface CreateCylinderModalProps {
  visible: boolean;
  onClose: () => void;
  companyId: number;
  onCreate: (data: Parameters<typeof createCylinder>[0]) => void;
  loading: boolean;
}

function CreateCylinderModal({ visible, onClose, companyId, onCreate, loading }: CreateCylinderModalProps) {
  const { t } = useTheme();
  const styles = useCylinderStyles();
  const [form, setForm] = React.useState({
    serial_number: '',
    refrigerant_type: null as number | null,
    kind: 'supply' as 'supply' | 'recovery',
    capacity_kg: '',
    current_kg: '',
  });
  const [error, setError] = React.useState('');
  const { data: refrigerantTypes = [], isLoading: typesLoading, isError: typesError } = useQuery({
    queryKey: ['refrigerant-types'],
    queryFn: fetchRefrigerantTypes,
    enabled: visible,
    staleTime: 300_000,
  });

  React.useEffect(() => {
    if (visible) {
      setForm({ serial_number: '', refrigerant_type: null, kind: 'supply', capacity_kg: '', current_kg: '' });
      setError('');
    }
  }, [visible]);

  const handleSubmit = () => {
    const refrigerantType = form.refrigerant_type;
    const capacity = Number(form.capacity_kg);
    const current = Number(form.current_kg);
    if (!form.serial_number.trim() || !refrigerantType || !Number.isInteger(refrigerantType) || refrigerantType <= 0 || !Number.isFinite(capacity) || capacity <= 0 || !Number.isFinite(current) || current < 0 || current > capacity) {
      setError('Enter a serial number, select a refrigerant type and enter valid capacity/current amounts. Current fill cannot exceed capacity.');
      return;
    }
    onCreate({
      company: companyId,
      serial_number: form.serial_number.trim(),
      refrigerant_type: refrigerantType,
      kind: form.kind,
      capacity_kg: String(capacity),
      current_kg: String(current),
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalOverlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Add cylinder</Text>
              <Text style={styles.modalSubtitle}>Register a cylinder in company inventory.</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close">
              <X size={19} color={t.sub} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Input label="Serial number" placeholder="e.g. TT-CYL-001" value={form.serial_number} onChangeText={(value) => setForm((prev) => ({ ...prev, serial_number: value }))} />
            <Text style={styles.inputLabel}>Cylinder type</Text>
            <View style={styles.kindSelector}>
              {(['supply', 'recovery'] as const).map((kind) => (
                <TouchableOpacity key={kind} onPress={() => setForm((prev) => ({ ...prev, kind }))} style={[styles.kindOption, form.kind === kind && styles.kindOptionActive]}>
                  <Text style={[styles.kindOptionText, form.kind === kind && styles.kindOptionTextActive]}>{kind === 'supply' ? 'Supply' : 'Recovery'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.typeField}>
              <Text style={styles.inputLabel}>Refrigerant type</Text>
              {typesLoading ? <ActivityIndicator color={t.primary} /> : typesError ? <Text style={styles.formError}>Refrigerant types could not be loaded. Try again later.</Text> : refrigerantTypes.length === 0 ? <Text style={styles.stateText}>No refrigerant types are configured for this account.</Text> : (
                <View style={styles.typeGrid}>
                  {refrigerantTypes.map((type: RefrigerantType) => (
                    <TouchableOpacity key={type.id} onPress={() => setForm((prev) => ({ ...prev, refrigerant_type: type.id }))} style={[styles.typeOption, form.refrigerant_type === type.id && styles.typeOptionActive]}>
                      <Text style={[styles.typeCode, form.refrigerant_type === type.id && styles.kindOptionTextActive]}>{type.code}</Text>
                      <Text numberOfLines={1} style={styles.typeName}>{type.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <Input label="Capacity (kg)" placeholder="e.g. 12.5" keyboardType="decimal-pad" value={form.capacity_kg} onChangeText={(value) => setForm((prev) => ({ ...prev, capacity_kg: value }))} />
            <Input label="Current fill (kg)" placeholder="e.g. 8.0" keyboardType="decimal-pad" value={form.current_kg} onChangeText={(value) => setForm((prev) => ({ ...prev, current_kg: value }))} />
            {!!error && <Text style={styles.formError}>{error}</Text>}
            <View style={styles.modalActions}>
              <Button variant="outline" onPress={onClose} style={{ flex: 1 }}>Cancel</Button>
              <Button onPress={handleSubmit} loading={loading} style={{ flex: 1 }}>Save cylinder</Button>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function CylinderDetailModal({ cylinder, onClose }: { cylinder: RefrigerantCylinder | null; onClose: () => void }) {
  const { t } = useTheme();
  const styles = useCylinderStyles();
  const { data: history = [], isLoading, isError } = useQuery({
    queryKey: ['cylinder-history', cylinder?.id],
    queryFn: () => fetchCylinderHistory(cylinder!.id),
    enabled: Boolean(cylinder),
  });

  return (
    <Modal visible={Boolean(cylinder)} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalOverlay}>
        <View style={styles.modal}>
          {cylinder ? (
            <>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Cylinder details</Text>
                  <Text style={styles.modalSubtitle}>{cylinder.serial_number}</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close">
                  <X size={19} color={t.sub} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.modalContent}>
                <View style={styles.detailGrid}>
                  <Detail label="Type" value={cylinder.kind} />
                  <Detail label="Refrigerant" value={cylinder.refrigerant_type_code} />
                  <Detail label="Capacity" value={`${cylinder.capacity_kg} kg`} />
                  <Detail label="Current fill" value={`${cylinder.current_kg} kg`} />
                </View>
                <Text style={styles.historyTitle}>Transaction history</Text>
                {isLoading ? <ActivityIndicator color={t.primary} /> : isError ? <Text style={styles.stateText}>History could not be loaded.</Text> : history.length === 0 ? <EmptySection label="No transactions recorded yet." /> : history.map((item) => (
                  <View key={item.id} style={styles.historyItem}>
                    <View style={styles.historyTop}>
                      <Chip variant={item.kind === 'initial_fill' ? 'info' : item.kind === 'draw' ? 'warning' : 'success'} size="xs">{item.kind}</Chip>
                      <Text style={styles.historyAmount}>{item.kind === 'draw' ? '−' : '+'}{item.amount_kg} kg</Text>
                    </View>
                    <Text style={styles.historyDetails}>Balance: {item.balance_after_kg} kg · {new Date(item.created_at).toLocaleString()}</Text>
                  </View>
                ))}
              </ScrollView>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const styles = useCylinderStyles();
  return <View style={styles.detailItem}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || '—'}</Text></View>;
}

function useCylinderStyles() {
  const { t } = useTheme();
  return React.useMemo(() => makeCylinderStyles(t), [t]);
}

function makeCylinderStyles(t: Palette) {
  return StyleSheet.create({
  scrollContent: { paddingBottom: 34 },
  summaryRow: { flexDirection: 'row', gap: 9, marginBottom: 23 },
  summaryCard: { flex: 1, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 15, paddingVertical: 14, paddingHorizontal: 12 },
  summaryValue: { color: t.text, fontSize: 22, fontWeight: '800' },
  summaryLabel: { color: t.sub, fontSize: 10, fontWeight: '700', marginTop: 4 },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13, gap: 10 },
  sectionEyebrow: { color: t.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  sectionTitle: { color: t.text, fontSize: 18, fontWeight: '800', marginTop: 3 },
  sectionCard: { marginBottom: 14 },
  cylinderCard: { borderWidth: 1, borderColor: t.line, borderRadius: 14, padding: 13, marginBottom: 10, backgroundColor: t.card },
  cylinderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  cylinderBadges: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cylinderSerial: { color: t.text, fontSize: 13, fontWeight: '800', marginBottom: 12 },
  cylinderLevels: { flexDirection: 'row', marginBottom: 10 },
  level: { flex: 1 },
  levelRight: { flex: 1, alignItems: 'flex-end' },
  levelLabel: { color: t.sub, fontSize: 10, fontWeight: '600', marginBottom: 3 },
  levelValue: { color: t.text, fontSize: 16, fontWeight: '800' },
  unit: { color: t.sub, fontSize: 10, fontWeight: '600' },
  progressTrack: { height: 6, backgroundColor: t.field, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: t.primary, borderRadius: 99 },
  fillCaption: { color: t.sub, fontSize: 9, marginTop: 5, textAlign: 'right' },
  emptySection: { paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center' },
  stateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateCard: { alignItems: 'center', gap: 9, padding: 22, marginTop: 20, backgroundColor: t.card },
  stateTitle: { color: t.text, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  stateText: { color: t.sub, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(13, 31, 45, 0.46)', justifyContent: 'center', alignItems: 'center', padding: 18 },
  modal: { width: '100%', maxWidth: 430, maxHeight: '88%', borderRadius: 21, backgroundColor: t.card, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 19, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: t.line },
  modalTitle: { color: t.text, fontSize: 17, fontWeight: '800' },
  modalSubtitle: { color: t.sub, fontSize: 11, marginTop: 3 },
  closeButton: { width: 35, height: 35, borderRadius: 12, backgroundColor: t.field, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  modalContent: { padding: 19, gap: 14 },
  inputLabel: { color: t.sub, fontSize: 12, fontWeight: '700', marginBottom: 2 },
  typeField: { gap: 8 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeOption: { width: '48%', minHeight: 51, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: t.field, borderWidth: 1, borderColor: t.line, justifyContent: 'center' },
  typeOptionActive: { backgroundColor: t.tint, borderColor: t.primary },
  typeCode: { color: t.text, fontSize: 12, fontWeight: '800' },
  typeName: { color: t.sub, fontSize: 9, marginTop: 2 },
  kindSelector: { flexDirection: 'row', gap: 9 },
  kindOption: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: t.field, borderWidth: 1, borderColor: t.line, alignItems: 'center' },
  kindOptionActive: { backgroundColor: t.tint, borderColor: t.primary },
  kindOptionText: { color: t.sub, fontSize: 12, fontWeight: '700' },
  kindOptionTextActive: { color: t.primary },
  formError: { color: t.bad, fontSize: 11, lineHeight: 16 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 5 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailItem: { width: '48%', backgroundColor: t.field, borderRadius: 13, padding: 13 },
  detailLabel: { color: t.sub, fontSize: 10, fontWeight: '700', marginBottom: 5 },
  detailValue: { color: t.text, fontSize: 14, fontWeight: '800' },
  historyTitle: { color: t.text, fontSize: 14, fontWeight: '800', marginTop: 7 },
  historyItem: { borderBottomWidth: 1, borderBottomColor: t.line, paddingVertical: 11 },
  historyTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyAmount: { color: t.text, fontSize: 12, fontWeight: '800' },
  historyDetails: { color: t.sub, fontSize: 10, marginTop: 5 },
  });
}
