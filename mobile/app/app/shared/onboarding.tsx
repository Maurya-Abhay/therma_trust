import React, { useEffect, useState } from 'react';
import { Alert, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchOnboarding } from '@/src/api/endpoints';
import { OnboardingChecklist } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Card, CardHeader, CardContent } from '@/src/components/ui/Card';
import { Chip } from '@/src/components/ui/Chip';
import { Button } from '@/src/components/ui/Button';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/auth/AuthContext';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function OnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTheme();
  const [checklist, setChecklist] = useState<OnboardingChecklist | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['onboarding', user?.id],
    queryFn: fetchOnboarding,
    enabled: !!user,
    staleTime: 60000,
  });

  useEffect(() => {
    if (data) setChecklist(data);
  }, [data]);

  const refreshMutation = useMutation({
    mutationFn: async () => (await refetch()).data,
    onSuccess: (data) => {
      if (data) setChecklist(data);
    },
    onError: () => Alert.alert('Refresh failed', 'Could not refresh your onboarding status. Please try again.'),
  });

  const handleStepPress = (step: OnboardingChecklist['steps'][number]) => {
    if (!step.done) {
      const technicianRoutes: Record<string, string> = {
        profile: '/app/technician/profile?edit=1',
        credential: '/app/technician/credentials/create',
        capability: '/app/technician/capabilities/create',
        assessment: '/app/technician/assessments',
        job: '/app/technician/jobs',
      };
      const contractorRoutes: Record<string, string> = {
        company: '/app/contractor/company',
        document: '/app/contractor/company?add=1',
        roster: '/app/contractor/roster?add=1',
        cylinder: '/app/contractor/cylinders?add=1',
      };
      const facilityManagerRoutes: Record<string, string> = {
        facility: '/app/facility-manager/facilities/create',
        equipment: step.link.includes('/facilities') ? '/app/facility-manager/facilities/create' : '/app/facility-manager/equipment/create',
        job: '/app/facility-manager/jobs/create',
        complete: '/app/facility-manager/dashboard',
      };
      const target = user?.role === 'technician'
        ? technicianRoutes[step.id]
        : user?.role === 'contractor_manager'
          ? contractorRoutes[step.id]
          : user?.role === 'facility_manager'
            ? facilityManagerRoutes[step.id]
            : step.link;
      if (!target) {
        Alert.alert('Unavailable', 'This onboarding step does not have a mobile screen yet.');
        return;
      }
      router.push(target as any);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer headerTitle="Onboarding">
        <View style={styles.loading}>
          <Text style={{ color: t.sub }}>Loading...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isError && !checklist) {
    return (
      <ScreenContainer headerTitle="Onboarding">
        <View style={styles.empty}>
          <Text style={{ color: t.sub, textAlign: 'center' }}>Could not load onboarding data.</Text>
          <Button variant="outline" onPress={() => { void refetch(); }}>Try again</Button>
        </View>
      </ScreenContainer>
    );
  }

  if (!checklist) {
    return (
      <ScreenContainer headerTitle="Onboarding">
        <View style={styles.empty}>
          <Text style={{ color: t.sub, textAlign: 'center' }}>No onboarding data</Text>
        </View>
      </ScreenContainer>
    );
  }

  const progress = checklist.total > 0 ? (checklist.completed / checklist.total) * 100 : 100;

  return (
    <ScreenContainer headerTitle="Onboarding Checklist" headerSubtitle={`${checklist.completed}/${checklist.total} completed`}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Progress */}
        <Card style={[styles.progressCard, { backgroundColor: t.card, borderColor: t.line }]}>
          <CardContent>
            <View style={styles.progressRow}>
              <View style={[styles.progressBarContainer, { backgroundColor: t.field }]}>
                <View style={[styles.progressBar, { width: `${progress}%`, backgroundColor: t.primary }]} />
              </View>
              <Text style={[styles.progressText, { color: t.primary }]}>{Math.round(progress)}%</Text>
            </View>
            <Text style={[styles.progressLabel, { color: t.sub }]}>{checklist.completed} of {checklist.total} steps completed</Text>
          </CardContent>
        </Card>

        {/* Steps */}
        <View style={styles.stepsList}>
          {checklist.steps.map((step, i) => (
            <TouchableOpacity
              key={step.id}
              style={[styles.stepCard, { backgroundColor: step.done ? t.okBg : t.card, borderColor: step.done ? t.okBg : t.line }]}
              onPress={() => handleStepPress(step)}
            >
              <View style={[styles.stepIcon, { backgroundColor: step.done ? t.okBg : t.field }]}>
                {step.done ? (
                  <Text style={[styles.checkIcon, { color: t.ok }]}>✓</Text>
                ) : (
                  <Text style={[styles.stepNumber, { color: t.primary }]}>{i + 1}</Text>
                )}
              </View>
              <View style={styles.stepInfo}>
                <Text style={[styles.stepTitle, { color: t.text }]}>{step.title}</Text>
                <Text style={[styles.stepStatus, { color: t.sub }]}>
                  {step.done ? 'Completed' : 'Tap to start'}
                </Text>
              </View>
              <Chip variant={step.done ? 'success' : 'default'} size="sm">
                {step.done ? 'Done' : 'Pending'}
              </Chip>
            </TouchableOpacity>
          ))}
        </View>

        {checklist.completed === checklist.total && (
          <Card style={[styles.completeCard, { backgroundColor: t.okBg, borderColor: t.okBg }]}>
            <CardContent>
              <View style={styles.completeContent}>
                <Text className="text-4xl mb-3">🎉</Text>
                <Text style={[styles.completeTitle, { color: t.ok }]}>All Done!</Text>
                <Text style={[styles.completeText, { color: t.ok }]}>You've completed all onboarding steps. Welcome to ThermaTrust!</Text>
              </View>
            </CardContent>
          </Card>
        )}

        <View style={styles.refreshBtn}>
          <Button variant="outline" onPress={() => refreshMutation.mutate()} loading={refreshMutation.isPending}>
            Refresh Status
          </Button>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 100 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  progressCard: { marginBottom: 16 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  progressBarContainer: { flex: 1, height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#0F766E', borderRadius: 4 },
  progressText: { fontSize: 18, fontWeight: '700', color: '#0F766E', width: 50, textAlign: 'right' },
  progressLabel: { fontSize: 13, color: '#64748b' },
  stepsList: { gap: 10 },
  stepCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  stepDone: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  stepIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  checkIcon: { color: '#22c55e', fontSize: 18, fontWeight: 'bold' },
  stepNumber: { fontSize: 16, fontWeight: '700', color: '#0F766E' },
  stepInfo: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  stepStatus: { fontSize: 12, color: '#64748b', marginTop: 2 },
  completeCard: { marginTop: 16, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  completeContent: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  completeTitle: { fontSize: 20, fontWeight: '700', color: '#166534' },
  completeText: { fontSize: 14, color: '#166534', textAlign: 'center', paddingHorizontal: 24 },
  refreshBtn: { marginTop: 16, paddingHorizontal: 16 },
});