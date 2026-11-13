import React from 'react';
import { Alert, FlatList, Modal, RefreshControl, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus, Users, X } from 'lucide-react-native';
import {
  addTechnicianToContractor,
  fetchContractorTechnicians,
  fetchContractors,
  fetchTechnicians,
  removeTechnicianFromContractor,
} from '@/src/api/endpoints';
import { getApiErrorMessage } from '@/src/api/errorMessage';
import { TechnicianProfile } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { Chip } from '@/src/components/ui/Chip';
import { Input } from '@/src/components/ui/Input';
import { IconBadge, PortalHero, State, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function ContractorRosterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ add?: string }>();
  const queryClient = useQueryClient();
  const { t } = useTheme();
  const [refreshing, setRefreshing] = React.useState(false);
  const [showAdd, setShowAdd] = React.useState(false);

  const companyQuery = useQuery({
    queryKey: ['my-contractor-company'],
    queryFn: fetchContractors,
    staleTime: 60_000,
  });
  const companyId = companyQuery.data?.[0]?.id;

  const rosterQuery = useQuery({
    queryKey: ['contractor-roster', companyId],
    queryFn: () => fetchContractorTechnicians(companyId!),
    enabled: Boolean(companyId),
    staleTime: 30_000,
  });
  const technicians = rosterQuery.data ?? [];

  React.useEffect(() => {
    if (companyId && params.add === '1') setShowAdd(true);
  }, [companyId, params.add]);

  const addMutation = useMutation({
    mutationFn: (technicianId: number) => addTechnicianToContractor(companyId!, technicianId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contractor-roster', companyId] }),
        queryClient.invalidateQueries({ queryKey: ['contractor-capabilities', companyId] }),
        queryClient.invalidateQueries({ queryKey: ['my-contractor-company'] }),
      ]);
      setShowAdd(false);
      Alert.alert('Technician added', 'The technician is now on your company roster.');
    },
    onError: (error) => Alert.alert('Could not add technician', getApiErrorMessage(error, 'Please try again.')),
  });

  const removeMutation = useMutation({
    mutationFn: (technicianId: number) => removeTechnicianFromContractor(companyId!, technicianId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contractor-roster', companyId] }),
        queryClient.invalidateQueries({ queryKey: ['contractor-capabilities', companyId] }),
        queryClient.invalidateQueries({ queryKey: ['my-contractor-company'] }),
      ]);
      Alert.alert('Technician removed', 'The technician was removed from your company roster.');
    },
    onError: (error) => Alert.alert('Could not remove technician', getApiErrorMessage(error, 'Please try again.')),
  });

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([rosterQuery.refetch(), companyQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  if (companyQuery.isLoading) {
    return <ScreenContainer headerTitle="Team roster"><State loading /></ScreenContainer>;
  }
  if (companyQuery.isError) {
    return <ScreenContainer headerTitle="Team roster"><State error onRetry={() => { void companyQuery.refetch(); }} /></ScreenContainer>;
  }
  if (!companyId) {
    return (
      <ScreenContainer headerTitle="Team roster">
        <Surface style={{ alignItems: 'center', padding: 24, gap: 12 }}>
          <IconBadge Icon={Users} size={50} />
          <Text style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>Register your company first</Text>
          <Text style={{ color: t.sub, textAlign: 'center', fontSize: 12, lineHeight: 18 }}>Your company profile is needed before you can manage its technician roster.</Text>
          <Button onPress={() => router.push('/app/contractor/company')}>Open company setup</Button>
        </Surface>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer headerTitle="Team roster" headerSubtitle={`${technicians.length} technicians`} contentStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}>
      <FlatList
        data={technicians}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(); }} tintColor={t.primary} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 10 }}>
            <PortalHero eyebrow="YOUR TEAM" title="Technician roster" subtitle="Add and manage the technicians working with your company." Icon={Users} />
            <Button
              onPress={() => setShowAdd(true)}
              leftIcon={<UserPlus size={17} color="#FFFFFF" />}
              style={{ marginTop: 12 }}
            >
              Add technician
            </Button>
            {rosterQuery.isError ? <View style={{ marginTop: 12 }}><State error onRetry={() => { void rosterQuery.refetch(); }} /></View> : null}
          </View>
        }
        renderItem={({ item }) => (
          <TechnicianRow
            technician={item}
            removing={removeMutation.isPending && removeMutation.variables === item.id}
            onRemove={() => Alert.alert(
              'Remove technician?',
              `Remove ${item.full_name} from your company roster?`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => removeMutation.mutate(item.id) },
              ],
            )}
          />
        )}
        ListEmptyComponent={
          rosterQuery.isLoading ? <State loading /> : !rosterQuery.isError ? (
            <Surface style={{ alignItems: 'center', padding: 24, gap: 10 }}>
              <IconBadge Icon={Users} size={46} />
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '800' }}>No technicians yet</Text>
              <Text style={{ color: t.sub, textAlign: 'center', fontSize: 12 }}>Add your first technician to build your roster.</Text>
              <Button size="sm" onPress={() => setShowAdd(true)}>Add first technician</Button>
            </Surface>
          ) : undefined
        }
      />
      <AddTechnicianModal
        visible={showAdd}
        companyId={companyId}
        loading={addMutation.isPending}
        onClose={() => setShowAdd(false)}
        onAdd={(technicianId) => addMutation.mutate(technicianId)}
      />
    </ScreenContainer>
  );
}

