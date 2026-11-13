import React from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin, Plus, Wrench } from 'lucide-react-native';
import { fetchFacilities } from '@/src/api/endpoints';
import { Facility } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { Chip } from '@/src/components/ui/Chip';
import { IconBadge, PortalHero, State, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function FacilitiesScreen() {
  const router = useRouter();
  const { t } = useTheme();
  const [refreshing, setRefreshing] = React.useState(false);
  const query = useQuery({ queryKey: ['facilities'], queryFn: fetchFacilities, staleTime: 30_000 });
  const facilities = query.data ?? [];

  const refresh = async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (query.isLoading) return <ScreenContainer headerTitle="Facilities"><State loading /></ScreenContainer>;
  if (query.isError) return <ScreenContainer headerTitle="Facilities"><State error onRetry={() => { void query.refetch(); }} /></ScreenContainer>;

  return (
    <ScreenContainer headerTitle="Facilities" headerSubtitle={`${facilities.length} managed sites`}>
      <FlatList
        data={facilities}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(); }} tintColor={t.primary} />}
        contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <PortalHero eyebrow="YOUR SITES" title="Facilities" subtitle="Manage site details and the equipment registered at each facility." Icon={Building2} />
            <Button style={{ marginTop: 12 }} leftIcon={<Plus size={17} color="#FFFFFF" />} onPress={() => router.push('/app/facility-manager/facilities/create')}>
              Add facility
            </Button>
          </View>
        }
        renderItem={({ item }) => <FacilityCard facility={item} onPress={() => router.push(`/app/facility-manager/facilities/${item.id}`)} />}
        ListEmptyComponent={
          <Surface style={{ alignItems: 'center', padding: 24, gap: 10 }}>
            <IconBadge Icon={Building2} size={48} />
            <Text style={{ color: t.text, fontSize: 15, fontWeight: '800' }}>No facilities yet</Text>
            <Text style={{ color: t.sub, textAlign: 'center', fontSize: 12 }}>Add your first site to start registering equipment and raising jobs.</Text>
            <Button size="sm" onPress={() => router.push('/app/facility-manager/facilities/create')}>Add first facility</Button>
          </Surface>
        }
      />
    </ScreenContainer>
  );
}

function FacilityCard({ facility, onPress }: { facility: Facility; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Surface onPress={onPress} style={{ marginBottom: 11, padding: 15 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}>
        <IconBadge Icon={Building2} size={42} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: t.text, fontSize: 15, fontWeight: '800' }}>{facility.name}</Text>
          <Text numberOfLines={2} style={{ color: t.sub, fontSize: 12, marginTop: 4 }}>{facility.address || 'Address not provided'}</Text>
        </View>
        <Chip size="sm">{facility.segment.replace(/_/g, ' ')}</Chip>
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: t.line }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Wrench size={15} color={t.primary} />
          <Text style={{ color: t.text, fontSize: 12, fontWeight: '700' }}>{facility.equipment_count} equipment</Text>
        </View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <MapPin size={15} color={t.sub} />
          <Text numberOfLines={1} style={{ color: t.sub, fontSize: 12 }}>{facility.service_area || 'Service area not set'}</Text>
        </View>
      </View>
    </Surface>
  );
}
