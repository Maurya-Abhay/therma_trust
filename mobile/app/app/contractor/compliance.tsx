import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Building2, FileCheck2, ShieldCheck, Tags, Users } from 'lucide-react-native';
import { fetchContractorCompliance, fetchContractorPendingApprovals, fetchContractors } from '@/src/api/endpoints';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { IconBadge, PortalHero, Section, State, Stat, Surface, toneFor } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function ComplianceScreen() {
  const router = useRouter();
  const { t } = useTheme();
  const companyQuery = useQuery({ queryKey: ['my-contractor-company'], queryFn: fetchContractors, staleTime: 60_000 });
  const company = companyQuery.data?.[0];
  const companyId = company?.id;

  const complianceQuery = useQuery({
    queryKey: ['contractor-compliance', companyId],
    queryFn: () => fetchContractorCompliance(companyId!),
    enabled: Boolean(companyId),
    staleTime: 60_000,
  });
  const approvalsQuery = useQuery({
    queryKey: ['pending-approvals', companyId],
    queryFn: () => fetchContractorPendingApprovals(companyId!),
    enabled: Boolean(companyId),
    staleTime: 60_000,
  });

  if (companyQuery.isLoading) return <ScreenContainer headerTitle="Company compliance"><State loading /></ScreenContainer>;
  if (companyQuery.isError) return <ScreenContainer headerTitle="Company compliance"><State error onRetry={() => { void companyQuery.refetch(); }} /></ScreenContainer>;
  if (!companyId) {
    return (
      <ScreenContainer headerTitle="Company compliance">
        <Surface style={{ alignItems: 'center', padding: 24, gap: 12 }}>
          <IconBadge Icon={Building2} size={48} />
          <Text style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>Register your company first</Text>
          <Text style={{ color: t.sub, textAlign: 'center', fontSize: 12 }}>Company compliance data appears after your company profile is created.</Text>
          <Button onPress={() => router.push('/app/contractor/company')}>Open company setup</Button>
        </Surface>
      </ScreenContainer>
    );
  }

  if (complianceQuery.isLoading) return <ScreenContainer headerTitle="Company compliance"><State loading /></ScreenContainer>;
  if (complianceQuery.isError || !complianceQuery.data) {
    return <ScreenContainer headerTitle="Company compliance"><State error onRetry={() => { void complianceQuery.refetch(); }} /></ScreenContainer>;
  }

  const compliance = complianceQuery.data;
  const scoreTone = toneFor(compliance.score >= 80 ? 'complete' : compliance.score >= 60 ? 'pending' : 'critical');
  const pendingCount = approvalsQuery.data ?? 0;

  return (
    <ScreenContainer headerTitle="Company compliance" headerSubtitle={company.name}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <PortalHero eyebrow="COMPANY HEALTH" title="Compliance overview" subtitle="Track verification and evidence completion for your company." Icon={ShieldCheck} />
        <Surface style={{ marginTop: 14, alignItems: 'center', padding: 18 }}>
          <IconBadge Icon={ShieldCheck} tone={scoreTone} size={54} />
          <Text style={{ color: t.text, fontSize: 34, fontWeight: '900', marginTop: 8 }}>{compliance.score}%</Text>
          <Text style={{ color: t.sub, fontSize: 12, marginTop: 2 }}>Overall compliance score</Text>
        </Surface>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Stat Icon={Users} value={compliance.technician_count} label="Technicians" />
          <Stat Icon={Tags} value={pendingCount} label="Pending skills" tone="warn" />
        </View>

        <Section title="Verification breakdown" />
        <Surface style={{ gap: 14 }}>
          <ComplianceMetric label="Company verification" value={compliance.company_verified ? 'Verified' : 'Pending'} percent={compliance.company_verified ? 100 : 0} Icon={Building2} />
          <ComplianceMetric label="Team capabilities" value={`${compliance.capability_verified_rate.toFixed(1)}%`} percent={compliance.capability_verified_rate} Icon={Tags} />
          <ComplianceMetric label="Technician credentials" value={`${compliance.credential_verified_rate.toFixed(1)}%`} percent={compliance.credential_verified_rate} Icon={BadgeCheck} />
          <ComplianceMetric label="Company documents" value={`${compliance.document_verified_rate.toFixed(1)}%`} percent={compliance.document_verified_rate} Icon={FileCheck2} />
        </Surface>

        {approvalsQuery.isError ? <View style={{ marginTop: 12 }}><State error onRetry={() => { void approvalsQuery.refetch(); }} /></View> : null}
        {pendingCount > 0 ? (
          <Button style={{ marginTop: 14 }} onPress={() => router.push('/app/contractor/capabilities')}>
            Review {pendingCount} pending {pendingCount === 1 ? 'capability' : 'capabilities'}
          </Button>
        ) : null}
        <Button style={{ marginTop: 10 }} variant="outline" onPress={() => router.push('/app/contractor/company')}>
          Manage company documents
        </Button>
      </ScrollView>
    </ScreenContainer>
  );
}

function ComplianceMetric({ label, value, percent, Icon }: { label: string; value: string; percent: number; Icon: typeof ShieldCheck }) {
  const { t } = useTheme();
  const width = Math.max(0, Math.min(100, percent));
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
      <IconBadge Icon={Icon} tone="info" size={36} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ color: t.sub, fontSize: 12, flex: 1 }}>{label}</Text>
          <Text style={{ color: t.text, fontSize: 12, fontWeight: '700' }}>{value}</Text>
        </View>
        <View style={{ height: 6, borderRadius: 99, backgroundColor: t.field, overflow: 'hidden' }}>
          <View style={{ width: `${width}%`, height: '100%', backgroundColor: t.primary, borderRadius: 99 }} />
        </View>
      </View>
    </View>
  );
}