function TechnicianRow({ technician, removing, onRemove }: { technician: TechnicianProfile; removing: boolean; onRemove: () => void }) {
  const { t } = useTheme();
  return (
    <Surface style={{ marginBottom: 10, padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <View style={{ width: 42, height: 42, borderRadius: 16, backgroundColor: t.tint, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: t.primary, fontSize: 16, fontWeight: '800' }}>{technician.full_name.trim().charAt(0).toUpperCase() || '?'}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: t.text, fontSize: 14, fontWeight: '800' }}>{technician.full_name}</Text>
          <Text numberOfLines={1} style={{ color: t.sub, fontSize: 11, marginTop: 3 }}>{technician.email}</Text>
        </View>
        <Chip variant={technician.available ? 'success' : 'default'} size="sm">{technician.available ? 'Available' : 'Unavailable'}</Chip>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.line }}>
        <Text style={{ flex: 1, color: t.sub, fontSize: 11 }}>
          {technician.years_experience} years · {technician.service_area || 'Service area not set'} · {technician.average_rating ? `${technician.average_rating.toFixed(1)} rating` : 'Not rated'}
        </Text>
        <Button size="sm" variant="danger" loading={removing} onPress={onRemove}>Remove</Button>
      </View>
    </Surface>
  );
}

function AddTechnicianModal({
  visible,
  companyId,
  loading,
  onClose,
  onAdd,
}: {
  visible: boolean;
  companyId: number;
  loading: boolean;
  onClose: () => void;
  onAdd: (technicianId: number) => void;
}) {
  const { t } = useTheme();
  const [search, setSearch] = React.useState('');
  const techniciansQuery = useQuery({
    queryKey: ['available-technicians'],
    queryFn: fetchTechnicians,
    enabled: visible,
    staleTime: 30_000,
  });

  const available = React.useMemo(() => (techniciansQuery.data ?? [])
    .filter((tech) => tech.contractor !== companyId)
    .filter((tech) => `${tech.full_name} ${tech.email}`.toLowerCase().includes(search.trim().toLowerCase())),
  [companyId, search, techniciansQuery.data]);

  React.useEffect(() => {
    if (visible) setSearch('');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <Surface style={{ maxHeight: '85%', padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 17, fontWeight: '800' }}>Add technician</Text>
              <Text style={{ color: t.sub, fontSize: 12, marginTop: 3 }}>Search technicians to add to your roster.</Text>
            </View>
            <Button size="sm" variant="ghost" onPress={onClose} accessibilityLabel="Close">
              <X size={20} color={t.sub} />
            </Button>
          </View>
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search name or email"
            leftIcon={<Search size={17} color={t.sub} />}
            containerStyle={{ marginBottom: 10 }}
          />
          {techniciansQuery.isError ? <State error onRetry={() => { void techniciansQuery.refetch(); }} /> : null}
          {techniciansQuery.isLoading ? <State loading /> : (
            <FlatList
              data={available}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 8 }}
              renderItem={({ item }) => (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.line }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: t.text, fontSize: 13, fontWeight: '700' }}>{item.full_name}</Text>
                    <Text numberOfLines={1} style={{ color: t.sub, fontSize: 11, marginTop: 2 }}>{item.email}</Text>
                  </View>
                  <Button size="sm" disabled={loading} onPress={() => onAdd(item.id)}>Add</Button>
                </View>
              )}
              ListEmptyComponent={!techniciansQuery.isError ? (
                <Text style={{ color: t.sub, textAlign: 'center', paddingVertical: 22, fontSize: 12 }}>No available technicians found.</Text>
              ) : undefined}
            />
          )}
        </Surface>
      </View>
    </Modal>
  );
}
