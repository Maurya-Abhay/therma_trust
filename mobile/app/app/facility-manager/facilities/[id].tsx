import React from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { BriefcaseBusiness, Building2, MapPin, Phone, UserRound, Wrench } from 'lucide-react-native';
import { fetchEquipment, fetchFacility } from '@/src/api/endpoints';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { Chip, RiskChip } from '@/src/components/ui/Chip';
import { IconBadge, PortalHero, Row, Section, State, Stat, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function FacilityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const facilityId = Number(id);
  const router = useRouter();
  const { t } = useTheme();
  const facilityQuery = useQuery({
    queryKey: ['facility', facilityId],
    queryFn: () => fetchFacility(facilityId),
    enabled: Number.isSafeInteger(facilityId) && facilityId > 0,
  });
  const equipmentQuery = useQuery({
    queryKey: ['equipment', facilityId],
    queryFn: () => fetchEquipment(facilityId),
    enabled: Boolean(facilityQuery.data),
  });
  const facility = facilityQuery.data;
  const equipment = equipmentQuery.data ?? [];

  if (!Number.isSafeInteger(facilityId) || facilityId <= 0) {
    return <ScreenContainer headerTitle="Facility"><State empty="Invalid facility reference." /></ScreenContainer>;
  }
  if (facilityQuery.isLoading) return <ScreenContainer headerTitle="Facility"><State loading /></ScreenContainer>;
  if (facilityQuery.isError || !facility) return <ScreenContainer headerTitle="Facility"><State error onRetry={() => { void facilityQuery.refetch(); }} /></ScreenContainer>;

  return (
    <ScreenContainer headerTitle={facility.name} headerSubtitle="Facility details">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={facilityQuery.isRefetching || equipmentQuery.isRefetching} onRefresh={() => { void Promise.all([facilityQuery.refetch(), equipmentQuery.refetch()]); }} tintColor={t.primary} />}
      >
        <PortalHero eyebrow="FACILITY DETAILS" title={facility.name} subtitle={facility.address || 'Address not provided'} Icon={Building2} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Stat Icon={Wrench} value={equipment.length} label="Equipment units" tone="info" />
          <Stat Icon={Building2} value={facility.segment.replace(/_/g, ' ')} label="Facility type" />
        </View>

        <Section title="Facility contact" />
        <Surface style={{ paddingVertical: 0 }}>
          <Row Icon={UserRound} title={facility.contact_name || 'Contact not provided'} sub="Primary site contact" />
          <Row Icon={Phone} title={facility.contact_phone || 'Phone not provided'} sub="Contact phone" />
          <Row Icon={MapPin} title={facility.service_area || 'Service area not provided'} sub="Service area" last />
        </Surface>

        <Section
          title="Equipment"
          action={equipment.length > 6 ? 'View all' : undefined}
          onAction={equipment.length > 6 ? () => router.push({ pathname: '/app/facility-manager/equipment', params: { facility: String(facility.id) } }) : undefined}
        />
        <Surface style={{ paddingVertical: 0 }}>
          {equipmentQuery.isLoading ? <State loading /> : equipmentQuery.isError ? (
            <State error onRetry={() => { void equipmentQuery.refetch(); }} />
          ) : equipment.length ? equipment.slice(0, 6).map((unit, index) => (
            <View key={unit.id} style={{ borderBottomWidth: index === Math.min(equipment.length, 6) - 1 ? 0 : 1, borderBottomColor: t.line }}>
              <Row
                Icon={Wrench}
                title={unit.name}
                sub={`${unit.category_display} · ${unit.refrigerant_type_code}`}
                right={<RiskChip risk={unit.criticality} size="xs" />}
                onPress={() => router.push(`/app/facility-manager/equipment/${unit.id}`)}
                last
              />
              {unit.drift_warnings.length ? <View style={{ paddingBottom: 10 }}><Chip variant="warning" size="xs">{unit.drift_warnings.length} drift warning{unit.drift_warnings.length === 1 ? '' : 's'}</Chip></View> : null}
            </View>
          )) : (
            <Text style={{ color: t.sub, fontSize: 12, paddingVertical: 16, textAlign: 'center' }}>No equipment has been registered at this facility yet.</Text>
          )}
        </Surface>
        {equipment.length > 6 ? <Button variant="ghost" style={{ marginTop: 4 }} onPress={() => router.push({ pathname: '/app/facility-manager/equipment', params: { facility: String(facility.id) } })}>View all {equipment.length} units</Button> : null}

        <View style={{ gap: 9, marginTop: 16 }}>
          <Button
            leftIcon={<Wrench size={17} color="#FFFFFF" />}
            onPress={() => router.push({ pathname: '/app/facility-manager/equipment/create', params: { facility: String(facility.id) } })}
          >
            Add equipment
          </Button>
          <Button
            variant="outline"
            leftIcon={<BriefcaseBusiness size={17} color={t.primary} />}
            onPress={() => router.push({ pathname: '/app/facility-manager/jobs/create', params: { facility: String(facility.id) } })}
          >
            Create maintenance job
          </Button>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
