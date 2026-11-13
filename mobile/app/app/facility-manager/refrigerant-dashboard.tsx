import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Snowflake } from 'lucide-react-native';
import { downloadComplianceReport, fetchFacilities, fetchRefrigerantDashboard } from '@/src/api/endpoints';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { Chip } from '@/src/components/ui/Chip';
import { SelectField } from '@/src/components/ui/SelectField';
import { IconBadge, PortalHero, Section, State, Stat, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useToast } from '@/src/components/ui/Toast';
import { saveAndShareFile } from '@/src/nativeFiles';

export default function RefrigerantDashboardScreen() {
  const [facilityId, setFacilityId] = React.useState<number | null>(null);
  const { t } = useTheme();
  const { show } = useToast();
  const facilitiesQuery = useQuery({ queryKey: ['facilities'], queryFn: fetchFacilities, staleTime: 60_000 });
  const dashboardQuery = useQuery({
    queryKey: ['refrigerant-dashboard', facilityId],
    queryFn: () => fetchRefrigerantDashboard(facilityId ?? undefined),
    staleTime: 60_000,
  });
  const downloadMutation = useMutation({
    mutationFn: async () => {
      const data = await downloadComplianceReport(facilityId ?? undefined);
      const date = new Date().toISOString().slice(0, 10);
      return saveAndShareFile(data, `refrigerant-report-${facilityId ?? 'all'}-${date}.csv`, 'text/csv', 'Save refrigerant compliance CSV');
    },
    onSuccess: (shared) => show(shared ? 'Refrigerant CSV is ready.' : 'CSV saved to app storage, but sharing is unavailable.', shared ? 'success' : 'info'),
  });
  const facilities = facilitiesQuery.data ?? [];
  const dashboard = dashboardQuery.data;
  const retry = () => { void Promise.all([facilitiesQuery.refetch(), dashboardQuery.refetch()]); };

  if (facilitiesQuery.isLoading || dashboardQuery.isLoading) return <ScreenContainer headerTitle="Refrigerant dashboard"><State loading /></ScreenContainer>;
  if (facilitiesQuery.isError || dashboardQuery.isError || !dashboard) return <ScreenContainer headerTitle="Refrigerant dashboard"><State error onRetry={retry} /></ScreenContainer>;

  const monthlyPeakAdded = Math.max(...dashboard.monthly.map((month) => month.added_kg), 1);
  const monthlyPeakRecovered = Math.max(...dashboard.monthly.map((month) => month.recovered_kg), 1);
  const facilityOptions = [
    { value: 'all', label: 'All facilities' },
    ...facilities.map((facility) => ({ value: String(facility.id), label: facility.name })),
  ];

  return (
    <ScreenContainer headerTitle="Refrigerant dashboard" headerSubtitle={dashboard.is_estimate ? 'Estimated data' : 'Actual data'}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        <PortalHero
          eyebrow="COMPLIANCE OVERVIEW"
          title="Refrigerant"
          subtitle={dashboard.is_estimate ? dashboard.note || 'Some figures are estimates based on recorded activity.' : 'Track usage, recovery, leak rates, and emissions.'}
          Icon={Snowflake}
        />
        <Section title="Facility and export" />
        <Surface style={{ gap: 12 }}>
          <SelectField
            label="Facility scope"
            placeholder="All facilities"
            value={facilityId === null ? 'all' : String(facilityId)}
            options={facilityOptions}
            onChange={(value) => setFacilityId(value === 'all' ? null : Number(value))}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ color: t.sub, fontSize: 11 }}>Showing data for</Text>
            <Chip size="sm">{facilityId === null ? `All facilities · ${facilities.length}` : facilities.find((facility) => facility.id === facilityId)?.name ?? 'Selected facility'}</Chip>
          </View>
          <Button
            variant="outline"
            leftIcon={<Download size={16} color={t.primary} />}
            loading={downloadMutation.isPending}
            disabled={downloadMutation.isPending}
            onPress={() => downloadMutation.mutate()}
          >
            Export CSV
          </Button>
          {downloadMutation.isError ? <Text style={{ color: t.bad, fontSize: 12 }}>{downloadMutation.error instanceof Error ? downloadMutation.error.message : 'Could not export the compliance report.'}</Text> : null}
        </Surface>

        <Section title="Overview" />
        <View style={{ flexDirection: 'row', gap: 9 }}>
          <Stat Icon={Snowflake} value={`${dashboard.total_added_kg.toFixed(2)} kg`} label="Added" tone="info" />
          <Stat Icon={Snowflake} value={`${dashboard.total_recovered_kg.toFixed(2)} kg`} label="Recovered" tone="ok" />
        </View>
        <View style={{ flexDirection: 'row', gap: 9, marginTop: 9 }}>
          <Stat Icon={Snowflake} value={`${dashboard.leaked_estimate_kg.toFixed(2)} kg`} label="Estimated leak" tone="warn" />
          <Stat Icon={Snowflake} value={`${dashboard.co2e_estimate_kg.toFixed(0)} kg`} label="Estimated CO₂e" tone="bad" />
        </View>

        <Section title="By refrigerant" />
        {Object.keys(dashboard.by_refrigerant).length ? (
          <View style={{ gap: 9 }}>
            {Object.entries(dashboard.by_refrigerant).map(([refrigerant, totals]) => (
              <Surface key={refrigerant} style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                  <IconBadge Icon={Snowflake} size={38} />
                  <Text style={{ color: t.text, fontSize: 14, fontWeight: '800' }}>{refrigerant}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ color: t.sub, fontSize: 11 }}>Added {totals.added_kg.toFixed(2)} kg</Text>
                  <Text style={{ color: t.sub, fontSize: 11 }}>Recovered {totals.recovered_kg.toFixed(2)} kg</Text>
                  <Text style={{ color: t.warn, fontSize: 11 }}>Leak {totals.leaked_estimate_kg.toFixed(2)} kg</Text>
                </View>
              </Surface>
            ))}
          </View>
        ) : <Surface><State empty="No refrigerant usage has been recorded." /></Surface>}

        <Section title="Monthly activity" />
        {dashboard.monthly.length ? (
          <Surface style={{ gap: 13 }}>
            {dashboard.monthly.slice(-12).map((month) => (
              <View key={month.month} style={{ gap: 5 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: t.text, fontSize: 11, fontWeight: '700' }}>{month.month}</Text>
                  <Text style={{ color: t.sub, fontSize: 10 }}>+{month.added_kg.toFixed(1)} / −{month.recovered_kg.toFixed(1)} kg</Text>
                </View>
                <View style={{ height: 7, borderRadius: 4, backgroundColor: t.field, overflow: 'hidden' }}>
                  <View style={{ height: 7, borderRadius: 4, width: `${Math.max(3, (month.added_kg / monthlyPeakAdded) * 100)}%`, backgroundColor: t.primary }} />
                </View>
                <View style={{ height: 5, borderRadius: 4, backgroundColor: t.field, overflow: 'hidden' }}>
                <View style={{ height: 5, borderRadius: 4, width: `${Math.max(3, (month.recovered_kg / monthlyPeakRecovered) * 100)}%`, backgroundColor: t.ok }} />
                </View>
              </View>
            ))}
          </Surface>
        ) : <Surface><State empty="Monthly activity is not available yet." /></Surface>}

        <Section title="Leak rate by equipment" />
        {dashboard.leak_rate_by_equipment.length ? (
          <View style={{ gap: 9 }}>
            {dashboard.leak_rate_by_equipment.map((equipment) => (
              <Surface key={equipment.equipment_id} style={{ gap: 7 }}>
                <Text style={{ color: t.text, fontSize: 13, fontWeight: '800' }}>{equipment.equipment_name}</Text>
                <Text style={{ color: t.sub, fontSize: 11 }}>{equipment.facility_name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ color: t.text, fontSize: 12 }}>
                    Leak rate: {equipment.leak_rate_percent === null ? 'N/A' : `${equipment.leak_rate_percent.toFixed(1)}%`}
                  </Text>
                  <Text style={{ color: t.sub, fontSize: 11 }}>Threshold: {equipment.threshold_percent.toFixed(1)}%</Text>
                </View>
                {equipment.exceeds_threshold ? <Chip variant="danger" size="xs">EXCEEDS THRESHOLD</Chip> : null}
                {equipment.note ? <Text style={{ color: t.sub, fontSize: 11 }}>{equipment.note}</Text> : null}
              </Surface>
            ))}
          </View>
        ) : <Surface><State empty="No equipment leak-rate data is available." /></Surface>}
      </ScrollView>
    </ScreenContainer>
  );
}
