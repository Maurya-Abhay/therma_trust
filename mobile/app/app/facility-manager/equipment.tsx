import React from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { BriefcaseBusiness, Search, Wrench } from 'lucide-react-native';
import { fetchAllEquipment, fetchFacilities } from '@/src/api/endpoints';
import { Equipment } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { Chip, RiskChip } from '@/src/components/ui/Chip';
import { Input } from '@/src/components/ui/Input';
import { SelectField } from '@/src/components/ui/SelectField';
import { IconBadge, PortalHero, State, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function EquipmentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ facility?: string }>();
  const { t } = useTheme();
  const [refreshing, setRefreshing] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [facilityFilter, setFacilityFilter] = React.useState(params.facility ?? 'all');
  const facilitiesQuery = useQuery({ queryKey: ['facilities'], queryFn: fetchFacilities, staleTime: 30_000 });
  const equipmentQuery = useQuery({ queryKey: ['equipment', 'all'], queryFn: fetchAllEquipment, staleTime: 30_000 });
  const facilities = facilitiesQuery.data ?? [];
  const equipment = equipmentQuery.data ?? [];
  const facilityNames = React.useMemo(() => new Map(facilities.map((facility) => [facility.id, facility.name])), [facilities]);

  React.useEffect(() => {
    setFacilityFilter(params.facility ?? 'all');
  }, [params.facility]);

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return equipment.filter((item) =>
      (facilityFilter === 'all' || String(item.facility) === facilityFilter) &&
      (!query || `${item.name} ${item.category_display} ${item.refrigerant_type_code} ${facilityNames.get(item.facility) ?? ''}`.toLowerCase().includes(query)),
    );
  }, [equipment, facilityFilter, facilityNames, search]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([facilitiesQuery.refetch(), equipmentQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  if (facilitiesQuery.isLoading || equipmentQuery.isLoading) return <ScreenContainer headerTitle="Equipment"><State loading /></ScreenContainer>;
  if (facilitiesQuery.isError || equipmentQuery.isError) {
    return (
      <ScreenContainer headerTitle="Equipment">
        <State error onRetry={() => { void refresh(); }} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer headerTitle="Equipment" headerSubtitle={`${equipment.length} registered units`}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(); }} tintColor={t.primary} />}
        contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 14, gap: 12 }}>
            <PortalHero eyebrow="ASSET REGISTER" title="Equipment" subtitle="Search units, review their condition and raise maintenance jobs." Icon={Wrench} />
            {facilities.length ? (
              <>
                <Input value={search} onChangeText={setSearch} placeholder="Search name, category, refrigerant" leftIcon={<Search size={17} color={t.sub} />} />
                {facilities.length > 1 ? (
                  <SelectField
                    label="Facility filter"
                    placeholder="All facilities"
                    value={facilityFilter}
                    options={[{ value: 'all', label: 'All facilities' }, ...facilities.map((facility) => ({ value: String(facility.id), label: facility.name }))]}
                    onChange={setFacilityFilter}
                  />
                ) : null}
                <Button onPress={() => router.push('/app/facility-manager/equipment/create')}>Add equipment</Button>
              </>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <EquipmentCard
            equipment={item}
            facilityName={facilityNames.get(item.facility) ?? 'Facility'}
            onOpen={() => router.push(`/app/facility-manager/equipment/${item.id}`)}
            onRequestJob={() => router.push({
              pathname: '/app/facility-manager/jobs/create',
              params: { facility: String(item.facility), equipment: String(item.id) },
            })}
          />
        )}
        ListEmptyComponent={
          facilities.length === 0 ? (
            <Surface style={{ alignItems: 'center', padding: 24, gap: 10 }}>
              <IconBadge Icon={Wrench} size={46} />
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '800' }}>Add a facility first</Text>
              <Text style={{ color: t.sub, textAlign: 'center', fontSize: 12 }}>Equipment belongs to a facility, so create one before registering units.</Text>
              <Button size="sm" onPress={() => router.push('/app/facility-manager/facilities/create')}>Add facility</Button>
            </Surface>
          ) : equipment.length === 0 ? (
            <Surface style={{ alignItems: 'center', padding: 24, gap: 10 }}>
              <IconBadge Icon={Wrench} size={46} />
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '800' }}>No equipment yet</Text>
              <Text style={{ color: t.sub, textAlign: 'center', fontSize: 12 }}>Register a unit to start tracking service history and leak rate.</Text>
              <Button size="sm" onPress={() => router.push('/app/facility-manager/equipment/create')}>Add first unit</Button>
            </Surface>
          ) : (
            <Text style={{ color: t.sub, textAlign: 'center', padding: 22, fontSize: 12 }}>Nothing matches this search. Try another term or facility.</Text>
          )
        }
      />
    </ScreenContainer>
  );
}

function EquipmentCard({
  equipment,
  facilityName,
  onOpen,
  onRequestJob,
}: {
  equipment: Equipment;
  facilityName: string;
  onOpen: () => void;
  onRequestJob: () => void;
}) {
  const { t } = useTheme();
  return (
    <Surface style={{ marginBottom: 11, padding: 14 }}>
      <Surface onPress={onOpen} style={{ borderWidth: 0, padding: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <IconBadge Icon={Wrench} size={42} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: t.text, fontSize: 14, fontWeight: '800' }}>{equipment.name}</Text>
            <Text numberOfLines={1} style={{ color: t.sub, fontSize: 11, marginTop: 3 }}>{facilityName}</Text>
          </View>
          <RiskChip risk={equipment.criticality} size="sm" />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          <Chip variant="info" size="xs">{equipment.category_display}</Chip>
          <Chip size="xs">{equipment.refrigerant_type_code}</Chip>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
          {equipment.refrigerant_charge_kg ? <Text style={{ color: t.sub, fontSize: 11 }}>Charge · {equipment.refrigerant_charge_kg} kg</Text> : null}
          {equipment.install_date ? <Text style={{ color: t.sub, fontSize: 11 }}>Installed · {new Date(equipment.install_date).toLocaleDateString()}</Text> : null}
        </View>
        {equipment.drift_warnings.length ? (
          <View style={{ marginTop: 9 }}>
            <Chip variant="warning" size="sm">{equipment.drift_warnings.length} drift warning{equipment.drift_warnings.length === 1 ? '' : 's'}</Chip>
          </View>
        ) : null}
      </Surface>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.line }}>
        <Button size="sm" variant="outline" leftIcon={<BriefcaseBusiness size={15} color={t.primary} />} onPress={onRequestJob}>Request job</Button>
      </View>
    </Surface>
  );
}
