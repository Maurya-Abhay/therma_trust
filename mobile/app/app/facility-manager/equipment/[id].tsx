import React from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BriefcaseBusiness, Download, Gauge, Snowflake, Wrench } from 'lucide-react-native';
import { format, isValid } from 'date-fns';
import { downloadEquipmentLabel, fetchEquipmentHistory } from '@/src/api/endpoints';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { Chip, RiskChip, StatusChip } from '@/src/components/ui/Chip';
import { IconBadge, PortalHero, Row, Section, State, Stat, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useToast } from '@/src/components/ui/Toast';
import { saveAndShareFile } from '@/src/nativeFiles';

export default function EquipmentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const equipmentId = Number(id);
  const validId = Number.isSafeInteger(equipmentId) && equipmentId > 0;
  const { t } = useTheme();
  const { show } = useToast();
  const historyQuery = useQuery({
    queryKey: ['equipment-history', equipmentId],
    queryFn: () => fetchEquipmentHistory(equipmentId),
    enabled: validId,
  });
  const labelMutation = useMutation({
    mutationFn: async () => {
      const pdf = await downloadEquipmentLabel(equipmentId);
      return saveAndShareFile(pdf, `equipment-label-${equipmentId}.pdf`, 'application/pdf', 'Save equipment label PDF');
    },
    onSuccess: (shared) => show(shared ? 'Equipment label is ready.' : 'Label saved to app storage, but sharing is unavailable.', shared ? 'success' : 'info'),
  });
  const history = historyQuery.data;
  const equipment = history?.equipment;
  const refresh = () => { void historyQuery.refetch(); };

  if (!validId) return <ScreenContainer headerTitle="Equipment"><State empty="Invalid equipment reference." /></ScreenContainer>;
  if (historyQuery.isLoading) return <ScreenContainer headerTitle="Equipment"><State loading /></ScreenContainer>;
  if (historyQuery.isError || !equipment || !history) return <ScreenContainer headerTitle="Equipment"><State error onRetry={refresh} /></ScreenContainer>;

  const leakRate = history.leak_rate;
  const installed = equipment.install_date ? new Date(equipment.install_date) : null;
  return (
    <ScreenContainer headerTitle="Equipment" headerSubtitle={equipment.name}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={historyQuery.isRefetching} onRefresh={refresh} tintColor={t.primary} />}
      >
        <PortalHero eyebrow={history.facility_name} title={equipment.name} subtitle={`${equipment.category_display} · ${equipment.refrigerant_type_code}`} Icon={Wrench} />
        <View style={{ flexDirection: 'row', gap: 9, marginTop: 13 }}>
          <Stat Icon={Snowflake} value={equipment.refrigerant_charge_kg ? `${equipment.refrigerant_charge_kg} kg` : '—'} label="Refrigerant charge" tone="info" />
          <Stat Icon={Gauge} value={leakRate?.leak_rate_percent == null ? '—' : `${leakRate.leak_rate_percent.toFixed(1)}%`} label="12-month leak rate" tone={leakRate?.exceeds_threshold ? 'bad' : 'ok'} />
        </View>

        <Section title="Equipment details" />
        <Surface style={{ paddingVertical: 0 }}>
          <Row Icon={Wrench} title={equipment.category_display} sub="Category" right={<RiskChip risk={equipment.criticality} size="xs" />} />
          <Row Icon={Snowflake} title={equipment.refrigerant_type_code} sub="Refrigerant type" />
          <Row Icon={Gauge} title={equipment.capacity ? `${equipment.capacity}` : 'Not provided'} sub="Capacity" />
          <Row Icon={Snowflake} title={equipment.refrigerant_charge_kg ? `${equipment.refrigerant_charge_kg} kg` : 'Not provided'} sub="Refrigerant charge" />
          <Row Icon={Wrench} title={installed && isValid(installed) ? format(installed, 'MMM d, yyyy') : 'Not provided'} sub="Installation date" last />
        </Surface>
        <View style={{ flexDirection: 'row', gap: 9, marginTop: 10 }}>
          <Button
            variant="outline"
            style={{ flex: 1 }}
            leftIcon={<Download size={16} color={t.primary} />}
            loading={labelMutation.isPending}
            disabled={labelMutation.isPending}
            onPress={() => labelMutation.mutate()}
          >
            QR label
          </Button>
          <Button
            style={{ flex: 1 }}
            leftIcon={<BriefcaseBusiness size={16} color="#FFFFFF" />}
            onPress={() => router.push({
              pathname: '/app/facility-manager/jobs/create',
              params: { facility: String(equipment.facility), equipment: String(equipment.id) },
            })}
          >
            Request job
          </Button>
        </View>
        {labelMutation.isError ? <Text style={{ color: t.bad, fontSize: 12, marginTop: 8 }}>{labelMutation.error instanceof Error ? labelMutation.error.message : 'Could not download the equipment label.'}</Text> : null}

        {leakRate ? (
          <>
            <Section title="Leak-rate compliance" />
            <Surface style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ color: t.sub, fontSize: 12 }}>12-month added refrigerant</Text>
                <Text style={{ color: t.text, fontSize: 12, fontWeight: '700' }}>{leakRate.added_kg_12mo.toFixed(2)} kg</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ color: t.sub, fontSize: 12 }}>Threshold</Text>
                <Text style={{ color: t.text, fontSize: 12, fontWeight: '700' }}>{leakRate.threshold_percent.toFixed(1)}%</Text>
              </View>
              {leakRate.exceeds_threshold ? <Chip variant="danger" size="sm">EXCEEDS THRESHOLD</Chip> : <Chip variant="success" size="sm">WITHIN THRESHOLD</Chip>}
              {leakRate.note ? <Text style={{ color: t.sub, fontSize: 11 }}>{leakRate.note}</Text> : null}
            </Surface>
          </>
        ) : null}

        {equipment.drift_warnings.length ? (
          <>
            <Section title="Equipment trend warnings" />
            <View style={{ gap: 9 }}>
              {equipment.drift_warnings.map((warning, index) => (
                <Surface key={`${warning.metric}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <IconBadge Icon={Gauge} size={38} tone="warn" />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ color: t.text, fontSize: 12, fontWeight: '800' }}>{warning.metric}</Text>
                    <Text style={{ color: t.warn, fontSize: 11 }}>{warning.direction} · {warning.values.join(', ')}</Text>
                  </View>
                </Surface>
              ))}
            </View>
          </>
        ) : null}

        <Section title="Maintenance history" />
        {history.jobs.length ? (
          <Surface style={{ paddingVertical: 0 }}>
            {history.jobs.map((job, index) => (
              <Row
                key={job.id}
                Icon={Wrench}
                title={`Job #${job.id}`}
                sub={`${job.status.replace(/_/g, ' ')} · ${job.urgency.replace(/_/g, ' ')}${job.scheduled_for ? ` · ${format(new Date(job.scheduled_for), 'MMM d, yyyy')}` : ''}`}
                right={<StatusChip status={job.status} size="xs" />}
                onPress={() => router.push(`/app/facility-manager/jobs/${job.id}`)}
                last={index === history.jobs.length - 1}
              />
            ))}
          </Surface>
        ) : <Surface><State empty="No jobs have been recorded for this equipment." /></Surface>}

        {history.reports.length ? (
          <>
            <Section title="Service reports" />
            <Surface style={{ paddingVertical: 0 }}>
              {history.reports.map((report, index) => (
                <Row
                  key={report.id}
                  Icon={Download}
                  title={`Report #${report.id} · ${report.technician}`}
                  sub={`${format(new Date(report.created_at), 'MMM d, yyyy')} · +${report.refrigerant_added_kg} kg / -${report.refrigerant_recovered_kg} kg`}
                  right={<StatusChip status={report.status} size="xs" />}
                  last={index === history.reports.length - 1}
                />
              ))}
            </Surface>
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}
