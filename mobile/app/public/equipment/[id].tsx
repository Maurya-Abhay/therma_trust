import React from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Gauge, QrCode, Snowflake, Wrench } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { format, isValid } from 'date-fns';
import { fetchEquipmentHistory, publicEquipmentUrl } from '@/src/api/endpoints';
import type { EquipmentHistory } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Chip, RiskChip, StatusChip } from '@/src/components/ui/Chip';
import { IconBadge, PortalHero, Row, Section, State, Stat, Surface } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function EquipmentQRScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const equipmentId = Number(id);
  const validId = Number.isSafeInteger(equipmentId) && equipmentId > 0;
  const { t } = useTheme();
  const historyQuery = useQuery({
    queryKey: ['equipment-history', equipmentId],
    queryFn: () => fetchEquipmentHistory(equipmentId),
    enabled: validId,
    staleTime: 60_000,
  });
  const history = historyQuery.data as EquipmentHistory | undefined;
  const equipment = history?.equipment;
  const qrUrl = publicEquipmentUrl(equipmentId);
  const refresh = () => { void historyQuery.refetch(); };

  if (!validId) return <ScreenContainer headerTitle="Equipment" showBrand showProfile={false}><State empty="Invalid equipment reference." /></ScreenContainer>;
  if (historyQuery.isLoading) return <ScreenContainer headerTitle="Equipment" showBrand showProfile={false}><State loading /></ScreenContainer>;
  if (historyQuery.isError || !history || !equipment) {
    return <ScreenContainer headerTitle="Equipment" showBrand showProfile={false}><State error onRetry={refresh} /></ScreenContainer>;
  }

  const leak = history.leak_rate;
  const installDate = equipment.install_date ? new Date(equipment.install_date) : null;
  return (
    <ScreenContainer headerTitle="Public equipment" showBrand showProfile={false} contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 18, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={historyQuery.isRefetching} onRefresh={refresh} tintColor={t.primary} />}
      >
        <PortalHero eyebrow={history.facility_name} title={equipment.name} subtitle={`${equipment.category_display} · ${equipment.refrigerant_type_code}`} Icon={Wrench} />
        <Surface style={{ alignItems: 'center', marginTop: 12, gap: 10 }}>
          <View style={{ padding: 12, borderRadius: 18, backgroundColor: '#FFFFFF' }}>
            <QRCode value={qrUrl} size={188} color="#0B1F3A" backgroundColor="#FFFFFF" />
          </View>
          <Text style={{ color: t.text, fontSize: 13, fontWeight: '700' }}>Scan for equipment history</Text>
          <Text selectable numberOfLines={2} style={{ color: t.sub, fontSize: 10, textAlign: 'center' }}>{qrUrl}</Text>
        </Surface>

        <View style={{ flexDirection: 'row', gap: 9, marginTop: 12 }}>
          <Stat Icon={Gauge} value={leak.leak_rate_percent === null ? '—' : `${leak.leak_rate_percent.toFixed(1)}%`} label="12-month leak rate" tone={leak.exceeds_threshold ? 'bad' : 'ok'} />
          <Stat Icon={Snowflake} value={`${leak.added_kg_12mo.toFixed(2)} kg`} label="Added in 12 months" tone="info" />
        </View>
        <Section title="Equipment details" />
        <Surface style={{ paddingVertical: 0 }}>
          <Row Icon={Snowflake} title={equipment.refrigerant_type_code} sub="Refrigerant type" />
          <Row Icon={Wrench} title={equipment.capacity || 'Not provided'} sub="Capacity" right={<RiskChip risk={equipment.criticality} size="xs" />} />
          <Row Icon={Snowflake} title={equipment.refrigerant_charge_kg ? `${equipment.refrigerant_charge_kg} kg` : 'Not provided'} sub="Refrigerant charge" />
          <Row Icon={Wrench} title={installDate && isValid(installDate) ? format(installDate, 'MMM d, yyyy') : 'Not provided'} sub="Installation date" last />
        </Surface>

        <Section title="Leak-rate flag" />
        <Surface style={{ gap: 9 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ color: t.sub, fontSize: 12 }}>Threshold</Text>
            <Text style={{ color: t.text, fontSize: 12, fontWeight: '700' }}>{leak.threshold_percent.toFixed(1)}%</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ color: t.sub, fontSize: 12 }}>System charge</Text>
            <Text style={{ color: t.text, fontSize: 12, fontWeight: '700' }}>{leak.charge_kg === null ? 'Not recorded' : `${leak.charge_kg} kg`}</Text>
          </View>
          {leak.exceeds_threshold ? <Chip variant="danger" size="sm">EXCEEDS THRESHOLD</Chip> : <Chip variant="success" size="sm">WITHIN THRESHOLD</Chip>}
          {leak.note ? <Text style={{ color: t.sub, fontSize: 11 }}>{leak.note}</Text> : null}
        </Surface>

        {equipment.drift_warnings.length ? (
          <>
            <Section title="Trend warnings" />
            <View style={{ gap: 9 }}>
              {equipment.drift_warnings.map((warning, index) => (
                <Surface key={`${warning.metric}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <IconBadge Icon={Gauge} tone="warn" size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontSize: 12, fontWeight: '700' }}>{warning.metric}</Text>
                    <Text style={{ color: t.warn, fontSize: 11, marginTop: 3 }}>{warning.direction} · {warning.values.join(', ')}</Text>
                  </View>
                </Surface>
              ))}
            </View>
          </>
        ) : null}

        <Section title="Recent jobs" />
        {history.jobs.length ? (
          <Surface style={{ paddingVertical: 0 }}>
            {history.jobs.slice(0, 5).map((job, index) => (
              <Row
                key={job.id}
                Icon={Wrench}
                title={`Job #${job.id}`}
                sub={`${job.status.replace(/_/g, ' ')} · ${job.risk_level.replace(/_/g, ' ')} · ${job.urgency.replace(/_/g, ' ')}`}
                right={<StatusChip status={job.status} size="xs" />}
                last={index === Math.min(history.jobs.length, 5) - 1}
              />
            ))}
          </Surface>
        ) : <Surface><State empty="No jobs have been recorded for this equipment." /></Surface>}

        {history.reports.length ? (
          <>
            <Section title="Recent service reports" />
            <Surface style={{ paddingVertical: 0 }}>
              {history.reports.slice(0, 5).map((report, index) => (
                <Row
                  key={report.id}
                  Icon={QrCode}
                  title={`Report #${report.id} · ${report.technician}`}
                  sub={`${format(new Date(report.created_at), 'MMM d, yyyy')} · ${report.summary || 'No summary provided'}`}
                  right={<StatusChip status={report.status} size="xs" />}
                  last={index === Math.min(history.reports.length, 5) - 1}
                />
              ))}
            </Surface>
          </>
        ) : null}
        <Text style={{ color: t.sub, fontSize: 11, textAlign: 'center', marginTop: 18 }}>Public equipment information · ThermaTrust</Text>
      </ScrollView>
    </ScreenContainer>
  );
}
